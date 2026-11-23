-- Guest mode checks. One transaction, always rolled back: the final RAISE carries the report.
DO $test$
DECLARE
  g uuid := (SELECT id FROM auth.users WHERE lower(email)='demo@lezgo.app');
  real_u uuid := (SELECT p.id FROM public.profiles p JOIN auth.users a ON a.id=p.id WHERE NOT p.is_demo AND NOT p.is_admin AND a.email NOT ILIKE '%demo%' ORDER BY p.created_at LIMIT 1);
  sid uuid := (SELECT id FROM public.seasons WHERE slug='winter-arc-2026');
  f record; call text; ok int := 0; bad text := ''; n bigint; r jsonb; nu uuid := gen_random_uuid(); report text := '';
BEGIN
  -- 1 every write RPC refuses the guest
  PERFORM set_config('request.jwt.claims', json_build_object('sub',g,'role','authenticated')::text, true);
  FOR f IN SELECT p.proname, p.oid FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname = ANY(ARRAY[
    'checkin_upsert','set_chaos_done','spin_daily_chaos','log_lift','log_lift_session','boss_action','hit_boss','reset_boss','detox_action','detox_duel_action','log_screen_time',
    'create_post','post_daily_proof','post_small_wins','react_post','post_action','send_nudge','toggle_respect','join_season','create_crew','join_crew','leave_crew',
    'seal_capsule','claim_moment','remind_moment','close_my_day','buddy_action','report_buddy','create_challenge','join_challenge','activate_challenge','create_sub_squad',
    'assign_sub_squad','create_boss_lesson','set_season_reminder','register_push','register_proof_fingerprint','recompute_day','demo_reset_day','delete_my_account'])
  LOOP
    SELECT format('SELECT public.%I(%s)', f.proname, coalesce(string_agg('NULL::'||format_type(t,NULL), ',' ORDER BY o),''))
      INTO call FROM unnest((SELECT proargtypes::oid[] FROM pg_proc WHERE oid=f.oid)) WITH ORDINALITY a(t,o);
    BEGIN
      EXECUTE call;
      bad := bad || f.proname || '(no error) ';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM = 'guest_read_only' THEN ok := ok + 1; ELSE bad := bad || f.proname || '(' || SQLERRM || ') '; END IF;
    END;
  END LOOP;
  report := report || format(E'1 write RPCs refuse guest: %s (%s refused%s)\n', CASE WHEN bad='' THEN 'PASS' ELSE 'FAIL' END, ok, CASE WHEN bad='' THEN '' ELSE '; ' || bad END);

  -- 2 direct table writes refuse guest
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN UPDATE public.profiles SET city='x' WHERE id=g; report := report || E'2 guest profile edit: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report := report || format(E'2 guest profile edit refused (%s): %s\n', SQLERRM, CASE WHEN SQLERRM='guest_read_only' THEN 'PASS' ELSE 'FAIL' END); END;
  BEGIN UPDATE public.user_habits SET target=9 WHERE user_id=g; report := report || E'2b guest habit edit: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report := report || format(E'2b guest habit edit refused (%s): %s\n', SQLERRM, CASE WHEN SQLERRM='guest_read_only' THEN 'PASS' ELSE 'FAIL' END); END;
  EXECUTE 'RESET ROLE';

  -- 3 guest can still read its sample world
  r := public.scoreboard_v4((SELECT id FROM public.seasons WHERE slug='demo-winter-arc'),'world','season','TN','total');
  n := jsonb_array_length(coalesce(r->'rows','[]'));
  report := report || format(E'3 guest reads sample board: %s (%s rows)\n', CASE WHEN n>0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- 4 guest + demo players invisible to a real user
  PERFORM set_config('request.jwt.claims', json_build_object('sub',real_u,'role','authenticated')::text, true);
  r := public.scoreboard_v4(sid,'world','season','TN','total');
  SELECT count(*) INTO n FROM jsonb_array_elements(coalesce(r->'rows','[]')) x JOIN public.profiles p ON p.id=(x->>'user_id')::uuid WHERE p.is_demo OR p.id=g;
  report := report || format(E'4 no guest/demo on real board: %s (%s)\n', CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  r := public.proof_feed(sid,'everyone','all',NULL);
  SELECT count(*) INTO n FROM jsonb_array_elements(coalesce(r,'[]')) x JOIN public.profiles p ON p.id=(x->>'user_id')::uuid WHERE p.is_demo;
  report := report || format(E'4b no guest/demo posts in real feed: %s (%s)\n', CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.profiles WHERE is_demo;
  EXECUTE 'RESET ROLE';
  report := report || format(E'4c demo/guest profiles readable by real user: %s (%s)\n', CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- 5 sign-up after guest starts fresh at 0
  INSERT INTO auth.users(id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  VALUES (nu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'guest-convert-test@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
  SELECT coalesce(sum(total),0) INTO n FROM public.daily_scores WHERE user_id=nu;
  report := report || format(E'5 new account after guest starts at 0 points: %s (%s pts, profile %s, demo=%s)\n',
    CASE WHEN n=0 AND EXISTS(SELECT 1 FROM public.profiles WHERE id=nu AND NOT is_demo) THEN 'PASS' ELSE 'FAIL' END, n,
    (SELECT count(*) FROM public.profiles WHERE id=nu), (SELECT is_demo FROM public.profiles WHERE id=nu));

  RAISE EXCEPTION E'TEST REPORT (rolled back)\n%', report;
END $test$;
