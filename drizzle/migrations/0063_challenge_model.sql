-- One season is one challenge. Keep existing season/check-in ids stable so old trails survive.
ALTER TABLE public.season_entries
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'official',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_reason text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.season_entries'::regclass AND conname='season_entries_kind_check') THEN
    ALTER TABLE public.season_entries ADD CONSTRAINT season_entries_kind_check CHECK (kind IN ('official','creator','personal'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.season_entries'::regclass AND conname='season_entries_status_check') THEN
    ALTER TABLE public.season_entries ADD CONSTRAINT season_entries_status_check CHECK (status IN ('active','completed','surrendered'));
  END IF;
END $$;

-- Deterministic legacy safety net: preference, current official fallback, latest joined.
WITH ordered AS (
  SELECT e.user_id,e.season_id,s.ends_on,s.frozen_at,e.joined_at,
         row_number() OVER (PARTITION BY e.user_id ORDER BY
           (c.id=p.active_challenge_id) DESC NULLS LAST,
           (NOT s.challenge_owned AND s.status='live' AND s.ends_on>=public._local_today(e.user_id)) DESC,
           e.joined_at DESC,e.season_id) AS pick
  FROM public.season_entries e
  JOIN public.seasons s ON s.id=e.season_id
  LEFT JOIN public.challenges c ON c.season_id=e.season_id
  LEFT JOIN public.user_preferences p ON p.user_id=e.user_id
)
UPDATE public.season_entries e SET
  kind=CASE WHEN NOT s.challenge_owned THEN 'official' WHEN c.audience='creator' THEN 'creator' ELSE 'personal' END,
  status=CASE WHEN s.frozen_at IS NOT NULL OR s.ends_on<public._local_today(e.user_id) THEN 'completed' WHEN o.pick=1 THEN 'active' ELSE 'surrendered' END,
  ended_at=CASE WHEN s.frozen_at IS NOT NULL OR s.ends_on<public._local_today(e.user_id) THEN coalesce(s.frozen_at,(s.ends_on+1)::timestamp AT TIME ZONE 'Africa/Tunis') WHEN o.pick>1 THEN now() END,
  end_reason=CASE WHEN o.pick>1 AND s.frozen_at IS NULL AND s.ends_on>=public._local_today(e.user_id) THEN 'legacy_switch' WHEN s.frozen_at IS NOT NULL OR s.ends_on<public._local_today(e.user_id) THEN 'challenge_ended' END
FROM ordered o JOIN public.seasons s ON s.id=o.season_id LEFT JOIN public.challenges c ON c.season_id=o.season_id
WHERE e.user_id=o.user_id AND e.season_id=o.season_id;

CREATE UNIQUE INDEX IF NOT EXISTS season_entries_one_active_per_user
  ON public.season_entries(user_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS season_entries_season_status_kind
  ON public.season_entries(season_id,status,kind);

CREATE OR REPLACE FUNCTION public._require_active_participation(_user uuid,_season uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF coalesce(current_setting('lezgo.final_override',true),'')='on' THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=_user AND season_id=_season AND status='active') THEN
    RAISE EXCEPTION 'challenge_not_active';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._require_active_participation(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.guard_active_participation_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sid uuid;
BEGIN
  IF uid IS NULL OR coalesce(current_setting('lezgo.final_override',true),'')='on' THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_TABLE_NAME='checkins' THEN
    PERFORM public._require_active_participation(NEW.user_id,(SELECT season_id FROM public.user_habits WHERE id=NEW.user_habit_id));
  ELSIF TG_TABLE_NAME='user_habits' THEN
    PERFORM public._require_active_participation(NEW.user_id,NEW.season_id);
  ELSIF TG_TABLE_NAME='bonus_points' THEN
    PERFORM public._require_active_participation(NEW.user_id,NEW.season_id);
  ELSIF TG_TABLE_NAME='posts' THEN
    IF TG_OP='INSERT' THEN
      PERFORM public._require_active_participation(NEW.user_id,NEW.season_id);
    ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.season_id IS DISTINCT FROM OLD.season_id OR NEW.body IS DISTINCT FROM OLD.body OR NEW.image_url IS DISTINCT FROM OLD.image_url THEN
      PERFORM public._require_active_participation(NEW.user_id,NEW.season_id);
    END IF;
  ELSIF TG_TABLE_NAME='day_extras' THEN
    IF NOT EXISTS(SELECT 1 FROM public.season_entries e JOIN public.seasons s ON s.id=e.season_id WHERE e.user_id=NEW.user_id AND e.status='active' AND NEW.day BETWEEN s.starts_on AND s.ends_on) THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_active_participation_row() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS checkin_active_participation ON public.checkins;
CREATE TRIGGER checkin_active_participation BEFORE INSERT OR UPDATE ON public.checkins FOR EACH ROW EXECUTE FUNCTION public.guard_active_participation_row();
DROP TRIGGER IF EXISTS habit_active_participation ON public.user_habits;
CREATE TRIGGER habit_active_participation BEFORE INSERT OR UPDATE ON public.user_habits FOR EACH ROW EXECUTE FUNCTION public.guard_active_participation_row();
DROP TRIGGER IF EXISTS bonus_active_participation ON public.bonus_points;
CREATE TRIGGER bonus_active_participation BEFORE INSERT OR UPDATE ON public.bonus_points FOR EACH ROW EXECUTE FUNCTION public.guard_active_participation_row();
DROP TRIGGER IF EXISTS post_active_participation ON public.posts;
CREATE TRIGGER post_active_participation BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.guard_active_participation_row();
DROP TRIGGER IF EXISTS day_extra_active_participation ON public.day_extras;
CREATE TRIGGER day_extra_active_participation BEFORE INSERT OR UPDATE ON public.day_extras FOR EACH ROW EXECUTE FUNCTION public.guard_active_participation_row();

CREATE TABLE IF NOT EXISTS public.challenge_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.habit_templates(id),
  habit_key text NOT NULL,
  name jsonb NOT NULL,
  what_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  kind text NOT NULL CHECK (kind IN ('check','count','salat','lift','detox','time_window','quit','timer')),
  target numeric NOT NULL DEFAULT 1 CHECK (target>0),
  unit text,
  rule jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rule)='object'),
  is_faith boolean NOT NULL DEFAULT false,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 5),
  is_demo boolean NOT NULL DEFAULT false,
  UNIQUE(season_id,position),
  UNIQUE(season_id,habit_key)
);
ALTER TABLE public.challenge_habits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.challenge_habits FROM anon,authenticated;
GRANT SELECT ON public.challenge_habits TO authenticated;
GRANT ALL ON public.challenge_habits TO service_role;
DROP POLICY IF EXISTS challenge_habits_participant_read ON public.challenge_habits;
CREATE POLICY challenge_habits_participant_read ON public.challenge_habits FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.seasons s WHERE s.id=season_id AND NOT s.challenge_owned)
  OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.season_id=challenge_habits.season_id AND c.public_board AND NOT c.archived)
  OR EXISTS (SELECT 1 FROM public.season_entries e WHERE e.season_id=challenge_habits.season_id AND e.user_id=auth.uid())
  OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.season_id=challenge_habits.season_id AND c.owner_id=auth.uid())
);

