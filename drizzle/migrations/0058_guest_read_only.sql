CREATE OR REPLACE FUNCTION public._is_guest() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND lower(u.email) = 'demo@lezgo.app'))
$$;
REVOKE ALL ON FUNCTION public._is_guest() FROM public, anon;
GRANT EXECUTE ON FUNCTION public._is_guest() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._guest_guard() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF public._is_guest() THEN RAISE EXCEPTION 'guest_read_only' USING ERRCODE = 'P0001'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public._guest_guard() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_guest_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public._guest_guard();
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DO $do$
DECLARE r record; def text; head text; body text; i int;
  fns text[] := ARRAY['activate_challenge','assign_sub_squad','boss_action','buddy_action','checkin_upsert','claim_moment','close_my_day','create_boss_lesson','create_challenge','create_crew','create_post','create_sub_squad','delete_my_account','demo_reset_day','detox_action','detox_duel_action','join_challenge','join_crew','join_season','leave_crew','log_lift','log_lift_session','log_screen_time','post_action','post_daily_proof','post_small_wins','react_post','recompute_day','register_proof_fingerprint','register_push','remind_moment','report_buddy','seal_capsule','send_nudge','set_chaos_done','set_season_reminder','spin_daily_chaos','toggle_respect'];
  tbls text[] := ARRAY['checkins','checkin_events','daily_scores','day_extras','day_closes','lift_sets','boss_hits','boss_entries','bonus_points','detox_sessions','detox_duels','screen_time_logs','posts','post_reactions','post_hides','reports','respects','nudges','crews','crew_members','season_entries','season_reminders','capsules','time_capsules','moments_seen','moment_reminders','buddy_requests','buddy_links','buddy_safety_reports','challenges','challenge_squads','challenge_squad_members','user_habits','user_preferences','notification_preferences','profiles','push_subscriptions','proof_fingerprints','badges','season_trophies'];
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY(fns) AND p.prolang = (SELECT oid FROM pg_language WHERE lanname='plpgsql') LOOP
    def := pg_get_functiondef(r.oid);
    IF position('_guest_guard' in def) > 0 THEN CONTINUE; END IF;
    i := position('$function$' in def);
    head := left(def, i + 9);
    body := substr(def, i + 10);
    body := regexp_replace(body, '\mBEGIN\M', 'BEGIN PERFORM public._guest_guard();', 'i');
    EXECUTE head || body;
  END LOOP;
  FOR i IN 1..array_length(tbls,1) LOOP
    IF to_regclass('public.'||tbls[i]) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS zz_guest_read_only ON public.%I', tbls[i]);
      EXECUTE format('CREATE TRIGGER zz_guest_read_only BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_guest_write()', tbls[i]);
    END IF;
  END LOOP;
END $do$;

CREATE TABLE public.guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.guest_sessions TO service_role;
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX guest_sessions_created_idx ON public.guest_sessions(created_at);

CREATE OR REPLACE FUNCTION public.admin_guest_sessions() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN jsonb_build_object(
    'today', (SELECT count(*) FROM guest_sessions WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Tunis') AT TIME ZONE 'Africa/Tunis'),
    'week', (SELECT count(*) FROM guest_sessions));
END $$;
REVOKE ALL ON FUNCTION public.admin_guest_sessions() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_guest_sessions() TO authenticated;

CREATE OR REPLACE FUNCTION public.integrity_tick()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE purged int;
BEGIN
 DELETE FROM public.guest_sessions WHERE created_at < now() - interval '7 days';
 GET DIAGNOSTICS purged = ROW_COUNT;
 DELETE FROM public.demo_login_limits WHERE window_start < now() - interval '1 day';
 RETURN jsonb_build_object('finalized',public.finalize_due_days(),'frozen',public.freeze_due_seasons(),'guests_purged',purged);
END $function$;