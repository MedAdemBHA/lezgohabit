-- Official events are drafted and published independently of their date-derived state.
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_goal jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public._can_read_private_season(_season uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.season_entries e WHERE e.season_id=_season AND e.user_id=auth.uid())
    OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.season_id=_season AND c.owner_id=auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_admin)
  )
$$;
REVOKE ALL ON FUNCTION public._can_read_private_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._can_read_private_season(uuid) TO anon,authenticated;

DROP POLICY IF EXISTS "seasons public" ON public.seasons;
CREATE POLICY "seasons public" ON public.seasons FOR SELECT TO anon, authenticated
  USING (
    (published AND NOT archived AND NOT is_demo AND NOT challenge_owned)
    OR public._can_read_private_season(id)
  );

CREATE OR REPLACE FUNCTION public._event_today() RETURNS date
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (now() AT TIME ZONE 'Africa/Tunis')::date
$$;

CREATE OR REPLACE FUNCTION public._guard_official_event_edits() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.challenge_owned OR OLD.is_demo THEN RETURN NEW; END IF;
  IF OLD.published AND OLD.starts_on <= public._event_today()
     AND (NEW.starts_on IS DISTINCT FROM OLD.starts_on OR NEW.ends_on IS DISTINCT FROM OLD.ends_on OR NOT NEW.published)
  THEN RAISE EXCEPTION 'event_rules_locked'; END IF;
  IF NEW.archived AND NOT OLD.archived AND EXISTS (
    SELECT 1 FROM public.season_entries e WHERE e.season_id=OLD.id AND e.status='active'
  ) THEN RAISE EXCEPTION 'event_has_active_players'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS official_event_edit_guard ON public.seasons;
CREATE TRIGGER official_event_edit_guard BEFORE UPDATE ON public.seasons
FOR EACH ROW EXECUTE FUNCTION public._guard_official_event_edits();

CREATE OR REPLACE FUNCTION public._guard_official_enrollment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.seasons; d date := public._event_today();
BEGIN
  IF auth.uid() IS NULL OR NEW.kind <> 'official' OR NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND OLD.season_id = NEW.season_id THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.seasons WHERE id = NEW.season_id FOR SHARE;
  IF s.is_demo THEN RETURN NEW; END IF;
  IF s.archived OR NOT s.published THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF s.frozen_at IS NOT NULL OR s.status = 'ended' OR s.ends_on < d THEN RAISE EXCEPTION 'challenge_ended'; END IF;
  IF s.starts_on > d THEN RAISE EXCEPTION 'challenge_not_started'; END IF;
  IF (SELECT count(*) FROM public.challenge_habits WHERE season_id=s.id) NOT BETWEEN 1 AND 6
  THEN RAISE EXCEPTION 'challenge_not_ready'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS official_enrollment_guard ON public.season_entries;
CREATE TRIGGER official_enrollment_guard BEFORE INSERT OR UPDATE OF status,season_id ON public.season_entries
FOR EACH ROW EXECUTE FUNCTION public._guard_official_enrollment();

-- Keep the stored status used by older game features in sync at the next integrity tick.
CREATE OR REPLACE FUNCTION public.integrity_tick() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE purged int; swaps int;
BEGIN
  UPDATE public.seasons SET status='live'
  WHERE status='upcoming' AND published AND NOT archived AND NOT is_demo
    AND public._event_today() BETWEEN starts_on AND ends_on;
  DELETE FROM public.guest_sessions WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS purged = ROW_COUNT;
  DELETE FROM public.demo_login_limits WHERE window_start < now() - interval '1 day';
  swaps := public.apply_due_habit_swaps();
  RETURN jsonb_build_object('finalized',public.finalize_due_days(),'frozen',public.freeze_due_seasons(),'guests_purged',purged,'swaps',swaps);
END $$;

