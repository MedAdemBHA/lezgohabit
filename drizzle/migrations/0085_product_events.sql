-- P3.5: first-party product analytics in Postgres (owner decision 2026-11-28: no third party).
-- Five events with user id, challenge (season) id and timestamp. Recorded by triggers on saved
-- data, except visit_start which the signed-in app reports once per browser session.
-- Demo/guest data is never recorded. Only admins can read, through admin_funnel().

CREATE TABLE IF NOT EXISTS public.product_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event text NOT NULL CHECK (event IN ('visit_start','challenge_joined','first_log','day7_log','crew_size_changed')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_events_season_event ON public.product_events(season_id, event, user_id);
-- first_log and day7_log happen once per player and challenge.
CREATE UNIQUE INDEX IF NOT EXISTS product_events_once
  ON public.product_events(event, user_id, season_id) WHERE event IN ('first_log','day7_log','challenge_joined');
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.product_events TO service_role;

CREATE OR REPLACE FUNCTION public._track(_event text, _user uuid, _season uuid, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _user IS NULL OR EXISTS (SELECT 1 FROM profiles WHERE id = _user AND is_demo) THEN RETURN; END IF;
  INSERT INTO product_events(event, user_id, season_id, meta) VALUES (_event, _user, _season, coalesce(_meta, '{}'::jsonb))
  ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public._track(text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- challenge_joined
CREATE OR REPLACE FUNCTION public.track_season_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT NEW.is_demo THEN
    PERFORM public._track('challenge_joined', NEW.user_id, NEW.season_id, jsonb_build_object('mode', NEW.mode, 'kind', NEW.kind));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS track_season_entry ON public.season_entries;
CREATE TRIGGER track_season_entry AFTER INSERT ON public.season_entries
  FOR EACH ROW EXECUTE FUNCTION public.track_season_entry();

-- first_log and day7_log (day 7 counted from the player's own first playable day)
CREATE OR REPLACE FUNCTION public.track_checkin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE sid uuid; start_d date; tz text;
BEGIN
  IF NEW.is_demo OR coalesce(NEW.value, 0) <= 0 THEN RETURN NEW; END IF;
  SELECT season_id INTO sid FROM user_habits WHERE id = NEW.user_habit_id;
  IF sid IS NULL THEN RETURN NEW; END IF;
  PERFORM public._track('first_log', NEW.user_id, sid);
  tz := coalesce(public._effective_tz(NEW.user_id), 'Africa/Tunis');
  SELECT greatest(s.starts_on, (e.joined_at AT TIME ZONE tz)::date) INTO start_d
  FROM seasons s JOIN season_entries e ON e.season_id = s.id AND e.user_id = NEW.user_id WHERE s.id = sid;
  IF start_d IS NOT NULL AND NEW.day - start_d + 1 = 7 THEN
    PERFORM public._track('day7_log', NEW.user_id, sid);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS track_checkin ON public.checkins;
CREATE TRIGGER track_checkin AFTER INSERT OR UPDATE OF value ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.track_checkin();

-- crew_size_changed (meta: crew id and the new size)
CREATE OR REPLACE FUNCTION public.track_crew_member() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; sid uuid; n int;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF r.is_demo THEN RETURN NULL; END IF;
  SELECT season_id INTO sid FROM crews WHERE id = r.crew_id;
  SELECT count(*) INTO n FROM crew_members WHERE crew_id = r.crew_id;
  PERFORM public._track('crew_size_changed', r.user_id, sid,
    jsonb_build_object('crew_id', r.crew_id, 'size', n, 'change', CASE WHEN TG_OP = 'DELETE' THEN 'left' ELSE 'joined' END));
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS track_crew_member ON public.crew_members;
CREATE TRIGGER track_crew_member AFTER INSERT OR DELETE ON public.crew_members
  FOR EACH ROW EXECUTE FUNCTION public.track_crew_member();

-- visit_start: once per browser session for signed-in players (no anonymous tracking).
CREATE OR REPLACE FUNCTION public.track_visit(_season_id uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  -- At most one visit per player per 30 minutes, whatever the client sends.
  IF EXISTS (SELECT 1 FROM product_events WHERE event = 'visit_start' AND user_id = uid AND created_at > now() - interval '30 minutes') THEN
    RETURN;
  END IF;
  PERFORM public._track('visit_start', uid,
    CASE WHEN EXISTS (SELECT 1 FROM season_entries WHERE user_id = uid AND season_id = _season_id) THEN _season_id END);
END $$;
REVOKE ALL ON FUNCTION public.track_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_visit(uuid) TO authenticated;

-- Admin funnel for one challenge: visits -> joined -> first log -> day-7 log,
-- plus day-7 retention for players in a crew vs solo.
CREATE OR REPLACE FUNCTION public.admin_funnel(_season_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb;
BEGIN
  PERFORM public._require_admin();
  WITH ev AS (SELECT event, user_id FROM product_events WHERE season_id = _season_id),
  joined AS (SELECT DISTINCT user_id FROM ev WHERE event = 'challenge_joined'),
  crewed AS (
    SELECT DISTINCT m.user_id FROM crew_members m JOIN crews c ON c.id = m.crew_id
    WHERE c.season_id = _season_id AND (SELECT count(*) FROM crew_members x WHERE x.crew_id = c.id) >= 2),
  d7 AS (SELECT DISTINCT user_id FROM ev WHERE event = 'day7_log')
  SELECT jsonb_build_object(
    'visits', (SELECT count(DISTINCT user_id) FROM ev WHERE event = 'visit_start'),
    'joined', (SELECT count(*) FROM joined),
    'first_log', (SELECT count(DISTINCT user_id) FROM ev WHERE event = 'first_log'),
    'day7_log', (SELECT count(*) FROM d7),
    'crew', jsonb_build_object(
      'joined', (SELECT count(*) FROM joined j WHERE j.user_id IN (SELECT user_id FROM crewed)),
      'day7', (SELECT count(*) FROM d7 WHERE user_id IN (SELECT user_id FROM crewed))),
    'solo', jsonb_build_object(
      'joined', (SELECT count(*) FROM joined j WHERE j.user_id NOT IN (SELECT user_id FROM crewed)),
      'day7', (SELECT count(*) FROM d7 WHERE user_id NOT IN (SELECT user_id FROM crewed))),
    'crew_changes', (SELECT count(*) FROM ev WHERE event = 'crew_size_changed')
  ) INTO res;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.admin_funnel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_funnel(uuid) TO authenticated;