ALTER TABLE public.habit_templates ADD COLUMN IF NOT EXISTS what_counts jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.user_habits ADD COLUMN IF NOT EXISTS what_counts jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.user_habits ADD COLUMN IF NOT EXISTS rule jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.user_habits uh SET what_counts=ht.description
FROM public.habit_templates ht WHERE uh.template_id=ht.id AND uh.what_counts='{}'::jsonb;

-- Replace the old 1–3 limit with the saved challenge list length; personal lists also top out at six.
CREATE OR REPLACE FUNCTION public.validate_user_habit() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE lim integer; entry_kind text; listed integer;
BEGIN
  SELECT kind INTO entry_kind FROM public.season_entries WHERE user_id=NEW.user_id AND season_id=NEW.season_id;
  SELECT count(*) INTO listed FROM public.challenge_habits WHERE season_id=NEW.season_id;
  lim:=CASE WHEN listed>0 THEN least(6,listed) ELSE CASE WHEN entry_kind='personal' THEN 6 ELSE 3 END END;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.user_id AND is_demo) THEN lim:=greatest(lim,8); END IF;
  IF NEW.active AND (SELECT count(*) FROM public.user_habits WHERE user_id=NEW.user_id AND season_id=NEW.season_id AND active AND id<>NEW.id)>=lim THEN RAISE EXCEPTION 'max_habits'; END IF;
  IF NEW.custom_name IS NOT NULL AND length(NEW.custom_name)>40 THEN RAISE EXCEPTION 'name_too_long'; END IF;
  RETURN NEW;
END $$;

ALTER TABLE public.season_results ALTER COLUMN rank_country DROP NOT NULL;
ALTER TABLE public.season_results ALTER COLUMN rank_world DROP NOT NULL;
ALTER TABLE public.season_results ALTER COLUMN rank_crew DROP NOT NULL;
ALTER TABLE public.season_results ADD COLUMN IF NOT EXISTS rank_challenge integer;
ALTER TABLE public.season_results ADD COLUMN IF NOT EXISTS completed_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.season_results ADD COLUMN IF NOT EXISTS consistency_percent numeric NOT NULL DEFAULT 0;
ALTER TABLE public.season_results ADD COLUMN IF NOT EXISTS participation_kind text NOT NULL DEFAULT 'official';
ALTER TABLE public.season_results ADD COLUMN IF NOT EXISTS participation_status text NOT NULL DEFAULT 'completed';
ALTER TABLE public.season_results ADD COLUMN IF NOT EXISTS trophy_private boolean NOT NULL DEFAULT false;
ALTER TABLE public.season_trophies ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
DROP POLICY IF EXISTS season_trophies_read ON public.season_trophies;
DROP POLICY IF EXISTS trophy_owner_read ON public.season_trophies;
CREATE POLICY season_trophies_read ON public.season_trophies FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR (NOT is_private AND is_demo=public._viewer_demo()));

-- Populate challenge lists for all official seasons; Winter Arc keeps the chosen train/read/sleep7 list.
INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,is_faith,position,is_demo)
SELECT s.id,h.id,h.key,h.name,h.description,h.kind,h.default_target,h.unit,h.is_faith,k.ord::int-1,s.is_demo
FROM public.seasons s
CROSS JOIN LATERAL unnest(CASE WHEN s.slug='winter-arc-2026' THEN ARRAY['train','read','sleep7']::text[]
  WHEN cardinality(s.featured_habits)>0 THEN s.featured_habits ELSE ARRAY['train','read','sleep7']::text[] END) WITH ORDINALITY k(key,ord)
JOIN public.habit_templates h ON h.key=k.key
WHERE NOT s.challenge_owned AND NOT s.archived AND NOT s.is_demo AND k.ord<=6
ON CONFLICT (season_id,position) DO NOTHING;
INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,is_faith,position,is_demo)
SELECT c.season_id,h.id,h.key,h.name,h.description,h.kind,h.default_target,h.unit,h.is_faith,k.ord::int-1,c.is_demo
FROM public.challenges c CROSS JOIN LATERAL unnest(c.habit_keys) WITH ORDINALITY k(key,ord)
JOIN public.habit_templates h ON h.key=k.key
WHERE NOT EXISTS(SELECT 1 FROM public.challenge_habits ch WHERE ch.season_id=c.season_id)
ON CONFLICT DO NOTHING;
-- Existing participants retain their habits; mismatched official entries are private legacy personal challenges.
UPDATE public.season_entries e SET kind='personal'
WHERE e.kind='official'
AND EXISTS(SELECT 1 FROM public.challenge_habits ch WHERE ch.season_id=e.season_id)
AND (SELECT array_agg(coalesce(ht.key,uh.custom_name) ORDER BY uh.position) FROM public.user_habits uh LEFT JOIN public.habit_templates ht ON ht.id=uh.template_id WHERE uh.user_id=e.user_id AND uh.season_id=e.season_id AND uh.active)
  IS DISTINCT FROM
    (SELECT array_agg(ch.habit_key ORDER BY ch.position) FROM public.challenge_habits ch WHERE ch.season_id=e.season_id);
