-- UX-12: "First check-in" is earned when a habit reaches its target, not on any partial value
-- (logging 1 hour of a 7-hour sleep no longer counts). Badges already earned stay earned.
DO $$
DECLARE f text; patched text;
BEGIN
  SELECT pg_get_functiondef('public._award_badges(uuid,uuid)'::regprocedure) INTO f;
  patched := replace(f,
    '(''first_go'', EXISTS(SELECT 1 FROM public.checkins ci JOIN public.user_habits h ON h.id=ci.user_habit_id WHERE ci.user_id=_uid AND h.season_id=_sid AND ci.value>0))',
    '(''first_go'', EXISTS(SELECT 1 FROM public.checkins ci JOIN public.user_habits h ON h.id=ci.user_habit_id WHERE ci.user_id=_uid AND h.season_id=_sid AND ci.value>0 AND public._habit_completion(h.kind,h.target,ci.value,ci.detail)>=1))');
  IF patched = f THEN RAISE EXCEPTION 'first_go badge rule not found in _award_badges'; END IF;
  EXECUTE patched;
END $$;