CREATE OR REPLACE FUNCTION public.admin_official_events() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',s.id,'name',s.name,'goal',s.event_goal,'starts_on',s.starts_on,'ends_on',s.ends_on,
      'color',s.theme_color,'published',s.published,'archived',s.archived,
      'state',CASE WHEN s.archived THEN 'archived' WHEN NOT s.published THEN 'draft'
        WHEN s.status='ended' OR s.ends_on<public._event_today() THEN 'ended'
        WHEN s.starts_on>public._event_today() THEN 'upcoming' ELSE 'live' END,
      'members',(SELECT count(*) FROM public.season_entries e WHERE e.season_id=s.id),
      'completed',(SELECT count(*) FROM public.season_entries e WHERE e.season_id=s.id AND e.status='completed'),
      'left',(SELECT count(*) FROM public.season_entries e WHERE e.season_id=s.id AND e.status='surrendered'),
      'today',(SELECT count(*) FROM public.season_entries e JOIN public.daily_scores d
        ON d.season_id=e.season_id AND d.user_id=e.user_id AND d.day=public._local_today(e.user_id)
        WHERE e.season_id=s.id AND e.status='active' AND d.completion>=0.6),
      'habits',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',h.habit_key,'name',h.name,'target',h.target,
        'unit',h.unit,'kind',h.kind,'rule',h.rule,'what_counts',h.what_counts) ORDER BY h.position),'[]'::jsonb)
        FROM public.challenge_habits h WHERE h.season_id=s.id)
    ) ORDER BY s.starts_on DESC,s.id) FROM public.seasons s WHERE NOT s.challenge_owned AND NOT s.is_demo),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public._event_target_copy(_copy jsonb,_before numeric,_after numeric) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE WHEN _before IS NULL OR _before=_after THEN _copy ELSE coalesce((
    SELECT jsonb_object_agg(key, regexp_replace(value,
      '(?<![0-9.,])'||replace(trim_scale(_before)::text,'.','[.,]')||'(?![0-9.,])',
      replace(trim_scale(_after)::text,'.',CASE WHEN key='fr' THEN ',' ELSE '.' END),'g'))
    FROM jsonb_each_text(_copy)
  ),'{}'::jsonb) END