UPDATE public.user_habits uh SET
  target=ch.target,kind=ch.kind,unit=ch.unit,what_counts=ch.what_counts,rule=ch.rule
FROM public.challenge_habits ch JOIN public.season_entries e ON e.season_id=ch.season_id AND e.user_id=uh.user_id
WHERE uh.season_id=ch.season_id AND uh.template_id=ch.template_id AND e.kind<>'personal'
  AND uh.created_at >= e.joined_at AND NOT EXISTS(SELECT 1 FROM public.checkins ci WHERE ci.user_habit_id=uh.id);

-- Public boards use only active/completed official entries. Challenge boards use this RPC instead.
CREATE OR REPLACE FUNCTION public._rank_rows(_sid uuid,_scope text,_period text,_country text,_day date,_viewer uuid)
RETURNS TABLE(entity uuid,rnk bigint,points bigint,streak integer,joined timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
WITH v AS (SELECT coalesce((SELECT is_demo FROM public.profiles WHERE id=_viewer),false) demo,public._local_today(_viewer)-_day off),
s AS (SELECT starts_on FROM public.seasons WHERE id=_sid),
players AS (
 SELECT e.user_id,e.joined_at,coalesce(p.timezone,'Africa/Tunis') timezone,p.country_code,p.show_on_public_board,public._local_today(e.user_id)-v.off pd
 FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id CROSS JOIN v
 WHERE e.season_id=_sid AND e.kind='official' AND e.status IN ('active','completed') AND p.is_demo=v.demo AND p.account_status='active'),
scored AS (
 SELECT pl.*,(coalesce((SELECT sum(ds.total) FROM public.daily_scores ds CROSS JOIN s WHERE ds.user_id=pl.user_id AND ds.season_id=_sid AND ds.day<=pl.pd AND ds.day>=CASE _period WHEN 'today' THEN pl.pd WHEN 'week' THEN date_trunc('week',pl.pd)::date ELSE s.starts_on END),0)
   +CASE WHEN _period='season' THEN coalesce((SELECT sum(bp.points) FROM public.bonus_points bp WHERE bp.user_id=pl.user_id AND bp.season_id=_sid AND (bp.awarded_at AT TIME ZONE pl.timezone)::date<=pl.pd),0) ELSE 0 END)::bigint points,
   coalesce((SELECT d.streak FROM public.daily_scores d WHERE d.user_id=pl.user_id AND d.season_id=_sid AND d.day<=pl.pd ORDER BY d.day DESC LIMIT 1),0) streak
 FROM players pl WHERE pl.joined_at<(pl.pd+1)::timestamp AT TIME ZONE pl.timezone),
base AS (
 SELECT user_id entity,points,streak,joined_at joined FROM scored WHERE _scope<>'crews' AND (_scope<>'country' OR country_code=_country) AND (show_on_public_board OR user_id=_viewer)
 UNION ALL
 SELECT c.id,coalesce((SELECT sum(sc.points) FROM scored sc JOIN public.crew_members m ON m.user_id=sc.user_id AND m.crew_id=c.id),0)::bigint,0,c.created_at
 FROM public.crews c CROSS JOIN v WHERE _scope='crews' AND c.season_id=_sid AND c.is_demo=v.demo AND c.created_at<(_day+1)::timestamp AT TIME ZONE 'Africa/Tunis'
   AND EXISTS(SELECT 1 FROM public.crew_members m JOIN public.season_entries e ON e.user_id=m.user_id AND e.season_id=_sid WHERE m.crew_id=c.id AND e.kind='official' AND e.status IN ('active','completed'))
)
SELECT entity,row_number() OVER(ORDER BY points DESC,streak DESC,joined ASC,entity),points,streak,joined FROM base $fn$;

CREATE OR REPLACE FUNCTION public.active_season() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT season_id INTO sid FROM public.season_entries WHERE user_id=auth.uid() AND status='active' ORDER BY joined_at DESC LIMIT 1;
  IF sid IS NULL THEN SELECT id INTO sid FROM public.seasons WHERE status='live' AND NOT challenge_owned AND NOT archived AND ends_on>=public._local_today(auth.uid()) ORDER BY starts_on LIMIT 1; END IF;
  RETURN (SELECT to_jsonb(s) FROM public.seasons s WHERE s.id=sid);
END $$;

CREATE OR REPLACE FUNCTION public.validate_challenge_habit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ch public.challenge_habits; challenge public.challenges; hkey text;
BEGIN
  SELECT * INTO challenge FROM public.challenges WHERE season_id=NEW.season_id;
  IF NOT FOUND OR coalesce(current_setting('lezgo.habit_rpc',true),'')='on' THEN RETURN NEW; END IF;
  SELECT key INTO hkey FROM public.habit_templates WHERE id=NEW.template_id;
  SELECT * INTO ch FROM public.challenge_habits WHERE season_id=NEW.season_id
    AND template_id IS NOT DISTINCT FROM NEW.template_id AND habit_key=coalesce(hkey,NEW.custom_name) LIMIT 1;
  IF NOT FOUND OR NEW.kind IS DISTINCT FROM ch.kind OR NEW.target IS DISTINCT FROM ch.target OR NEW.unit IS DISTINCT FROM ch.unit OR NEW.rule IS DISTINCT FROM ch.rule OR NEW.what_counts IS DISTINCT FROM ch.what_counts OR NOT NEW.active THEN
    RAISE EXCEPTION 'challenge_habits_locked';
  END IF;
  IF ch.is_faith AND NOT challenge.faith_allowed THEN RAISE EXCEPTION 'challenge_faith_disabled'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS challenge_habit_guard ON public.user_habits;
CREATE TRIGGER challenge_habit_guard BEFORE INSERT OR UPDATE ON public.user_habits FOR EACH ROW EXECUTE FUNCTION public.validate_challenge_habit();

CREATE OR REPLACE FUNCTION public.activate_challenge(_id uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sid uuid;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _id IS NULL THEN
    SELECT season_id INTO sid FROM public.season_entries WHERE user_id=uid AND status='active' AND kind='official' ORDER BY joined_at DESC LIMIT 1;
  ELSE
    SELECT c.season_id INTO sid FROM public.challenges c JOIN public.season_entries e ON e.season_id=c.season_id AND e.user_id=uid AND e.status='active' WHERE c.id=_id;
    IF sid IS NULL THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  END IF;
  INSERT INTO public.user_preferences(user_id,active_challenge_id) VALUES(uid,(SELECT id FROM public.challenges WHERE season_id=sid))
  ON CONFLICT(user_id) DO UPDATE SET active_challenge_id=excluded.active_challenge_id;
END $$;

CREATE OR REPLACE FUNCTION public.join_season(_season_id uuid,_mode text DEFAULT 'solo') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); s public.seasons;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _mode NOT IN ('solo','crew','creator') THEN RAISE EXCEPTION 'bad_mode'; END IF;
  SELECT * INTO s FROM public.seasons WHERE id=_season_id AND NOT challenge_owned;
  IF NOT FOUND THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF s.ends_on<public._local_today(uid) THEN RAISE EXCEPTION 'challenge_ended'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=_season_id AND status='surrendered') THEN RAISE EXCEPTION 'challenge_surrendered'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=_season_id AND status='completed') THEN RAISE EXCEPTION 'challenge_complete'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND status='active' AND season_id<>_season_id) THEN RAISE EXCEPTION 'active_challenge_exists'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=_season_id AND status='surrendered') THEN RAISE EXCEPTION 'challenge_surrendered'; END IF;
  INSERT INTO public.season_entries(user_id,season_id,mode,kind,status) VALUES(uid,_season_id,_mode,'official','active')
  ON CONFLICT(user_id,season_id) DO UPDATE SET status='active',kind='official',mode=excluded.mode;
  INSERT INTO public.user_habits(user_id,season_id,template_id,kind,target,unit,position,what_counts,rule)
  SELECT uid,_season_id,ch.template_id,ch.kind,ch.target,ch.unit,ch.position,ch.what_counts,ch.rule
  FROM public.challenge_habits ch WHERE ch.season_id=_season_id
    AND NOT EXISTS(SELECT 1 FROM public.user_habits uh WHERE uh.user_id=uid AND uh.season_id=_season_id AND uh.template_id=ch.template_id);
  PERFORM public.activate_challenge(NULL);
