ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS done_at timestamptz;
ALTER TABLE public.day_extras ADD COLUMN IF NOT EXISTS chaos_at timestamptz;
ALTER TABLE public.user_habits ADD COLUMN IF NOT EXISTS starts_on date, ADD COLUMN IF NOT EXISTS ends_on date, ADD COLUMN IF NOT EXISTS swapped_from uuid;

CREATE OR REPLACE FUNCTION public._habit_completion(_kind text, _target numeric, _value numeric, _detail jsonb)
 RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  select case
    when coalesce((_detail->>'held')::boolean, false) then 0
    when _kind = 'salat' then least(1, coalesce((
        select sum(case e.v when 'on_time' then 1 when 'late' then 0.5 else 0 end)
        from jsonb_each_text(coalesce(_detail->'prayers', '{}'::jsonb)) as e(k, v)), 0) / 5.0)
    when _kind = 'count' then least(1, greatest(0, coalesce(_value, 0) / nullif(_target, 0)))
    else case when coalesce(_value, 0) > 0 then 1 else 0 end
  end
$function$;

CREATE TABLE public.point_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  checkin_id uuid NOT NULL,
  user_habit_id uuid NOT NULL,
  season_id uuid NOT NULL,
  day date NOT NULL,
  reason text NOT NULL,
  value numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','removed')),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz
);
GRANT ALL ON public.point_reviews TO service_role;
ALTER TABLE public.point_reviews ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX point_reviews_pending_one ON public.point_reviews(checkin_id) WHERE status='pending';

CREATE OR REPLACE FUNCTION public.checkin_upsert(_user_habit_id uuid, _value numeric, _detail jsonb DEFAULT NULL::jsonb, _day date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); h record; d date; r jsonb; ex record; tk text; comp numeric; v_done timestamptz; v_detail jsonb; reason text; n int; cid uuid; was_held boolean := false;
BEGIN PERFORM public._guest_guard();
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into h from public.user_habits where id = _user_habit_id and user_id = uid;
  if not found then raise exception 'habit_not_found'; end if;
  if h.kind = 'salat' then raise exception 'use_mark_prayer'; end if;
  d := coalesce(_day, public._local_today(uid));
  perform public._check_day_window(uid, d);
  if _value is null or _value < 0 or _value > 1000000 then raise exception 'bad_value'; end if;
  select key into tk from public.habit_templates where id = h.template_id;
  select * into ex from public.checkins where user_habit_id = _user_habit_id and day = d;
  if found then
    was_held := coalesce((ex.detail->>'held')::boolean, false)
      AND EXISTS (SELECT 1 FROM public.point_reviews WHERE checkin_id = ex.id AND status = 'pending');
    if ex.done_at is not null and ex.done_at < now() - interval '10 minutes' then
      if not (h.kind = 'count' and _value >= ex.value) then raise exception 'habit_locked'; end if;
    end if;
  end if;
  v_detail := coalesce(_detail, '{}'::jsonb) - 'held' - 'prayers' - 'marked_at';
  reason := case when tk = 'steps' and _value > 60000 then 'steps'
                 when tk = 'water' and _value > 6 then 'water'
                 when tk = 'run' and _value > 50 then 'run'
                 when tk = 'read' and _value > 300 then 'read' end;
  select count(*) into n from public.activity_events where user_id = uid and kind = 'checkin' and created_at > now() - interval '1 minute';
  if reason is null and n >= 40 then reason := 'burst'; end if;
  if reason is not null or was_held then v_detail := v_detail || '{"held":true}'::jsonb; end if;
  comp := public._habit_completion(h.kind, h.target, _value, v_detail - 'held');
  v_done := case when comp >= 1 then coalesce(ex.done_at, now()) else null end;
  insert into public.checkins (user_id, user_habit_id, day, value, detail, done_at)
  values (uid, _user_habit_id, d, _value, v_detail, v_done)
  on conflict (user_habit_id, day) do update set value = excluded.value, detail = excluded.detail, done_at = excluded.done_at, created_at = now()
  returning id into cid;
  if reason is not null then
    insert into public.point_reviews (user_id, checkin_id, user_habit_id, season_id, day, reason, value, is_demo)
    values (uid, cid, _user_habit_id, h.season_id, d, reason, _value, h.is_demo)
    on conflict (checkin_id) where status = 'pending' do update set reason = excluded.reason, value = excluded.value;
  elsif was_held then
    update public.point_reviews set value = _value where checkin_id = cid and status = 'pending';
  end if;
  perform public._recompute_with_crew(uid, h.season_id, d);
  select to_jsonb(ds) into r from public.daily_scores ds where user_id = uid and season_id = h.season_id and day = d;
  return coalesce(r, '{}'::jsonb) || jsonb_build_object('done_at', v_done, 'held', reason is not null or was_held);