$$;
REVOKE ALL ON FUNCTION public._event_target_copy(jsonb,numeric,numeric) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_official_event(_id uuid, _event jsonb, _habits jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid := coalesce(_id,gen_random_uuid()); s public.seasons; habit jsonb;
  tpl public.habit_templates; pos integer:=0; target numeric; event_name jsonb:=_event->'name';
  goal jsonb:=coalesce(_event->'goal','{}'::jsonb); start_date date:=(_event->>'starts_on')::date;
  end_date date:=(_event->>'ends_on')::date; color text:=_event->>'color';
  publish boolean:=coalesce((_event->>'published')::boolean,false); d date:=public._event_today();
BEGIN
  PERFORM public._guest_guard();
  PERFORM public._require_admin();
  IF jsonb_typeof(event_name) IS DISTINCT FROM 'object'
     OR jsonb_typeof(goal) IS DISTINCT FROM 'object' OR length(trim(coalesce(event_name->>'en',''))) NOT BETWEEN 1 AND 60
     OR EXISTS (SELECT 1 FROM jsonb_each_text(event_name) x WHERE x.key NOT IN ('en','fr','ar','aeb') OR length(x.value)>60)
     OR EXISTS (SELECT 1 FROM jsonb_each_text(goal) x WHERE x.key NOT IN ('en','fr','ar','aeb') OR length(x.value)>280)
     OR start_date IS NULL OR end_date IS NULL OR end_date < start_date
     OR color IS NULL OR (color NOT IN ('blue','pink','purple','orange','lime','teal','yellow') AND color !~ '^#[A-Fa-f0-9]{6}$')
  THEN RAISE EXCEPTION 'invalid_event'; END IF;

  IF _id IS NOT NULL THEN
    SELECT * INTO s FROM public.seasons WHERE id=sid AND NOT challenge_owned AND NOT is_demo AND NOT archived FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
    IF s.published AND (s.starts_on<=d OR EXISTS(SELECT 1 FROM public.season_entries WHERE season_id=sid)) THEN
      IF _habits IS NOT NULL OR start_date<>s.starts_on OR end_date<>s.ends_on OR NOT publish
      THEN RAISE EXCEPTION 'event_rules_locked'; END IF;
      UPDATE public.seasons SET name=event_name,event_goal=goal,theme_color=color WHERE id=sid;
      PERFORM public._admin_audit('edit_official_event',sid::text,jsonb_build_object('published',true));
      RETURN sid;
    END IF;
  END IF;

  IF start_date<d OR jsonb_typeof(_habits) IS DISTINCT FROM 'array' OR jsonb_array_length(_habits) > 6 OR (publish AND jsonb_array_length(_habits)<1)
     OR (SELECT count(DISTINCT x->>'key') FROM jsonb_array_elements(_habits) x) <> jsonb_array_length(_habits)
  THEN RAISE EXCEPTION 'invalid_event_habits'; END IF;

  IF _id IS NULL THEN
    INSERT INTO public.seasons(id,slug,name,event_goal,starts_on,ends_on,status,theme_color,published)
    VALUES(sid,'event-'||sid::text,event_name,goal,start_date,end_date,
      CASE WHEN publish AND start_date=d THEN 'live' ELSE 'upcoming' END,color,publish);
  ELSE
    UPDATE public.seasons SET name=event_name,event_goal=goal,starts_on=start_date,ends_on=end_date,
      status=CASE WHEN publish AND start_date=d THEN 'live' ELSE 'upcoming' END, theme_color=color,published=publish WHERE id=sid;
  END IF;

  DELETE FROM public.challenge_habits WHERE season_id=sid;
  FOR habit IN SELECT value FROM jsonb_array_elements(_habits) LOOP
    SELECT * INTO tpl FROM public.habit_templates WHERE key=habit->>'key' AND NOT archived AND key<>'custom';
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_habit'; END IF;
    target:=coalesce((habit->>'target')::numeric,tpl.default_target);
    IF target IS NULL OR NOT (target BETWEEN 0.001 AND 1000000)
       OR (tpl.kind NOT IN ('count','timer') AND target<>tpl.default_target) THEN RAISE EXCEPTION 'invalid_target'; END IF;
    INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,rule,is_faith,position,is_demo)
    VALUES(sid,tpl.id,tpl.key,public._event_target_copy(tpl.name,tpl.default_target,target),
      public._event_target_copy(coalesce(nullif(tpl.what_counts,'{}'::jsonb),tpl.description),tpl.default_target,target),
      tpl.kind,target,tpl.unit,
      coalesce(habit->'rule',tpl.default_rule,'{}'::jsonb),tpl.is_faith,pos,false);
    pos:=pos+1;
  END LOOP;
  PERFORM public._admin_audit(CASE WHEN _id IS NULL THEN 'create_official_event' ELSE 'edit_official_event' END,
    sid::text,jsonb_build_object('published',publish,'habits',pos));
  RETURN sid;
END $$;