END $$;

CREATE OR REPLACE FUNCTION public.join_challenge(_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); c public.challenges; s public.seasons; cap integer;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO c FROM public.challenges WHERE code=upper(trim(_code)) AND NOT archived AND is_demo=(SELECT is_demo FROM public.profiles WHERE id=uid) FOR UPDATE;
  IF NOT FOUND OR c.audience='solo' OR NOT c.approved AND c.audience='creator' THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  SELECT * INTO s FROM public.seasons WHERE id=c.season_id;
  IF s.ends_on<public._local_today(uid) OR s.archived THEN RAISE EXCEPTION 'challenge_ended'; END IF;
  IF (SELECT count(*) FROM public.challenge_habits WHERE season_id=c.season_id) NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'challenge_not_ready'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=c.season_id AND status='surrendered') THEN RAISE EXCEPTION 'challenge_surrendered'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND status='active' AND season_id<>c.season_id) THEN RAISE EXCEPTION 'active_challenge_exists'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=c.season_id AND status='active') THEN RETURN c.id; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=c.season_id AND status='completed') THEN RAISE EXCEPTION 'challenge_complete'; END IF;
  SELECT coalesce(max_members,500) INTO cap FROM public.crews WHERE id=c.crew_id;
  IF (SELECT count(*) FROM public.season_entries WHERE season_id=c.season_id AND status IN ('active','completed'))>=coalesce(cap,500) THEN RAISE EXCEPTION 'challenge_full'; END IF;
  INSERT INTO public.season_entries(user_id,season_id,mode,kind,status) VALUES(uid,c.season_id,'crew',CASE WHEN c.audience='creator' THEN 'creator' ELSE 'personal' END,'active');
  IF c.crew_id IS NOT NULL THEN INSERT INTO public.crew_members(crew_id,user_id) VALUES(c.crew_id,uid) ON CONFLICT DO NOTHING; END IF;
  INSERT INTO public.user_habits(user_id,season_id,template_id,custom_name,kind,target,unit,position,what_counts,rule)
  SELECT uid,c.season_id,ch.template_id,CASE WHEN ch.template_id IS NULL THEN ch.name->>'en' END,ch.kind,ch.target,ch.unit,ch.position,ch.what_counts,ch.rule
  FROM public.challenge_habits ch WHERE ch.season_id=c.season_id;
  PERFORM public.activate_challenge(c.id);
  RETURN c.id;
END $$;

