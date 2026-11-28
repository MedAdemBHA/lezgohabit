-- P2.1: hide optional features for the 1 January launch, enforced on the server.
-- Owner decision (2026-11-28): hide Boss Fight, Detox duels, Lift points, buddy matching,
-- time-capsule audio and the Daily Dare (+10) with its spin wheel. Admins can switch any of
-- them back on from Admin -> Flags; nothing is deleted. See docs/feature-flags.md.

-- 1. New flags (off for launch) and launch values for existing ones.
INSERT INTO public.admin_feature_flags(key, enabled) VALUES
  ('lift', false), ('capsule_audio', false), ('daily_dare', false)
ON CONFLICT (key) DO NOTHING;
UPDATE public.admin_feature_flags SET enabled = false WHERE key IN ('bosses', 'duels', 'buddies');

-- 2. Let admins toggle the new keys: extend admin_action's flag allowlist in place.
DO $$
DECLARE f text; fixed text;
BEGIN
  SELECT pg_get_functiondef('public.admin_action(text,uuid,jsonb)'::regprocedure) INTO f;
  IF position('''daily_dare''' IN f) = 0 THEN
    fixed := replace(f, '''auto_flag_links'')', '''auto_flag_links'',''lift'',''capsule_audio'',''daily_dare'')');
    IF fixed = f THEN RAISE EXCEPTION 'admin_action flag allowlist not found'; END IF;
    EXECUTE fixed;
  END IF;
END $$;

-- 3. Every write path of a hidden feature checks its flag (same pattern as 0027).
--    hit_boss/reset_boss are SQL wrappers over boss_action (already checks 'bosses');
--    buddy_directory is a read-only SQL listing; all buddy writes are checked.
DO $$
DECLARE f text; s text; k text; lang text;
BEGIN
  FOR s, k IN SELECT * FROM (VALUES
    ('public.create_boss_lesson(uuid,text,integer)', 'bosses'),
    ('public.buddy_matches(uuid,boolean,boolean,boolean,boolean)', 'buddies'),
    ('public.report_buddy(uuid,text)', 'buddies'),
    ('public.log_lift(uuid,numeric,integer,text)', 'lift'),
    ('public.log_lift_session(jsonb)', 'lift'),
    ('public.capsule_audio_access(text,boolean)', 'capsule_audio'),
    ('public.spin_daily_chaos(uuid)', 'daily_dare'),
    ('public.set_chaos_done(uuid,boolean,date)', 'daily_dare'),
    ('public.create_creator_challenge(text,integer,date,jsonb,text)', 'creator_challenges')
  ) v(signature, key) LOOP
    SELECT l.lanname, pg_get_functiondef(p.oid) INTO lang, f
    FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.oid = s::regprocedure;
    IF lang <> 'plpgsql' THEN RAISE EXCEPTION '% is %, expected plpgsql', s, lang; END IF;
    IF position('_require_feature(' || quote_literal(k) || ')' IN f) > 0 THEN CONTINUE; END IF;
    f := regexp_replace(f, '\mBEGIN\M', 'BEGIN PERFORM public._require_feature(' || quote_literal(k) || ');', 'i');
    EXECUTE f;
  END LOOP;
END $$;

-- 4. Hidden features add no new points while switched off. Points already earned stay.
--    (Boss rewards and Lift PRs feed bonus_points/day_extras through the RPCs gated above,
--    so no trigger changes are needed.)
