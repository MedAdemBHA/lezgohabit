-- A challenge has one lightweight pulse and two privacy-scoped views: the whole
-- challenge and the participant's current crew.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS posts_one_pinned_challenge
  ON public.posts(season_id) WHERE is_pinned;
CREATE INDEX IF NOT EXISTS challenge_events_recent
  ON public.challenge_events(season_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_challenge_post() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Challenge-owned seasons use the challenge tab as their audience. The
  -- SECURITY DEFINER read RPC still checks membership for private challenges.
  IF EXISTS(SELECT 1 FROM public.seasons s WHERE s.id=NEW.season_id AND s.challenge_owned) THEN
    NEW.visibility:='everyone';
  ELSIF EXISTS(SELECT 1 FROM public.challenges c WHERE c.season_id=NEW.season_id AND NOT c.public_board AND c.audience<>'solo') THEN
    NEW.visibility:='crew';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.can_read_post(_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.posts p JOIN public.profiles author ON author.id=p.user_id
    WHERE p.id=_id AND (
      p.user_id=auth.uid() OR (
        (author.is_demo=public._viewer_demo() OR public._caller_is_admin())
        AND author.account_status='active' AND NOT p.hidden
        AND (
          (NOT EXISTS(SELECT 1 FROM public.seasons s WHERE s.id=p.season_id AND s.challenge_owned)
            AND NOT EXISTS(SELECT 1 FROM public.challenges c WHERE c.season_id=p.season_id AND NOT c.public_board))
          OR EXISTS(SELECT 1 FROM public.season_entries e WHERE e.season_id=p.season_id AND e.user_id=auth.uid() AND e.status IN ('active','completed'))
        )
        AND (p.visibility='everyone' OR EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=p.crew_id AND m.user_id=auth.uid()))
      )
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.challenge_saved_score_moments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cr record;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.season_entries e WHERE e.user_id=NEW.user_id AND e.season_id=NEW.season_id AND e.status IN ('active','completed')) THEN
    RETURN NEW;
  END IF;
  -- Leave the undo window before publishing milestones so a later correction
  -- cannot create an event for a day that did not finish that way.
  IF NEW.finalized_at IS NULL THEN RETURN NEW; END IF;

  IF NEW.completion>=1 THEN
    INSERT INTO public.challenge_events(season_id,user_id,event_type,event_key,day,payload,is_demo)
    VALUES(NEW.season_id,NEW.user_id,'perfect_day','perfect:'||NEW.user_id::text||':'||NEW.day::text,NEW.day,'{}'::jsonb,NEW.is_demo)
    ON CONFLICT(season_id,event_key) DO NOTHING;
  END IF;
  IF NEW.streak IN (7,14,21,30,45,60,75,90) AND NEW.completion>=0.6 THEN
    INSERT INTO public.challenge_events(season_id,user_id,event_type,event_key,day,payload,is_demo)
    VALUES(NEW.season_id,NEW.user_id,'streak','streak:'||NEW.user_id::text||':'||NEW.day::text||':'||NEW.streak,NEW.day,jsonb_build_object('days',NEW.streak),NEW.is_demo)
    ON CONFLICT(season_id,event_key) DO NOTHING;
  END IF;

  FOR cr IN
    SELECT c.id,c.name,c.is_demo FROM public.crews c
    JOIN public.crew_members mine ON mine.crew_id=c.id AND mine.user_id=NEW.user_id
    WHERE c.season_id=NEW.season_id AND NOT c.archived
  LOOP
    IF NOT EXISTS(
      SELECT 1 FROM public.crew_members cm
      JOIN public.season_entries se ON se.user_id=cm.user_id AND se.season_id=NEW.season_id AND se.status='active'
      WHERE cm.crew_id=cr.id AND NOT EXISTS(
        SELECT 1 FROM public.daily_scores ds WHERE ds.user_id=cm.user_id AND ds.season_id=NEW.season_id AND ds.day=NEW.day AND ds.completion>=0.6 AND ds.finalized_at IS NOT NULL
      )
    ) AND EXISTS(
      SELECT 1 FROM public.crew_members cm JOIN public.season_entries se ON se.user_id=cm.user_id AND se.season_id=NEW.season_id AND se.status='active'
      WHERE cm.crew_id=cr.id
    ) THEN
      INSERT INTO public.challenge_events(season_id,event_type,event_key,day,payload,is_demo)
      VALUES(NEW.season_id,'crew_all_in','crew-all-in:'||cr.id::text||':'||NEW.day::text,NEW.day,jsonb_build_object('crew_id',cr.id,'crew_name',cr.name),cr.is_demo)
      ON CONFLICT(season_id,event_key) DO NOTHING;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS challenge_score_moments ON public.daily_scores;
CREATE TRIGGER challenge_score_moments
AFTER INSERT OR UPDATE ON public.daily_scores
FOR EACH ROW EXECUTE FUNCTION public.challenge_saved_score_moments();

CREATE OR REPLACE FUNCTION public.challenge_saved_boss_moment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE slug text; demo boolean; d date;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.season_entries e WHERE e.user_id=NEW.user_id AND e.season_id=NEW.season_id AND e.status IN ('active','completed')) THEN RETURN NEW; END IF;
  SELECT b.slug INTO slug FROM public.bosses b WHERE b.id=NEW.boss_id;
  SELECT p.is_demo,public._local_today(p.id) INTO demo,d FROM public.profiles p WHERE p.id=NEW.user_id;
  INSERT INTO public.challenge_events(season_id,user_id,event_type,event_key,day,payload,is_demo)
  VALUES(NEW.season_id,NEW.user_id,'boss','boss:'||NEW.user_id::text||':'||NEW.boss_id::text||':'||NEW.level,d,jsonb_build_object('boss',coalesce(slug,'boss'),'level',NEW.level),demo)
  ON CONFLICT(season_id,event_key) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS challenge_boss_moment ON public.bonus_points;