CREATE OR REPLACE FUNCTION public.challenge_preview(_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.challenges; s public.seasons; res jsonb;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE code=upper(trim(_code)) AND NOT archived AND public_board AND audience<>'solo' AND NOT is_demo;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.seasons WHERE id=c.season_id;
  SELECT jsonb_build_object('id',c.id,'season_id',c.season_id,'name',c.name,'days',c.days,'audience',c.audience,'creator',p.handle,'starts_on',s.starts_on,'ends_on',s.ends_on,'code',c.code,
    'members',(SELECT count(*) FROM public.season_entries e WHERE e.season_id=c.season_id AND e.status IN ('active','completed')),
    'full',false,'ended',s.ends_on<current_date,
    'habits',coalesce((SELECT jsonb_agg(jsonb_build_object('key',ch.habit_key,'name',ch.name,'what_counts',ch.what_counts,'kind',ch.kind,'target',ch.target,'unit',ch.unit,'is_faith',ch.is_faith) ORDER BY ch.position) FROM public.challenge_habits ch WHERE ch.season_id=c.season_id),'[]'::jsonb))
  INTO res FROM public.profiles p WHERE p.id=c.owner_id;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.create_personal_challenge(_name text,_days integer,_habits jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sid uuid; cid uuid; code text; today date; item jsonb; pos integer:=0; tpl public.habit_templates;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF char_length(trim(coalesce(_name,''))) NOT BETWEEN 1 AND 60 OR _days NOT BETWEEN 7 AND 90 OR jsonb_typeof(_habits)<>'array' OR jsonb_array_length(_habits) NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'invalid_challenge'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND status='active') THEN RAISE EXCEPTION 'active_challenge_exists'; END IF;
  today:=public._local_today(uid);
  code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  INSERT INTO public.seasons(slug,name,starts_on,ends_on,status,theme_color,challenge_owned)
  VALUES('personal-'||lower(code),jsonb_build_object('en',trim(_name),'fr',trim(_name),'ar',trim(_name),'aeb',trim(_name)),today,today+_days-1,'live','blue',true) RETURNING id INTO sid;
  INSERT INTO public.challenges(owner_id,season_id,name,template,days,audience,same_habits,habit_keys,faith_allowed,weekly_bosses,public_board,starts_on,code,approved,featured,archived,is_demo)
  VALUES(uid,sid,trim(_name),'custom',_days,'solo',true,'{}',false,false,false,today,code,true,false,false,(SELECT is_demo FROM public.profiles WHERE id=uid)) RETURNING id INTO cid;
  INSERT INTO public.season_entries(user_id,season_id,mode,kind,status) VALUES(uid,sid,'solo','personal','active');
  FOR item IN SELECT value FROM jsonb_array_elements(_habits) LOOP
    SELECT * INTO tpl FROM public.habit_templates WHERE key=item->>'key' AND NOT archived;
    IF NOT FOUND OR tpl.is_faith THEN RAISE EXCEPTION 'invalid_habit'; END IF;
    IF EXISTS(SELECT 1 FROM public.challenge_habits WHERE season_id=sid AND habit_key=tpl.key) THEN RAISE EXCEPTION 'duplicate_habit'; END IF;
    INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,rule,is_faith,position,is_demo)
    VALUES(sid,tpl.id,tpl.key,tpl.name,tpl.what_counts,tpl.kind,coalesce((item->>'target')::numeric,tpl.default_target),tpl.unit,coalesce(item->'rule','{}'::jsonb),tpl.is_faith,pos,(SELECT is_demo FROM public.profiles WHERE id=uid));
    INSERT INTO public.user_habits(user_id,season_id,template_id,kind,target,unit,position,what_counts,rule,is_demo)
    VALUES(uid,sid,tpl.id,tpl.kind,coalesce((item->>'target')::numeric,tpl.default_target),tpl.unit,pos,tpl.what_counts,coalesce(item->'rule','{}'::jsonb),(SELECT is_demo FROM public.profiles WHERE id=uid));
    pos:=pos+1;
  END LOOP;
  PERFORM public.activate_challenge(cid);
  RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION public.challenge_scoreboard(_season_id uuid,_scope text DEFAULT 'challenge',_country text DEFAULT 'TN') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); s public.seasons; own_kind text; res jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO s FROM public.seasons WHERE id=_season_id;
  SELECT kind INTO own_kind FROM public.season_entries WHERE user_id=uid AND season_id=_season_id;
  IF NOT FOUND OR own_kind='personal' THEN RAISE EXCEPTION 'private_challenge'; END IF;
  IF _scope NOT IN ('challenge','country','world','crews') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  IF _scope IN ('country','world') AND own_kind<>'official' THEN RAISE EXCEPTION 'official_only'; END IF;
  WITH rows AS (
    SELECT e.user_id,p.display_name,p.handle,p.avatar_url,p.country_code,e.kind,e.joined_at,
      coalesce((SELECT sum(ds.total) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_season_id AND ds.day<=least(s.ends_on,public._local_today(e.user_id))),0)::bigint points,
      coalesce((SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_season_id AND ds.day BETWEEN greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND least(s.ends_on,public._local_today(e.user_id)) AND ds.completion>=0.6),0)::int completed_days,
      coalesce((SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_season_id AND ds.day BETWEEN greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND least(s.ends_on,public._local_today(e.user_id)) AND ds.completion=1),0)::int perfect_days,
      greatest(1,least(s.ends_on,public._local_today(e.user_id))-greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date)+1)::int elapsed_days,
      (SELECT cm.crew_id FROM public.crew_members cm JOIN public.crews cr ON cr.id=cm.crew_id WHERE cm.user_id=e.user_id AND cr.season_id=_season_id LIMIT 1) crew_id
    FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id
    WHERE e.season_id=_season_id AND e.kind IN ('official','creator') AND e.status IN ('active','completed')
      AND p.is_demo=(SELECT is_demo FROM public.profiles WHERE id=uid) AND p.account_status='active'
      AND (_scope NOT IN ('country','world') OR e.kind='official') AND (_scope<>'country' OR p.country_code=_country)
  ), ranked AS (
    SELECT rows.*,row_number() OVER(ORDER BY points DESC,completed_days::numeric/greatest(elapsed_days,1) DESC,joined_at, user_id) rnk
    FROM rows WHERE _scope<>'crews'
  ), rendered AS (
    SELECT jsonb_build_object('rank',rnk,'user_id',user_id,'crew_id',NULL,'display_name',display_name,'handle',handle,'avatar_url',avatar_url,'country_code',country_code,'points',points,'is_me',user_id=uid,'previous_rank',NULL,'members',NULL,'stat',NULL,
      'completed_days',completed_days,'perfect_days',perfect_days,'elapsed_days',elapsed_days,'consistency',round(100.0*completed_days/greatest(elapsed_days,1),1)) row,rnk
    FROM ranked
  )
  SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(row ORDER BY rnk) FROM rendered WHERE rnk<=100),'[]'::jsonb),'me',(SELECT row FROM rendered WHERE row->>'is_me'='true' LIMIT 1)) INTO res;
  IF _scope='crews' THEN
    WITH crew_rows AS (
      SELECT c.id,c.name,c.created_at,count(m.user_id) members,coalesce(sum((SELECT coalesce(sum(ds.total),0) FROM public.daily_scores ds WHERE ds.user_id=m.user_id AND ds.season_id=_season_id)),0)::bigint points
      FROM public.crews c JOIN public.crew_members m ON m.crew_id=c.id JOIN public.season_entries e ON e.user_id=m.user_id AND e.season_id=_season_id AND e.status IN ('active','completed')
      WHERE c.season_id=_season_id GROUP BY c.id,c.name,c.created_at
    ), ranked_crews AS (SELECT *,row_number() OVER(ORDER BY points DESC,created_at,id) rnk FROM crew_rows), rendered_crews AS (
      SELECT jsonb_build_object('rank',rnk,'user_id',NULL,'crew_id',id,'display_name',name,'handle',NULL,'avatar_url',NULL,'country_code',NULL,'points',points,'is_me',exists(SELECT 1 FROM public.crew_members WHERE crew_id=id AND user_id=uid),'members',members,'previous_rank',NULL,'stat',NULL,'completed_days',0,'perfect_days',0,'elapsed_days',0,'consistency',0) row,rnk FROM ranked_crews
    ) SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(row ORDER BY rnk) FROM rendered_crews WHERE rnk<=100),'[]'::jsonb),'me',(SELECT row FROM rendered_crews WHERE row->>'is_me'='true' LIMIT 1)) INTO res;
  END IF;
  RETURN coalesce(res,jsonb_build_object('rows','[]'::jsonb,'me',NULL));