end $function$;

CREATE OR REPLACE FUNCTION public.set_chaos_done(_season_id uuid, _done boolean, _day date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); d date; r jsonb; ex record;
BEGIN PERFORM public._guest_guard();
  if uid is null then raise exception 'not_authenticated'; end if;
  d := coalesce(_day, public._local_today(uid));
  perform public._check_day_window(uid, d);
  select * into ex from public.day_extras where user_id = uid and day = d;
  if found and ex.chaos_done and not _done and coalesce(ex.chaos_at, now()) < now() - interval '10 minutes' then
    raise exception 'habit_locked';
  end if;
  insert into public.day_extras (user_id, day, chaos_done, chaos_at) values (uid, d, _done, case when _done then now() end)
  on conflict (user_id, day) do update set chaos_done = excluded.chaos_done,
    chaos_at = case when excluded.chaos_done then coalesce(public.day_extras.chaos_at, now()) else null end;
  perform public.recompute_day(uid, _season_id, d);
  select to_jsonb(ds) into r from public.daily_scores ds where user_id = uid and season_id = _season_id and day = d;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_lift_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND coalesce(current_setting('lezgo.final_override', true), '') <> 'on'
     AND OLD.created_at < now() - interval '10 minutes'
     AND (TG_OP = 'DELETE' OR NEW.weight IS DISTINCT FROM OLD.weight OR NEW.reps IS DISTINCT FROM OLD.reps
          OR NEW.unit IS DISTINCT FROM OLD.unit OR NEW.exercise_id IS DISTINCT FROM OLD.exercise_id) THEN
    RAISE EXCEPTION 'habit_locked';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lift_undo_lock ON public.lift_sets;
CREATE TRIGGER lift_undo_lock BEFORE UPDATE OR DELETE ON public.lift_sets FOR EACH ROW EXECUTE FUNCTION public.guard_lift_lock();

CREATE OR REPLACE FUNCTION public.revoke_removed_proof()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND NOT (NEW.hidden AND NOT OLD.hidden) THEN RETURN NEW; END IF;
 -- A user's own deletion only takes the +10 back inside the 10-minute undo window; moderation removal always does while the day is open.
 IF TG_OP='DELETE' AND auth.uid() = OLD.user_id AND OLD.created_at < now() - interval '10 minutes' THEN RETURN OLD; END IF;
 IF EXISTS(SELECT 1 FROM public.day_extras WHERE user_id=OLD.user_id AND day=OLD.day AND proof_post_id=OLD.id) AND NOT public._day_is_final(OLD.user_id,OLD.day) THEN
  UPDATE public.day_extras SET proof_posted=false,proof_post_id=NULL WHERE user_id=OLD.user_id AND day=OLD.day;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id=OLD.user_id) THEN PERFORM public._recompute_with_crew(OLD.user_id,OLD.season_id,OLD.day); END IF;
 END IF;
 RETURN coalesce(NEW,OLD);
END $function$;