REVOKE ALL ON FUNCTION public._guard_official_event_edits(),public._guard_official_enrollment() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_official_events(),public.admin_save_official_event(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_official_events(),public.admin_save_official_event(uuid,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.public_challenge_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(card ORDER BY order_group,starts_on,created_at),'[]'::jsonb)
  FROM (
    SELECT
      CASE WHEN s.challenge_owned THEN 2 ELSE CASE WHEN s.starts_on<=public._event_today() THEN 0 ELSE 1 END END order_group,
      s.starts_on,
      coalesce(c.created_at,s.starts_on::timestamp AT TIME ZONE 'UTC') created_at,
      jsonb_build_object(
        'id',s.id,
        'season_id',s.id,
        'challenge_id',c.id,
        'kind',CASE WHEN s.challenge_owned THEN 'creator' ELSE 'official' END,
        'name',CASE WHEN s.challenge_owned THEN jsonb_build_object('en',c.name,'fr',c.name,'ar',c.name,'aeb',c.name) ELSE s.name END,
        'creator',CASE WHEN s.challenge_owned THEN p.handle ELSE 'Lezgo' END,
        'code',c.code,
        'days',s.ends_on-s.starts_on+1,
        'starts_on',s.starts_on,
        'ends_on',s.ends_on,
        'status',CASE WHEN s.starts_on<=public._event_today() THEN 'live' ELSE 'upcoming' END,
        'goal',s.event_goal,
        'color',s.theme_color,
        'members',(SELECT count(*) FROM public.season_entries e WHERE e.season_id=s.id AND e.status IN ('active','completed')),
        'habits',coalesce((SELECT jsonb_agg(jsonb_build_object('key',h.habit_key,'name',h.name,'what_counts',h.what_counts,'kind',h.kind,'target',h.target,'unit',h.unit,'is_faith',h.is_faith) ORDER BY h.position) FROM public.challenge_habits h WHERE h.season_id=s.id),'[]'::jsonb)
      ) card
    FROM public.seasons s
    LEFT JOIN public.challenges c ON c.season_id=s.id
    LEFT JOIN public.profiles p ON p.id=c.owner_id
    WHERE s.is_demo=false AND s.published AND NOT s.archived AND s.ends_on>=public._event_today() AND s.status IN ('live','upcoming')
      AND (SELECT count(*) FROM public.challenge_habits h WHERE h.season_id=s.id) BETWEEN 1 AND 6
      AND (
        (NOT s.challenge_owned AND (c.id IS NULL OR c.audience<>'creator'))
        OR (s.challenge_owned AND c.id IS NOT NULL AND c.audience='creator' AND c.public_board AND c.approved AND c.featured AND NOT c.archived AND NOT c.is_demo)
      )
  ) catalog;
$$;
REVOKE ALL ON FUNCTION public.public_challenge_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_challenge_catalog() TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.crew_invite_preview(_code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('name',c.name,'event',s.name,'starts_on',s.starts_on,'ends_on',s.ends_on,
    'full',(SELECT count(*) FROM public.crew_members m WHERE m.crew_id=c.id)>=c.max_members,
    'ended',s.frozen_at IS NOT NULL OR s.status='ended' OR s.ends_on<public._event_today())
  FROM public.crews c JOIN public.seasons s ON s.id=c.season_id
  WHERE c.code=upper(trim(_code)) AND c.kind<>'duo' AND NOT c.archived AND NOT c.is_demo
    AND NOT s.archived AND s.published AND NOT s.is_demo
    AND (NOT s.challenge_owned OR EXISTS(SELECT 1 FROM public.challenges ch WHERE ch.season_id=s.id
      AND ch.audience<>'solo' AND ch.approved AND NOT ch.archived))
$$;
REVOKE ALL ON FUNCTION public.crew_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crew_invite_preview(text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.freeze_due_seasons() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE s record; n integer:=0;
BEGIN
 FOR s IN SELECT id FROM public.seasons WHERE frozen_at IS NULL AND published AND NOT archived AND NOT is_demo AND now()>=((ends_on+1)::timestamp AT TIME ZONE 'Africa/Tunis')+interval '3 hours' LOOP
  PERFORM public._freeze_season(s.id); n:=n+1;
 END LOOP;
 RETURN n;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_set_challenge_habits(_season_id uuid,_habits jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.seasons; item jsonb; pos integer:=0; tpl public.habit_templates;
BEGIN
  PERFORM public._guest_guard();
  PERFORM public._require_admin();
  SELECT * INTO s FROM public.seasons WHERE id=_season_id AND NOT challenge_owned FOR UPDATE;
  IF NOT FOUND OR s.frozen_at IS NOT NULL OR jsonb_typeof(_habits)<>'array' OR jsonb_array_length(_habits) NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'invalid_challenge_habits'; END IF;
  IF s.published AND s.starts_on<=public._event_today() OR EXISTS(
    SELECT 1 FROM public.season_entries WHERE season_id=s.id
  ) THEN RAISE EXCEPTION 'challenge_started'; END IF;
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