END $$;

CREATE OR REPLACE FUNCTION public.my_challenge_history() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); res jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT coalesce(jsonb_agg(row ORDER BY active DESC,started DESC),'[]'::jsonb) INTO res FROM (
    SELECT jsonb_build_object('season_id',s.id,'challenge_id',c.id,'name',coalesce(c.name,s.name->>'en'),'kind',e.kind,'status',e.status,'creator',cp.handle,
      'start_date',s.starts_on,'end_date',s.ends_on,'length',s.ends_on-s.starts_on+1,'joined_at',e.joined_at,'ended_at',e.ended_at,'end_reason',e.end_reason,
      'completed_days',(SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=s.id AND ds.completion>=0.6 AND ds.day>=greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND ds.day<=least(s.ends_on,public._local_today(uid))),
      'perfect_days',(SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=s.id AND ds.completion=1 AND ds.day>=greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND ds.day<=least(s.ends_on,public._local_today(uid))),
      'consistency',round(100.0*(SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=s.id AND ds.completion>=0.6 AND ds.day>=greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND ds.day<=least(s.ends_on,public._local_today(uid)))/greatest(1,least(s.ends_on,public._local_today(uid))-greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date)+1),1),
      'points',coalesce((SELECT score FROM public.season_results sr WHERE sr.user_id=uid AND sr.season_id=s.id),(SELECT sum(ds.total) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=s.id),0),
      'rank',coalesce((SELECT rank_challenge FROM public.season_results sr WHERE sr.user_id=uid AND sr.season_id=s.id),(SELECT rank_country FROM public.season_results sr WHERE sr.user_id=uid AND sr.season_id=s.id)),
      'crew',(SELECT jsonb_build_object('id',cr.id,'name',cr.name,'code',cr.code) FROM public.crew_members cm JOIN public.crews cr ON cr.id=cm.crew_id WHERE cm.user_id=uid AND cr.season_id=s.id LIMIT 1),
      'habits',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',ch.habit_key,'name',ch.name,'what_counts',ch.what_counts,'kind',ch.kind,'target',ch.target,'unit',ch.unit,'is_faith',ch.is_faith) ORDER BY ch.position),'[]'::jsonb) FROM public.challenge_habits ch WHERE ch.season_id=s.id),
      'trail',(SELECT coalesce(jsonb_agg(jsonb_build_object('day',ds.day,'completion',ds.completion,'points',ds.total,'perfect',ds.perfect,'finalized',ds.finalized_at IS NOT NULL) ORDER BY ds.day),'[]'::jsonb) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=s.id),
      'active',e.status='active','started',e.joined_at) row,e.status='active' active,e.joined_at started
    FROM public.season_entries e JOIN public.seasons s ON s.id=e.season_id JOIN public.profiles p ON p.id=uid LEFT JOIN public.challenges c ON c.season_id=s.id LEFT JOIN public.profiles cp ON cp.id=c.owner_id
    WHERE e.user_id=uid
  ) history;
  RETURN res;
END $$;

CREATE TABLE IF NOT EXISTS public.challenge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK(event_type IN ('surrender','perfect_day','streak','boss','crew_all_in','challenge_complete')),
  event_key text NOT NULL,
  day date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id,event_key)
);
ALTER TABLE public.challenge_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.challenge_events FROM anon,authenticated;
GRANT SELECT ON public.challenge_events TO authenticated;
GRANT ALL ON public.challenge_events TO service_role;
CREATE INDEX IF NOT EXISTS challenge_events_season_day ON public.challenge_events(season_id,day DESC);