CREATE OR REPLACE FUNCTION public._habits_frozen(_user uuid, _season uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((
    SELECT public._local_today(_user) - greatest(s.starts_on, (e.joined_at AT TIME ZONE coalesce(public._effective_tz(_user),'Africa/Tunis'))::date) >= 2
    FROM public.seasons s JOIN public.season_entries e ON e.season_id = s.id AND e.user_id = _user WHERE s.id = _season), false)
$$;
GRANT EXECUTE ON FUNCTION public._habits_frozen(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_habit_freeze() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce(current_setting('lezgo.habit_rpc', true), '') = 'on' THEN RETURN NEW; END IF;
  IF NOT public._habits_frozen(NEW.user_id, NEW.season_id) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.active AND EXISTS (SELECT 1 FROM public.user_habits WHERE user_id = NEW.user_id AND season_id = NEW.season_id AND active) THEN
      RAISE EXCEPTION 'habits_frozen';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.active IS DISTINCT FROM NEW.active THEN RAISE EXCEPTION 'habits_frozen'; END IF;
  IF NEW.target < OLD.target THEN RAISE EXCEPTION 'target_locked'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS habit_freeze_guard ON public.user_habits;
CREATE TRIGGER habit_freeze_guard BEFORE INSERT OR UPDATE ON public.user_habits FOR EACH ROW EXECUTE FUNCTION public.guard_habit_freeze();

CREATE OR REPLACE FUNCTION public.swap_habit(_remove uuid, _template_id uuid, _custom_name text DEFAULT NULL, _target numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); old record; t record; today date; nid uuid;
BEGIN PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO old FROM public.user_habits WHERE id = _remove AND user_id = uid AND active AND ends_on IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit_not_found'; END IF;
  SELECT * INTO t FROM public.habit_templates WHERE id = _template_id AND NOT archived;
  IF NOT FOUND THEN RAISE EXCEPTION 'template_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_habits WHERE user_id = uid AND season_id = old.season_id AND swapped_from IS NOT NULL AND created_at > now() - interval '7 days') THEN
    RAISE EXCEPTION 'swap_limit';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_habits WHERE user_id = uid AND season_id = old.season_id AND template_id = _template_id AND (active OR starts_on IS NOT NULL) AND ends_on IS NULL AND t.key <> 'custom') THEN
    RAISE EXCEPTION 'already_picked';
  END IF;
  today := public._local_today(uid);
  PERFORM set_config('lezgo.habit_rpc', 'on', true);
  UPDATE public.user_habits SET ends_on = today WHERE id = old.id;
  INSERT INTO public.user_habits (user_id, season_id, template_id, custom_name, kind, target, unit, position, active, starts_on, swapped_from, is_demo)
  VALUES (uid, old.season_id, _template_id, CASE WHEN t.key = 'custom' THEN left(_custom_name, 40) END, t.kind, coalesce(_target, t.default_target), t.unit, old.position, false, today + 1, old.id, old.is_demo)
  RETURNING id INTO nid;
  PERFORM set_config('lezgo.habit_rpc', 'off', true);
  RETURN jsonb_build_object('id', nid, 'starts_on', today + 1);
END $$;
GRANT EXECUTE ON FUNCTION public.swap_habit(uuid, uuid, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_due_habit_swaps() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('lezgo.habit_rpc', 'on', true);
  UPDATE public.user_habits SET active = false WHERE active AND ends_on IS NOT NULL AND ends_on < public._local_today(user_id);
  UPDATE public.user_habits SET active = true WHERE NOT active AND swapped_from IS NOT NULL AND ends_on IS NULL AND starts_on <= public._local_today(user_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('lezgo.habit_rpc', 'off', true);
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.integrity_tick()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE purged int; swaps int;
BEGIN
 DELETE FROM public.guest_sessions WHERE created_at < now() - interval '7 days';
 GET DIAGNOSTICS purged = ROW_COUNT;
 DELETE FROM public.demo_login_limits WHERE window_start < now() - interval '1 day';
 swaps := public.apply_due_habit_swaps();
 RETURN jsonb_build_object('finalized',public.finalize_due_days(),'frozen',public.freeze_due_seasons(),'guests_purged',purged,'swaps',swaps);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_review_queue() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'handle', p.handle, 'display_name', p.display_name, 'day', r.day, 'reason', r.reason,
     'value', r.value, 'unit', h.unit, 'habit', coalesce(h.custom_name, t.name->>'en'), 'created_at', r.created_at, 'is_demo', r.is_demo) ORDER BY r.created_at)
   FROM public.point_reviews r JOIN public.profiles p ON p.id = r.user_id JOIN public.user_habits h ON h.id = r.user_habit_id
   LEFT JOIN public.habit_templates t ON t.id = h.template_id WHERE r.status = 'pending'), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_review_queue() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_points(_id uuid, _decision text, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; admin uuid;
BEGIN
  admin := public._require_admin();
  IF _decision NOT IN ('approve','remove') THEN RAISE EXCEPTION 'bad_decision'; END IF;
  IF coalesce(length(trim(_reason)), 0) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  SELECT * INTO r FROM public.point_reviews WHERE id = _id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM set_config('lezgo.final_override', 'on', true);
  IF _decision = 'approve' THEN
    UPDATE public.checkins SET detail = detail - 'held' WHERE id = r.checkin_id;
  ELSE
    UPDATE public.checkins SET value = 0, detail = detail - 'held', done_at = NULL WHERE id = r.checkin_id;
  END IF;
  UPDATE public.point_reviews SET status = CASE WHEN _decision = 'approve' THEN 'approved' ELSE 'removed' END, reviewed_by = admin, reviewed_at = now() WHERE id = _id;
  IF public._day_is_final(r.user_id, r.day) THEN
    PERFORM public.admin_recompute_final_day(r.user_id, r.season_id, r.day, 'point review: ' || _reason);
  ELSE
    PERFORM public._recompute_with_crew(r.user_id, r.season_id, r.day);
  END IF;
  PERFORM set_config('lezgo.final_override', 'off', true);
  PERFORM public._admin_audit('review_' || _decision, _id::text, jsonb_build_object('reason', _reason, 'user', r.user_id, 'day', r.day, 'value', r.value, 'flag', r.reason));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_review_points(uuid, text, text) TO authenticated;