CREATE TRIGGER challenge_boss_moment
AFTER INSERT ON public.bonus_points
FOR EACH ROW EXECUTE FUNCTION public.challenge_saved_boss_moment();

REVOKE ALL ON FUNCTION public.challenge_saved_score_moments(),public.challenge_saved_boss_moment(),public.guard_challenge_post() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.challenge_pulse(_season_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); demo boolean; my_crew uuid; res jsonb;
BEGIN
  IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=_season_id AND status='active') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT is_demo INTO demo FROM public.profiles WHERE id=uid;
  SELECT cm.crew_id INTO my_crew FROM public.crew_members cm JOIN public.crews c ON c.id=cm.crew_id WHERE cm.user_id=uid AND c.season_id=_season_id AND NOT c.archived LIMIT 1;
  SELECT jsonb_build_object(
    'participants',(SELECT count(*) FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.season_id=_season_id AND e.status='active' AND p.is_demo=demo AND p.account_status='active'),
    'checked_in',(SELECT count(*) FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.season_id=_season_id AND e.status='active' AND p.is_demo=demo AND p.account_status='active' AND EXISTS(SELECT 1 FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_season_id AND ds.day=public._local_today(e.user_id) AND ds.completion>=0.6)),
    'crew_id',my_crew,
    'crew',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'handle',p.handle,'avatar_url',p.avatar_url,'checked_in',EXISTS(SELECT 1 FROM public.daily_scores ds WHERE ds.user_id=p.id AND ds.season_id=_season_id AND ds.day=public._local_today(p.id) AND ds.completion>=0.6)) ORDER BY p.display_name),'[]'::jsonb)
      FROM public.crew_members cm JOIN public.profiles p ON p.id=cm.user_id JOIN public.season_entries e ON e.user_id=p.id AND e.season_id=_season_id AND e.status='active'
      WHERE cm.crew_id=my_crew AND p.is_demo=demo AND p.account_status='active')
  ) INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.challenge_feed(_season_id uuid,_scope text DEFAULT 'challenge') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); res jsonb; my_crew uuid; demo boolean;
BEGIN
  IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=_season_id AND status IN ('active','completed')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _scope NOT IN ('challenge','crew') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  SELECT p.is_demo INTO demo FROM public.profiles p WHERE p.id=uid;
  SELECT cm.crew_id INTO my_crew FROM public.crew_members cm JOIN public.crews c ON c.id=cm.crew_id WHERE cm.user_id=uid AND c.season_id=_season_id AND NOT c.archived LIMIT 1;
  SELECT coalesce(jsonb_agg(row ORDER BY created_at DESC),'[]'::jsonb) INTO res FROM (
    SELECT e.created_at,jsonb_build_object('id',e.id,'type',e.event_type,'user_id',e.user_id,'handle',p.handle,'display_name',p.display_name,'avatar_url',p.avatar_url,'day',e.day,'payload',e.payload,'respects',(SELECT count(*) FROM public.challenge_event_reactions r WHERE r.event_id=e.id),'mine',EXISTS(SELECT 1 FROM public.challenge_event_reactions r WHERE r.event_id=e.id AND r.user_id=uid)) row
    FROM public.challenge_events e LEFT JOIN public.profiles p ON p.id=e.user_id
    WHERE e.season_id=_season_id AND e.is_demo=demo
      AND (_scope='challenge' OR (e.user_id IN(SELECT cm.user_id FROM public.crew_members cm WHERE cm.crew_id=my_crew) OR e.payload->>'crew_id'=my_crew::text))
      AND (e.event_type='surrender' OR e.user_id IS NULL OR e.user_id=uid OR coalesce(p.faith_public,false) OR NOT EXISTS(SELECT 1 FROM public.user_habits h JOIN public.habit_templates t ON t.id=h.template_id WHERE h.user_id=e.user_id AND h.season_id=e.season_id AND t.is_faith))
    ORDER BY e.created_at DESC LIMIT 60
  ) feed;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.proof_feed(_season_id uuid,_scope text DEFAULT 'challenge',_filter text DEFAULT 'all',_before timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); result jsonb; my_crew uuid; demo boolean;