CREATE OR REPLACE FUNCTION public.surrender_challenge(_season_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); e public.season_entries; s public.seasons; p public.profiles; crew uuid; points int; done int; perfect int; days int; won boolean;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO e FROM public.season_entries WHERE user_id=uid AND season_id=_season_id FOR UPDATE;
  IF NOT FOUND OR e.status<>'active' THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  SELECT * INTO s FROM public.seasons WHERE id=_season_id;
  SELECT * INTO p FROM public.profiles WHERE id=uid;
  PERFORM public._finalize_user_day(uid,_season_id,public._local_today(uid));
  SELECT cm.crew_id INTO crew FROM public.crew_members cm JOIN public.crews cr ON cr.id=cm.crew_id WHERE cm.user_id=uid AND cr.season_id=_season_id LIMIT 1;
  SELECT coalesce(sum(total),0)::int,count(*) FILTER(WHERE completion>=0.6)::int,count(*) FILTER(WHERE completion=1)::int
    INTO points,done,perfect FROM public.daily_scores WHERE user_id=uid AND season_id=_season_id;
  days:=greatest(1,least(s.ends_on,public._local_today(uid))-greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date)+1);
  won:=done>=ceil((s.ends_on-s.starts_on+1)*0.75);
  INSERT INTO public.season_results(user_id,season_id,score,daily_points,boss_points,rank_country,rank_world,rank_crew,rank_challenge,crew_id,perfect_days,best_streak,active_days,completed_days,consistency_percent,trophy,trophy_private,participation_kind,participation_status,is_demo)
  VALUES(uid,_season_id,points,points,0,NULL,NULL,NULL,NULL,crew,perfect,coalesce((SELECT max(streak) FROM public.daily_scores WHERE user_id=uid AND season_id=_season_id),0),done,done,round(100.0*done/days,1),won,e.kind='personal',e.kind,'surrendered',e.is_demo)
  ON CONFLICT(user_id,season_id) DO NOTHING;
  UPDATE public.season_entries SET status='surrendered',ended_at=now(),end_reason='user_surrendered' WHERE user_id=uid AND season_id=_season_id;
  DELETE FROM public.crew_members cm USING public.crews cr WHERE cm.crew_id=cr.id AND cm.user_id=uid AND cr.season_id=_season_id;
  DELETE FROM public.challenge_squad_members m USING public.challenge_squads q JOIN public.challenges c ON c.id=q.challenge_id WHERE m.squad_id=q.id AND m.user_id=uid AND c.season_id=_season_id;
  UPDATE public.user_preferences SET active_challenge_id=NULL WHERE user_id=uid;
  INSERT INTO public.challenge_events(season_id,user_id,event_type,event_key,day,is_demo,payload)
  VALUES(_season_id,uid,'surrender','surrender:'||uid::text,public._local_today(uid),e.is_demo,jsonb_build_object('handle',p.handle,'crew_id',crew)) ON CONFLICT(season_id,event_key) DO NOTHING;
  RETURN jsonb_build_object('status','surrendered','points',points,'crew_id',crew,'completed_days',done,'perfect_days',perfect,'consistency',round(100.0*done/days,1),'trophy',won);
END $$;

CREATE TABLE IF NOT EXISTS public.challenge_event_reactions (
  event_id uuid NOT NULL REFERENCES public.challenge_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,user_id)
);
ALTER TABLE public.challenge_event_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.challenge_event_reactions FROM anon,authenticated;
GRANT ALL ON public.challenge_event_reactions TO service_role;

CREATE OR REPLACE FUNCTION public.toggle_challenge_respect(_event_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); ev public.challenge_events; removed boolean:=false;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO ev FROM public.challenge_events WHERE id=_event_id;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=ev.season_id AND status IN ('active','completed')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.challenge_event_reactions WHERE event_id=_event_id AND user_id=uid;
  IF NOT FOUND THEN INSERT INTO public.challenge_event_reactions(event_id,user_id) VALUES(_event_id,uid); RETURN true; END IF;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.challenge_feed(_season_id uuid,_scope text DEFAULT 'challenge') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); res jsonb;
BEGIN
  IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=_season_id AND status IN ('active','completed')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _scope NOT IN ('challenge','crew') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  SELECT coalesce(jsonb_agg(row ORDER BY created_at DESC),'[]'::jsonb) INTO res FROM (
    SELECT e.created_at,jsonb_build_object('id',e.id,'type',e.event_type,'user_id',e.user_id,'handle',p.handle,'display_name',p.display_name,'avatar_url',p.avatar_url,'day',e.day,'payload',e.payload,'respects',(SELECT count(*) FROM public.challenge_event_reactions r WHERE r.event_id=e.id),'mine',EXISTS(SELECT 1 FROM public.challenge_event_reactions r WHERE r.event_id=e.id AND r.user_id=uid)) row
    FROM public.challenge_events e LEFT JOIN public.profiles p ON p.id=e.user_id
    WHERE e.season_id=_season_id AND e.is_demo=(SELECT is_demo FROM public.profiles WHERE id=uid)
      AND (_scope='challenge' OR e.user_id IN(SELECT cm.user_id FROM public.crew_members cm WHERE cm.crew_id IN(SELECT crew_id FROM public.crew_members WHERE user_id=uid)))
      AND (e.user_id=uid OR NOT EXISTS(SELECT 1 FROM public.user_habits h JOIN public.habit_templates t ON t.id=h.template_id WHERE h.user_id=e.user_id AND h.season_id=e.season_id AND t.is_faith) OR coalesce(p.faith_public,false))
  ) feed;
  RETURN res;
END $$;

