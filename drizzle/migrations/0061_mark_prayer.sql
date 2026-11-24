-- Salat check-ins go through mark_prayer: the server, not the phone, decides "on time" vs "late"
-- from the cached city prayer times. A mark can be undone for 10 minutes, then it locks.
CREATE OR REPLACE FUNCTION public.mark_prayer(_user_habit_id uuid, _prayer text, _day date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid(); h record; ex record; d date; today date;
  names text[] := ARRAY['fajr','dhuhr','asr','maghrib','isha']; i int;
  pr jsonb; mk jsonb; v_times jsonb; t_now time; t_start time; t_end time; st text;
  val numeric; comp numeric; v_done timestamptz; r jsonb;
BEGIN PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  i := array_position(names, _prayer);
  IF i IS NULL THEN RAISE EXCEPTION 'bad_prayer'; END IF;
  SELECT * INTO h FROM public.user_habits WHERE id = _user_habit_id AND user_id = uid;
  IF NOT FOUND OR h.kind <> 'salat' THEN RAISE EXCEPTION 'habit_not_found'; END IF;
  today := public._local_today(uid);
  d := coalesce(_day, today);
  PERFORM public._check_day_window(uid, d);
  SELECT * INTO ex FROM public.checkins WHERE user_habit_id = _user_habit_id AND day = d FOR UPDATE;
  pr := coalesce(ex.detail->'prayers', '{}'::jsonb);
  mk := coalesce(ex.detail->'marked_at', '{}'::jsonb);
  IF pr ? _prayer THEN
    -- Undo is allowed only inside the 10-minute window.
    IF coalesce((mk->>_prayer)::timestamptz, '-infinity'::timestamptz) < now() - interval '10 minutes' THEN
      RAISE EXCEPTION 'habit_locked';
    END IF;
    pr := pr - _prayer; mk := mk - _prayer;
  ELSE
    IF d < today THEN
      st := 'late';
    ELSE
      SELECT pc.times INTO v_times FROM public.prayer_cache pc WHERE pc.user_id = uid AND pc.day = d;
      t_now := (now() AT TIME ZONE coalesce(public._effective_tz(uid), 'Africa/Tunis'))::time;
      t_start := nullif(substring(v_times->>_prayer from '^\d{2}:\d{2}'), '')::time;
      t_end := CASE WHEN i < 5 THEN nullif(substring(v_times->>names[i+1] from '^\d{2}:\d{2}'), '')::time END;
      IF t_start IS NULL THEN
        st := 'late';            -- no verified times (city/times missing): half credit only
      ELSIF t_now < t_start - interval '5 minutes' THEN
        RAISE EXCEPTION 'prayer_not_yet';
      ELSIF t_end IS NULL OR t_now < t_end THEN
        st := 'on_time';
      ELSE
        st := 'late';
      END IF;
    END IF;
    pr := pr || jsonb_build_object(_prayer, st);
    mk := mk || jsonb_build_object(_prayer, now());
  END IF;
  SELECT coalesce(sum(CASE e.v WHEN 'on_time' THEN 1 WHEN 'late' THEN 0.5 ELSE 0 END), 0) INTO val
    FROM jsonb_each_text(pr) AS e(k, v);
  comp := public._habit_completion('salat', h.target, val, jsonb_build_object('prayers', pr));
  v_done := CASE WHEN comp >= 1 THEN coalesce(ex.done_at, now()) END;
  INSERT INTO public.checkins (user_id, user_habit_id, day, value, detail, done_at, is_demo)
  VALUES (uid, _user_habit_id, d, val, jsonb_build_object('prayers', pr, 'marked_at', mk), v_done, h.is_demo)
  ON CONFLICT (user_habit_id, day) DO UPDATE
    SET value = excluded.value,
        detail = coalesce(public.checkins.detail, '{}'::jsonb) || excluded.detail,
        done_at = excluded.done_at, created_at = now();
  PERFORM public._recompute_with_crew(uid, h.season_id, d);
  SELECT to_jsonb(ds) INTO r FROM public.daily_scores ds WHERE ds.user_id = uid AND ds.season_id = h.season_id AND ds.day = d;
  RETURN coalesce(r, '{}'::jsonb) || jsonb_build_object('prayers', pr, 'marked_at', mk, 'value', val);
END $function$;
REVOKE ALL ON FUNCTION public.mark_prayer(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_prayer(uuid, text, date) TO authenticated;