BEGIN
  IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=_season_id AND status='active') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _scope NOT IN ('challenge','crew') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  SELECT p.is_demo INTO demo FROM public.profiles p WHERE p.id=uid;
  SELECT cm.crew_id INTO my_crew FROM public.crew_members cm JOIN public.crews c ON c.id=cm.crew_id WHERE cm.user_id=uid AND c.season_id=_season_id AND NOT c.archived LIMIT 1;
  SELECT coalesce(jsonb_agg(row ORDER BY pinned DESC,created_at DESC),'[]'::jsonb) INTO result FROM (
    SELECT p.created_at,p.is_pinned pinned,jsonb_build_object('id',p.id,'user_id',p.user_id,'type',p.type,'body',p.body,'image_path',p.image_url,'day',p.day,'created_at',p.created_at,'hidden',p.hidden,'visibility',p.visibility,'is_pinned',p.is_pinned,'display_name',pr.display_name,'handle',pr.handle,'avatar_url',pr.avatar_url,'habit_key',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN p.habit_key END,'habit_name',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN h.name END,'category',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN h.category END,'stats',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN p.stats ELSE '{}'::jsonb END,'reactions',(SELECT count(*) FROM public.post_reactions r WHERE r.post_id=p.id),'my_reaction',(SELECT kind FROM public.post_reactions r WHERE r.post_id=p.id AND r.user_id=uid)) row
    FROM public.posts p JOIN public.profiles pr ON pr.id=p.user_id LEFT JOIN public.habit_templates h ON h.key=p.habit_key
    WHERE p.season_id=_season_id AND p.is_demo=demo AND public.can_read_post(p.id)
      AND EXISTS(SELECT 1 FROM public.season_entries e WHERE e.user_id=p.user_id AND e.season_id=_season_id AND e.status IN ('active','completed'))
      AND (NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid)
      AND (NOT p.hidden OR p.user_id=uid)
      AND NOT EXISTS(SELECT 1 FROM public.post_hides x WHERE x.post_id=p.id AND x.user_id=uid)
      AND (_before IS NULL OR p.created_at<_before)
      AND (_scope='challenge' OR p.crew_id=my_crew)
      AND (_filter='all' OR (_filter='thought' AND p.type='thought') OR (p.habit_key=_filter AND (NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid)))
    ORDER BY p.is_pinned DESC,p.created_at DESC LIMIT 20
  ) q;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.set_challenge_pin(_post_id uuid,_pin boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); p public.posts; ch public.challenges; admin boolean;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO p FROM public.posts WHERE id=_post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO ch FROM public.challenges WHERE season_id=p.season_id;
  admin:=public.has_role(uid,'admin');
  IF NOT admin AND (ch.id IS NULL OR ch.audience<>'creator' OR ch.owner_id<>uid OR p.user_id<>uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF admin AND ((ch.id IS NOT NULL AND ch.audience<>'creator') OR (ch.id IS NULL AND NOT EXISTS(SELECT 1 FROM public.season_entries e WHERE e.season_id=p.season_id AND e.kind='official'))) THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM 1 FROM public.seasons WHERE id=p.season_id FOR UPDATE;
  UPDATE public.posts SET is_pinned=false WHERE season_id=p.season_id AND is_pinned;
  IF _pin THEN UPDATE public.posts SET is_pinned=true WHERE id=_post_id; END IF;
END $$;

REVOKE ALL ON FUNCTION public.challenge_pulse(uuid),public.challenge_feed(uuid,text),public.proof_feed(uuid,text,text,timestamptz),public.set_challenge_pin(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.challenge_pulse(uuid),public.challenge_feed(uuid,text),public.proof_feed(uuid,text,text,timestamptz) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_challenge_pin(uuid,boolean) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.can_read_post(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_post(uuid) TO authenticated,service_role;