-- Keep the point/rank snapshots private where the participation is personal.
CREATE OR REPLACE FUNCTION public._freeze_season(_sid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.seasons; r record;
BEGIN
  SELECT * INTO s FROM public.seasons WHERE id=_sid FOR UPDATE;
  IF NOT FOUND OR s.frozen_at IS NOT NULL THEN RETURN; END IF;
  FOR r IN SELECT e.user_id FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.season_id=_sid LOOP
    PERFORM public._finalize_user_day(r.user_id,_sid,s.ends_on);
  END LOOP;
  UPDATE public.season_entries SET status='completed',ended_at=coalesce(ended_at,now()),end_reason='challenge_ended' WHERE season_id=_sid AND status='active';
  INSERT INTO public.season_results(user_id,season_id,score,daily_points,boss_points,rank_country,rank_world,rank_crew,rank_challenge,crew_id,perfect_days,best_streak,active_days,completed_days,consistency_percent,trophy,trophy_private,participation_kind,participation_status,is_demo)
  WITH base AS (
    SELECT e.user_id,e.kind,e.status,p.country_code,p.is_demo,e.joined_at,
      coalesce((SELECT sum(total) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid AND ds.day BETWEEN s.starts_on AND s.ends_on),0)::int daily,
      coalesce((SELECT sum(points) FROM public.bonus_points bp WHERE bp.user_id=e.user_id AND bp.season_id=_sid),0)::int boss,
      (SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid AND ds.perfect AND ds.day BETWEEN s.starts_on AND s.ends_on)::int perfect,
      coalesce((SELECT max(streak) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid),0)::int best,
      (SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid AND ds.completion>=0.6 AND ds.day BETWEEN s.starts_on AND s.ends_on)::int active,
      (SELECT cm.crew_id FROM public.crew_members cm JOIN public.crews c ON c.id=cm.crew_id WHERE cm.user_id=e.user_id AND c.season_id=_sid LIMIT 1) crew
    FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.season_id=_sid AND p.account_status='active'
  ), ranked AS (
    SELECT b.*,row_number() OVER(PARTITION BY is_demo,country_code ORDER BY CASE WHEN kind='official' THEN 0 ELSE 1 END,daily+boss DESC,best DESC,joined_at,user_id) country_rank,
      row_number() OVER(PARTITION BY is_demo ORDER BY CASE WHEN kind='official' THEN 0 ELSE 1 END,daily+boss DESC,best DESC,joined_at,user_id) world_rank,
      row_number() OVER(PARTITION BY is_demo,kind ORDER BY daily+boss DESC,best DESC,joined_at,user_id) challenge_rank,
      CASE WHEN crew IS NOT NULL THEN row_number() OVER(PARTITION BY crew ORDER BY daily+boss DESC,best DESC,joined_at,user_id) END crew_rank
    FROM base b WHERE status<>'surrendered' AND kind<>'personal'
  )
  SELECT b.user_id,_sid,b.daily+b.boss,b.daily,b.boss,
    CASE WHEN b.kind='official' AND b.status<>'surrendered' THEN r.country_rank END,
    CASE WHEN b.kind='official' AND b.status<>'surrendered' THEN r.world_rank END,
    CASE WHEN b.kind<>'personal' AND b.status<>'surrendered' THEN r.crew_rank END,
    CASE WHEN b.kind<>'personal' AND b.status<>'surrendered' THEN r.challenge_rank END,
    b.crew,b.perfect,b.best,b.active,b.active,round(100.0*b.active/greatest(1,s.ends_on-s.starts_on+1),1),
    b.active>=ceil((s.ends_on-s.starts_on+1)*0.75),b.kind='personal',b.kind,b.status,b.is_demo
  FROM base b LEFT JOIN ranked r ON r.user_id=b.user_id
  ON CONFLICT(user_id,season_id) DO NOTHING;
  INSERT INTO public.crew_results(crew_id,season_id,name,score,rank,members,is_demo)
  SELECT c.id,_sid,c.name,coalesce(sum(r.score),0)::int,row_number() OVER(PARTITION BY c.is_demo ORDER BY coalesce(sum(r.score),0) DESC,c.created_at,c.id),count(r.user_id)::int,c.is_demo
  FROM public.crews c LEFT JOIN public.season_results r ON r.crew_id=c.id AND r.season_id=_sid AND r.participation_status<>'surrendered'
  WHERE c.season_id=_sid AND c.kind<>'duo' GROUP BY c.id,c.name,c.is_demo,c.created_at ON CONFLICT DO NOTHING;
  INSERT INTO public.season_trophies(user_id,season_id,is_demo,is_private)
  SELECT user_id,_sid,is_demo,trophy_private FROM public.season_results WHERE season_id=_sid AND trophy ON CONFLICT DO NOTHING;
  INSERT INTO public.challenge_events(season_id,event_type,event_key,day,is_demo,payload)
  SELECT _sid,'challenge_complete','challenge-complete:'||_sid::text,s.ends_on,s.is_demo,jsonb_build_object('name',s.name)
  WHERE EXISTS(SELECT 1 FROM public.season_entries WHERE season_id=_sid) ON CONFLICT DO NOTHING;
  UPDATE public.seasons SET frozen_at=now() WHERE id=_sid;
END $$;

CREATE OR REPLACE FUNCTION public.my_season_result(_season_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT to_jsonb(r) FROM public.season_results r WHERE r.user_id=auth.uid() AND r.season_id=_season_id
$$;

CREATE OR REPLACE FUNCTION public.admin_set_challenge_habits(_season_id uuid,_habits jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.seasons; item jsonb; pos integer:=0; tpl public.habit_templates;
BEGIN
  PERFORM public._guest_guard();
  PERFORM public._require_admin();
  SELECT * INTO s FROM public.seasons WHERE id=_season_id AND NOT challenge_owned FOR UPDATE;
  IF NOT FOUND OR s.frozen_at IS NOT NULL OR jsonb_typeof(_habits)<>'array' OR jsonb_array_length(_habits) NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'invalid_challenge_habits'; END IF;
  IF s.starts_on<public._local_today(auth.uid()) THEN RAISE EXCEPTION 'challenge_started'; END IF;
  DELETE FROM public.challenge_habits WHERE season_id=_season_id;
  FOR item IN SELECT value FROM jsonb_array_elements(_habits) LOOP
    SELECT * INTO tpl FROM public.habit_templates WHERE key=item->>'key' AND NOT archived;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_habit'; END IF;
    INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,rule,is_faith,position,is_demo)
    VALUES(_season_id,tpl.id,tpl.key,tpl.name,tpl.what_counts,tpl.kind,coalesce((item->>'target')::numeric,tpl.default_target),tpl.unit,coalesce(item->'rule','{}'::jsonb),tpl.is_faith,pos,s.is_demo);
    pos:=pos+1;
  END LOOP;
  PERFORM public._admin_audit('save_challenge_habits',_season_id::text,jsonb_build_object('count',pos));
END $$;

REVOKE ALL ON FUNCTION public.join_season(uuid,text),public.join_challenge(text),public.surrender_challenge(uuid),public.create_personal_challenge(text,integer,jsonb),public.toggle_challenge_respect(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_season(uuid,text),public.join_challenge(text),public.surrender_challenge(uuid),public.create_personal_challenge(text,integer,jsonb),public.toggle_challenge_respect(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.challenge_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.challenge_preview(text) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.my_challenge_history(),public.challenge_scoreboard(uuid,text,text),public.challenge_feed(uuid,text),public.active_season(),public.activate_challenge(uuid),public.my_season_result(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_challenge_history(),public.challenge_scoreboard(uuid,text,text),public.challenge_feed(uuid,text),public.active_season(),public.activate_challenge(uuid),public.my_season_result(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_challenge_habits(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_challenge_habits(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public._rank_rows(uuid,text,text,text,date,uuid),public._freeze_season(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._rank_rows(uuid,text,text,text,date,uuid),public._freeze_season(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.create_challenge(text,text,integer,text,boolean,text[],boolean,boolean,boolean,date) FROM PUBLIC,anon,authenticated;
