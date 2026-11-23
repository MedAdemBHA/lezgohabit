-- Score integrity checks. Runs inside one transaction and always rolls back:
-- the final RAISE carries the PASS/FAIL report, so nothing here persists.
DO $test$
DECLARE
  u uuid := '9983c02b-212a-45b2-88c1-e0cde2051324';
  sid uuid := (SELECT id FROM public.seasons WHERE slug='winter-arc-2026');
  ex uuid := (SELECT id FROM public.lift_exercises WHERE equipment='dumbbell' ORDER BY sort LIMIT 1);
  h uuid; today date; n bigint; v text; r jsonb; bid uuid; pid uuid; report text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  today := public._local_today(u);
  SELECT id INTO h FROM public.user_habits WHERE user_id=u AND season_id=sid AND active ORDER BY position LIMIT 1;

  -- 1 formula
  SELECT count(*) INTO n FROM public.daily_scores WHERE total<>floor((habit_points+stack_points)*multiplier);
  report := report || format(E'1 formula total=floor((hp+st)*mult): %s (%s bad rows)\n', CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  -- 2 cap 247 unless comeback; comeback habit cap 200
  SELECT count(*) INTO n FROM public.daily_scores WHERE (total>247 AND NOT comeback) OR habit_points>200;
  report := report || format(E'2 no total>247 except comeback: %s (%s)\n', CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  -- 3 stacks <= 65
  SELECT count(*) INTO n FROM public.daily_scores WHERE stack_points>65;
  report := report || format(E'3 no stacks>65: %s (%s)\n', CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- 4 lift sandbagging: best of last 3 sessions
  PERFORM set_config('lezgo.final_override','on',true);
  DELETE FROM public.lift_sets WHERE user_id=u AND exercise_id=ex;
  INSERT INTO public.lift_sets(user_id,exercise_id,day,weight,reps,unit,result) VALUES
   (u,ex,today-3,100,10,'kg','match'),(u,ex,today-2,50,10,'kg','under'),(u,ex,today-1,20,10,'kg','under');
  PERFORM set_config('lezgo.final_override','off',true);
  r := public.log_lift(ex,30,10,'kg');
  v := r->>'result';
  r := public.log_lift(ex,101,10,'kg');
  report := report || format(E'4 lift sandbagging blocked (30x10 after 100x10,50x10,20x10 = %s; 101x10 = %s): %s\n', v, r->>'result', CASE WHEN v='under' AND r->>'result'='beat' THEN 'PASS' ELSE 'FAIL' END);

  -- 5 proof bonus removed when its post is deleted while the day is open
  INSERT INTO public.posts(user_id,season_id,type,body,day,image_url) VALUES(u,sid,'proof','test proof',today,u::text||'/t.jpg') RETURNING id INTO pid;
  INSERT INTO public.day_extras(user_id,day,proof_posted,proof_post_id) VALUES(u,today,true,pid) ON CONFLICT(user_id,day) DO UPDATE SET proof_posted=true,proof_post_id=pid;
  PERFORM public.recompute_day(u,sid,today);
  SELECT stack_points::text INTO v FROM public.daily_scores WHERE user_id=u AND season_id=sid AND day=today;
  DELETE FROM public.posts WHERE id=pid;
  SELECT count(*) INTO n FROM public.day_extras WHERE user_id=u AND day=today AND proof_posted;
  report := report || format(E'5 proof +10 removed on delete while open (stacks before %s, after %s): %s\n', v,
     (SELECT stack_points FROM public.daily_scores WHERE user_id=u AND season_id=sid AND day=today), CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END);
  -- 5b identical fingerprint = no bonus
  INSERT INTO public.proof_fingerprints(path,user_id,fingerprint,created_at) VALUES (u::text||'/a.jpg',u,repeat('a',64),now()-interval '1 day'),(u::text||'/b.jpg',u,repeat('a',64),now());
  report := report || format(E'5b duplicate photo earns no bonus: %s\n', CASE WHEN public._proof_is_duplicate(u,u::text||'/b.jpg') AND NOT public._proof_is_duplicate(u,u::text||'/a.jpg') THEN 'PASS' ELSE 'FAIL' END);

  -- 6 boss: single bonus, upgrade pays the difference, limits
  INSERT INTO public.bosses(season_id,week_no,slug,name,rule,metric,exercise_key,levels,starts_at,ends_at,color)
  VALUES(sid,99,'test-boss','{"en":"Test"}','{"en":"Test"}','reps','none','[{"key":"rookie","target":10,"bonus":50},{"key":"pro","target":10,"bonus":100},{"key":"beast","target":10,"bonus":150}]',now()-interval '1 hour',now()+interval '1 day','#C8F560') RETURNING id INTO bid;
  PERFORM public.boss_action(bid,'level',0,'rookie');
  PERFORM public.boss_action(bid,'hit',10);
  PERFORM public.boss_action(bid,'level',0,'pro');
  PERFORM public.boss_action(bid,'level',0,'beast');
  SELECT count(*),coalesce(sum(points),0)::text INTO n,v FROM public.bonus_points WHERE user_id=u AND boss_id=bid;
  report := report || format(E'6 boss single bonus (rookie→pro→beast = %s row, %s pts, not 300): %s\n', n, v, CASE WHEN n=1 AND v='150' THEN 'PASS' ELSE 'FAIL' END);
  BEGIN PERFORM public.boss_action(bid,'level',0,'rookie'); report:=report||E'6b level can only go up: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'6b level can only go up (%s): %s\n',SQLERRM,CASE WHEN SQLERRM='level_locked' THEN 'PASS' ELSE 'FAIL' END); END;
  BEGIN PERFORM public.boss_action(bid,'reset'); report:=report||E'6c reset disabled after completion: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'6c reset disabled after completion (%s): %s\n',SQLERRM,CASE WHEN SQLERRM='boss_locked' THEN 'PASS' ELSE 'FAIL' END); END;
  BEGIN PERFORM public.boss_action(bid,'hit',101); report:=report||E'6d single hit max 100: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'6d single hit max 100 (%s): %s\n',SQLERRM,CASE WHEN SQLERRM='hit_too_large' THEN 'PASS' ELSE 'FAIL' END); END;
  SELECT count(*) INTO n FROM (SELECT user_id,boss_id FROM public.bonus_points GROUP BY 1,2 HAVING count(*)>1) x;
  report := report || format(E'6e no user has two bonuses for one boss: %s (%s)\n', CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- 7 timezone: once per 7 days, effective next day
  UPDATE public.profiles SET timezone='Europe/Paris' WHERE id=u;
  SELECT timezone||' pending '||coalesce(pending_timezone,'-')||' from '||coalesce(pending_timezone_from::text,'-') INTO v FROM public.profiles WHERE id=u;
  BEGIN UPDATE public.profiles SET timezone='Asia/Dubai' WHERE id=u; report:=report||format(E'7 timezone rule (%s; second change allowed): FAIL\n',v);
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'7 timezone rule (%s; second change -> %s): %s\n',v,SQLERRM,CASE WHEN SQLERRM='timezone_locked' AND v LIKE 'Africa/Tunis pending Europe/Paris%' THEN 'PASS' ELSE 'FAIL' END); END;

  -- 8 final days reject edits
  r := public.checkin_upsert(h,0,NULL,today);
  r := public.checkin_upsert(h,1,NULL,today);
  PERFORM public.close_my_day('strong','');
  BEGIN PERFORM public.checkin_upsert(h,0,NULL,today); report:=report||E'8 final day rejects check-in: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'8 final day rejects check-in (%s): %s\n',SQLERRM,CASE WHEN SQLERRM='day_final' THEN 'PASS' ELSE 'FAIL' END); END;
  BEGIN PERFORM public.set_chaos_done(sid,true,today); report:=report||E'8b final day rejects chaos: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'8b final day rejects chaos (%s): %s\n',SQLERRM,CASE WHEN SQLERRM='day_final' THEN 'PASS' ELSE 'FAIL' END); END;
  BEGIN PERFORM public.log_lift(ex,200,10,'kg'); report:=report||E'8c final day rejects lift: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'8c final day rejects lift (%s): %s\n',SQLERRM,CASE WHEN SQLERRM='day_final' THEN 'PASS' ELSE 'FAIL' END); END;
  BEGIN UPDATE public.daily_scores SET total=total+1 WHERE user_id=u AND season_id=sid AND day=today; report:=report||E'8d final score row is read-only: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'8d final score row is read-only (%s): %s\n',SQLERRM,CASE WHEN SQLERRM='day_final' THEN 'PASS' ELSE 'FAIL' END); END;
  SELECT count(*) INTO n FROM public.checkin_events WHERE user_id=u AND day=today;
  BEGIN UPDATE public.checkin_events SET new_value=5 WHERE user_id=u; report:=report||E'8e check-in history append-only: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'8e check-in history append-only (%s events, edit -> %s): %s\n',n,SQLERRM,CASE WHEN SQLERRM='append_only' AND n>0 THEN 'PASS' ELSE 'FAIL' END); END;

  -- 9 demo rows invisible to a real user
  r := public.scoreboard_v4(sid,'world','season','TN','total');
  SELECT count(*) INTO n FROM jsonb_array_elements(r->'rows') x JOIN public.profiles p ON p.id=(x->>'user_id')::uuid WHERE p.is_demo;
  report := report || format(E'9 no demo players on real world board: %s (%s)\n', CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  r := public.proof_feed(sid,'everyone','all',NULL);
  SELECT count(*) INTO n FROM jsonb_array_elements(r) x JOIN public.profiles p ON p.id=(x->>'user_id')::uuid WHERE p.is_demo;
  report := report || format(E'9b no demo posts in real feed: %s (%s)\n', CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.daily_scores WHERE is_demo;
  EXECUTE 'RESET ROLE';
  report := report || format(E'9c demo score rows readable by real user: %s (%s)\n', CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- 10 season snapshot immutable
  INSERT INTO public.season_results(user_id,season_id,score,daily_points,boss_points,rank_country,rank_world,perfect_days,best_streak,active_days,trophy)
  VALUES(u,sid,100,100,0,1,1,0,0,0,false);
  BEGIN UPDATE public.season_results SET score=999 WHERE user_id=u AND season_id=sid; report:=report||E'10 season snapshot immutable: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'10 season snapshot immutable (%s): %s\n',SQLERRM,CASE WHEN SQLERRM='season_frozen' THEN 'PASS' ELSE 'FAIL' END); END;
  BEGIN DELETE FROM public.season_results WHERE user_id=u AND season_id=sid; report:=report||E'10b snapshot cannot be deleted: FAIL\n';
  EXCEPTION WHEN OTHERS THEN report:=report||format(E'10b snapshot cannot be deleted (%s): %s\n',SQLERRM,CASE WHEN SQLERRM='season_frozen' THEN 'PASS' ELSE 'FAIL' END); END;

  RAISE EXCEPTION E'TEST REPORT (rolled back)\n%', report;
END $test$;
