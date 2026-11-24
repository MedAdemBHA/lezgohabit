-- Apply migrations 0063 through 0069 first, then run this file with psql.
-- It creates only throwaway auth users and rows inside one transaction and rolls
-- the entire fixture back after printing one PASS/FAIL row per check.
BEGIN;

CREATE TEMP TABLE verify_v2_results (
  check_no integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  check_name text NOT NULL,
  passed boolean NOT NULL,
  detail text NOT NULL
) ON COMMIT DROP;

DO $verify_v2$
DECLARE
  u uuid[] := ARRAY[
    '7f200001-2d8c-4ab0-8000-000000000001'::uuid,
    '7f200002-2d8c-4ab0-8000-000000000002'::uuid,
    '7f200003-2d8c-4ab0-8000-000000000003'::uuid,
    '7f200004-2d8c-4ab0-8000-000000000004'::uuid,
    '7f200005-2d8c-4ab0-8000-000000000005'::uuid,
    '7f200006-2d8c-4ab0-8000-000000000006'::uuid,
    '7f200007-2d8c-4ab0-8000-000000000007'::uuid,
    '7f200008-2d8c-4ab0-8000-000000000008'::uuid,
    '7f200009-2d8c-4ab0-8000-000000000009'::uuid,
    '7f200010-2d8c-4ab0-8000-000000000010'::uuid,
    '7f200011-2d8c-4ab0-8000-000000000011'::uuid,
    '7f200012-2d8c-4ab0-8000-000000000012'::uuid
  ];
  open_season uuid;
  second_season uuid;
  finished_season uuid;
  near_miss_season uuid;
  faith_season uuid;
  personal_season uuid;
  my_crew uuid;
  next_crew uuid;
  h_train uuid;
  h_read uuid;
  h_window uuid;
  h_quit uuid;
  h_timer uuid;
  h_personal uuid;
  h_finish uuid;
  h_near_miss uuid;
  timer_session uuid;
  local_day date;
  start_day date;
  end_day date;
  local_now time;
  window_start time;
  window_end time;
  tz_instant timestamptz := '2026-01-01 21:30:00+00';
  v_template public.habit_templates%ROWTYPE;
  v_key text;
  v_pos integer;
  v_rule jsonb;
  v_json jsonb;
  v_feed jsonb;
  v_entry jsonb;
  v_error text;
  v_count integer;
  v_bad integer;
  v_trophy boolean;
  v_private boolean;
  v_consistency numeric;
  v_completed integer;
  v_perfect integer;
  v_boundary integer;
  v_i integer;
BEGIN
  -- Auth's normal profile trigger creates the matching profiles for these fixtures.
  INSERT INTO auth.users(id,instance_id,aud,role,email,raw_user_meta_data,raw_app_meta_data,created_at,updated_at)
  SELECT u[n],'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'v2verify'||lpad(n::text,2,'0')||'@example.invalid','{}'::jsonb,'{}'::jsonb,now(),now()
  FROM generate_series(1,12) AS series(n);

  INSERT INTO public.seasons(slug,name,starts_on,ends_on,status,theme_color,challenge_owned,is_demo)
  VALUES('verify-v2-open-'||substr(u[1]::text,1,8),jsonb_build_object('en','V2 verifier open'),
    public._local_today(u[1]),public._local_today(u[1])+6,'live','#7FB2FF',false,false)
  RETURNING id INTO open_season;
  INSERT INTO public.seasons(slug,name,starts_on,ends_on,status,theme_color,challenge_owned,is_demo)
  VALUES('verify-v2-second-'||substr(u[1]::text,1,8),jsonb_build_object('en','V2 verifier second'),
    public._local_today(u[1]),public._local_today(u[1])+6,'live','#7FB2FF',false,false)
  RETURNING id INTO second_season;

  local_now := (now() AT TIME ZONE 'Africa/Tunis')::time;
  window_start := (local_now + interval '6 hours')::time;
  window_end := (local_now + interval '7 hours')::time;
  FOR v_key,v_pos IN
    SELECT * FROM (VALUES ('train',0),('read',1),('wake_early',2),('smoke_free',3),('meditation',4)) AS habits(key,position)
  LOOP
    SELECT * INTO v_template FROM public.habit_templates WHERE key=v_key AND NOT archived;
    IF NOT FOUND THEN RAISE EXCEPTION 'Verifier fixture needs habit template %',v_key; END IF;
    v_rule := coalesce(v_template.default_rule,'{}'::jsonb);
    IF v_key='wake_early' THEN
      v_rule := jsonb_build_object('window_start',to_char(window_start,'HH24:MI'),'window_end',to_char(window_end,'HH24:MI'));
    END IF;
    INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,rule,is_faith,position,is_demo)
    VALUES(open_season,v_template.id,v_template.key,v_template.name,
      coalesce(nullif(v_template.what_counts,'{}'::jsonb),v_template.description),v_template.kind,
      v_template.default_target,v_template.unit,v_rule,v_template.is_faith,v_pos,false);
  END LOOP;

  -- A join copies the locked habit snapshot and its server rule into user_habits.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  PERFORM public.join_season(open_season,'crew');
  SELECT count(*) INTO v_count FROM public.user_habits WHERE user_id=u[1] AND season_id=open_season AND active;
  SELECT count(*) INTO v_bad FROM public.challenge_habits ch LEFT JOIN public.user_habits uh
    ON uh.user_id=u[1] AND uh.season_id=ch.season_id AND uh.template_id=ch.template_id
    WHERE ch.season_id=open_season AND (uh.id IS NULL OR uh.target<>ch.target OR uh.kind<>ch.kind OR uh.rule<>ch.rule);
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Challenge habits copy to the participant',v_count=5 AND v_bad=0,format('%s habits copied; %s snapshot mismatches',v_count,v_bad));

  v_error := NULL;
  BEGIN
    PERFORM public.join_season(second_season,'solo');
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Join RPC rejects a second active challenge',v_error='active_challenge_exists',coalesce(v_error,'second join unexpectedly succeeded'));

  v_error := NULL;
  BEGIN
    INSERT INTO public.season_entries(user_id,season_id,mode,kind,status)
    VALUES(u[1],second_season,'solo','official','active');
  EXCEPTION WHEN unique_violation THEN v_error := 'one_active_partial_unique_index';
    WHEN OTHERS THEN v_error := SQLERRM;
  END;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Database index enforces one active challenge',v_error='one_active_partial_unique_index',coalesce(v_error,'second active row unexpectedly inserted'));

  -- The server helper uses a half-open window and accepts overnight windows.
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Time window accepts an inside local time',
    public._time_window_allows('{"window_start":"21:00","window_end":"00:00"}'::jsonb,(tz_instant AT TIME ZONE 'Africa/Tunis')::time),
    '21:30 UTC maps inside 21:00–00:00 in Africa/Tunis');
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Time window rejects an outside local time',
    NOT public._time_window_allows('{"window_start":"21:00","window_end":"00:00"}'::jsonb,(tz_instant AT TIME ZONE 'America/Los_Angeles')::time),
    '21:30 UTC maps outside 21:00–00:00 in America/Los_Angeles');

  -- Find-me-a-crew groups six, reuses membership idempotently, then starts a second crew.
  v_bad := 0;
  FOR v_i IN 1..6 LOOP
    IF v_i>1 THEN
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[v_i],'role','authenticated')::text,true);
      PERFORM public.join_season(open_season,'crew');
    ELSE
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
    END IF;
    v_json := public.find_challenge_crew();
    IF v_i=1 THEN my_crew := (v_json->>'crew_id')::uuid; END IF;
    IF (v_json->>'crew_id')::uuid IS DISTINCT FROM my_crew THEN
      v_bad := v_bad + 1;
    END IF;
  END LOOP;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Find-me-a-crew groups same-challenge players',v_bad=0,format('%s of six participants landed in another crew',v_bad));
  SELECT count(*) INTO v_count FROM public.crew_members WHERE crew_id=my_crew;
  PERFORM public.find_challenge_crew();
  SELECT count(*) INTO v_bad FROM public.crew_members WHERE crew_id=my_crew;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Find-me-a-crew reuses a member and caps crews at six',v_count=6 AND v_bad=6,format('crew size %s before and %s after repeat',v_count,v_bad));

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[7],'role','authenticated')::text,true);
  PERFORM public.join_season(open_season,'crew');
  v_json := public.find_challenge_crew();
  next_crew := (v_json->>'crew_id')::uuid;
  SELECT count(*) INTO v_count FROM public.crew_members WHERE crew_id=next_crew;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Full crew starts a second six-person group',next_crew IS DISTINCT FROM my_crew AND v_count=1,format('new crew %s has %s member(s)',next_crew,v_count));

  -- A quit slip is accepted honestly, saved as a slip, and gives no completion.
  SELECT id INTO h_quit FROM public.user_habits
    WHERE user_id=u[2] AND season_id=open_season AND template_id=(SELECT id FROM public.habit_templates WHERE key='smoke_free');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[2],'role','authenticated')::text,true);
  PERFORM public.join_season(open_season,'crew');
  v_error := NULL;
  BEGIN
    PERFORM public.checkin_upsert(h_quit,0,NULL,public._local_today(u[2]));
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  SELECT coalesce((detail->>'slip')::boolean,false) INTO v_trophy
    FROM public.checkins WHERE user_habit_id=h_quit AND day=public._local_today(u[2]);
  SELECT completion INTO v_consistency FROM public.daily_scores WHERE user_id=u[2] AND season_id=open_season AND day=public._local_today(u[2]);
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Quit slip is saved honestly as zero completion',v_error IS NULL AND coalesce(v_trophy,false) AND coalesce(v_consistency,0)=0,
    format('error=%s, slip=%s, completion=%s',coalesce(v_error,'none'),coalesce(v_trophy,false),coalesce(v_consistency,0)));

  -- The seeded window on this verifier habit is six hours ahead of current local time.
  SELECT id INTO h_window FROM public.user_habits
    WHERE user_id=u[2] AND season_id=open_season AND template_id=(SELECT id FROM public.habit_templates WHERE key='wake_early');
  v_error := NULL;
  BEGIN
    PERFORM public.checkin_upsert(h_window,1,NULL,public._local_today(u[2]));
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Time-window check-in is rejected outside its local window',v_error='outside_time_window',coalesce(v_error,'check-in unexpectedly succeeded'));

  SELECT id INTO h_timer FROM public.user_habits
    WHERE user_id=u[2] AND season_id=open_season AND template_id=(SELECT id FROM public.habit_templates WHERE key='meditation');
  v_json := public.start_habit_timer(h_timer);
  timer_session := (v_json->>'id')::uuid;
  v_error := NULL;
  BEGIN
    PERFORM public.complete_habit_timer(timer_session);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Timer cannot complete before its minimum',v_error='timer_too_short',coalesce(v_error,'timer completed without tracked time'));

  -- Surrender freezes a result, removes crew membership, and remains in history.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'role','authenticated')::text,true);
  v_json := public.surrender_challenge(open_season);
  SELECT item INTO v_entry FROM jsonb_array_elements(public.my_challenge_history()) item
    WHERE item->>'season_id'=open_season::text;
  SELECT count(*) INTO v_count FROM public.crew_members WHERE user_id=u[3] AND crew_id=my_crew;
  v_error := NULL;
  PERFORM set_config('lezgo.final_override','on',true);
  UPDATE public.daily_scores SET finalized_at=NULL WHERE user_id=u[3] AND season_id=open_season AND day=public._local_today(u[3]);
  PERFORM set_config('lezgo.final_override','off',true);
  BEGIN
    PERFORM public.checkin_upsert((SELECT id FROM public.user_habits WHERE user_id=u[3] AND season_id=open_season AND template_id=(SELECT id FROM public.habit_templates WHERE key='train')),1,NULL,public._local_today(u[3]));
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Surrender freezes history, leaves crew, and blocks later check-ins',
    v_json->>'status'='surrendered' AND v_entry->>'status'='surrendered' AND v_count=0 AND v_error='challenge_not_active',
    format('status=%s, history=%s, crew rows=%s, later write=%s',v_json->>'status',v_entry->>'status',v_count,coalesce(v_error,'none')));

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  v_feed := public.challenge_feed(open_season,'challenge');
  SELECT count(*) INTO v_count FROM jsonb_array_elements(v_feed) event
    WHERE event->>'type'='surrender' AND event->>'user_id'=u[3]::text;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Crew sees one calm surrender moment',v_count=1,format('%s matching surrender event(s)',v_count));

  -- A 7-day official challenge joined on day 2 has six elapsed participation days.
  local_day := public._local_today(u[9]);
  start_day := local_day-7;
  end_day := start_day+6;
  INSERT INTO public.seasons(slug,name,starts_on,ends_on,status,theme_color,challenge_owned,is_demo)
  VALUES('verify-v2-finished-'||substr(u[9]::text,1,8),jsonb_build_object('en','V2 seven day'),start_day,end_day,'ended','#7FB2FF',false,false)
  RETURNING id INTO finished_season;
  SELECT * INTO v_template FROM public.habit_templates WHERE key='read';
  INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,rule,is_faith,position,is_demo)
  VALUES(finished_season,v_template.id,v_template.key,v_template.name,
    coalesce(nullif(v_template.what_counts,'{}'::jsonb),v_template.description),v_template.kind,v_template.default_target,v_template.unit,'{}'::jsonb,false,0,false);
  INSERT INTO public.season_entries(user_id,season_id,mode,kind,status,joined_at)
  VALUES(u[9],finished_season,'solo','official','active',((start_day+1)::timestamp AT TIME ZONE 'Africa/Tunis'));
  INSERT INTO public.user_habits(user_id,season_id,template_id,kind,target,unit,position,what_counts,rule,is_demo)
  VALUES(u[9],finished_season,v_template.id,v_template.kind,v_template.default_target,v_template.unit,0,
    coalesce(nullif(v_template.what_counts,'{}'::jsonb),v_template.description),'{}'::jsonb,false)
  RETURNING id INTO h_finish;
  INSERT INTO public.checkins(user_id,user_habit_id,day,value,detail,done_at,is_demo)
  SELECT u[9],h_finish,day::date,CASE WHEN day::date=end_day THEN 10 ELSE 6 END,'{}'::jsonb,now(),false
    FROM generate_series(start_day+1,end_day,interval '1 day') AS series(day);
  PERFORM public._freeze_season(finished_season);
  SELECT completed_days,trophy,consistency_percent,perfect_days INTO v_completed,v_trophy,v_consistency,v_perfect
    FROM public.season_results WHERE user_id=u[9] AND season_id=finished_season;
  SELECT count(*) INTO v_boundary FROM public.daily_scores
    WHERE user_id=u[9] AND season_id=finished_season AND completion=0.6;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[9],'role','authenticated')::text,true);
  SELECT item INTO v_entry FROM jsonb_array_elements(public.my_challenge_history()) item
    WHERE item->>'season_id'=finished_season::text;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Seven-day challenge completes, gives six-day trophy, and uses local elapsed consistency',
    (SELECT status='completed' FROM public.season_entries WHERE user_id=u[9] AND season_id=finished_season)
      AND v_entry->>'status'='completed' AND v_completed=6 AND v_trophy AND v_consistency=100 AND v_perfect=1
      AND (v_entry->>'perfect_days')::integer=1,
    format('history=%s, completed=%s/7, perfect=%s, consistency=%s%%, trophy=%s',v_entry->>'status',v_completed,v_perfect,v_consistency,v_trophy));
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Completion threshold includes exactly 60 percent',v_boundary=5,format('%s days saved at completion=0.6',v_boundary));

  -- Five of seven qualifying days is below ceil(75%); it must not award a trophy.
  local_day := public._local_today(u[10]);
  start_day := local_day-7;
  end_day := start_day+6;
  INSERT INTO public.seasons(slug,name,starts_on,ends_on,status,theme_color,challenge_owned,is_demo)
  VALUES('verify-v2-near-miss-'||substr(u[10]::text,1,8),jsonb_build_object('en','V2 near miss'),start_day,end_day,'ended','#7FB2FF',false,false)
  RETURNING id INTO near_miss_season;
  SELECT * INTO v_template FROM public.habit_templates WHERE key='train';
  INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,rule,is_faith,position,is_demo)
  VALUES(near_miss_season,v_template.id,v_template.key,v_template.name,
    coalesce(nullif(v_template.what_counts,'{}'::jsonb),v_template.description),v_template.kind,v_template.default_target,v_template.unit,'{}'::jsonb,false,0,false);
  INSERT INTO public.season_entries(user_id,season_id,mode,kind,status,joined_at)
  VALUES(u[10],near_miss_season,'solo','official','active',(start_day::timestamp AT TIME ZONE 'Africa/Tunis'));
  INSERT INTO public.user_habits(user_id,season_id,template_id,kind,target,unit,position,what_counts,rule,is_demo)
  VALUES(u[10],near_miss_season,v_template.id,v_template.kind,v_template.default_target,v_template.unit,0,
    coalesce(nullif(v_template.what_counts,'{}'::jsonb),v_template.description),'{}'::jsonb,false)
  RETURNING id INTO h_near_miss;
  INSERT INTO public.checkins(user_id,user_habit_id,day,value,detail,done_at,is_demo)
  SELECT u[10],h_near_miss,day::date,1,'{}'::jsonb,now(),false FROM generate_series(start_day,end_day-2,interval '1 day') AS series(day);
  PERFORM public._freeze_season(near_miss_season);
  SELECT trophy INTO v_trophy FROM public.season_results WHERE user_id=u[10] AND season_id=near_miss_season;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('75-percent trophy threshold excludes five of seven days',NOT coalesce(v_trophy,false),format('5/7 trophy=%s',coalesce(v_trophy,false)));

  -- Personal challenges also award the 75% trophy, but the trophy stays private and no board is returned.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[8],'role','authenticated')::text,true);
  personal_season := public.create_personal_challenge('V2 private trophy',7,'[{"key":"train","target":1}]'::jsonb);
  UPDATE public.seasons SET starts_on=public._local_today(u[8])-7,ends_on=public._local_today(u[8])-1,status='ended' WHERE id=personal_season;
  UPDATE public.season_entries SET joined_at=((public._local_today(u[8])-7)::timestamp AT TIME ZONE 'Africa/Tunis') WHERE user_id=u[8] AND season_id=personal_season;
  SELECT id INTO h_personal FROM public.user_habits WHERE user_id=u[8] AND season_id=personal_season AND active;
  INSERT INTO public.checkins(user_id,user_habit_id,day,value,detail,done_at,is_demo)
  SELECT u[8],h_personal,d,1,'{}'::jsonb,now(),false
    FROM generate_series(public._local_today(u[8])-6,public._local_today(u[8])-1,interval '1 day') AS series(day);
  PERFORM public._freeze_season(personal_season);
  SELECT trophy,trophy_private INTO v_trophy,v_private FROM public.season_results WHERE user_id=u[8] AND season_id=personal_season;
  SELECT count(*) INTO v_count FROM public.season_trophies WHERE user_id=u[8] AND season_id=personal_season AND is_private;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Personal 75-percent trophy is saved as private',v_trophy AND v_private AND v_count=1,
    format('trophy=%s, private=%s, private trophy rows=%s',v_trophy,v_private,v_count));
  v_error := NULL;
  BEGIN
    PERFORM public.challenge_scoreboard(personal_season,'challenge','TN');
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Personal challenge never appears on a public board',v_error='private_challenge',coalesce(v_error,'board call unexpectedly succeeded'));

  -- A completed seven-day season must seed the chosen Winter Arc habit list.
  SELECT count(*) FILTER(WHERE ch.habit_key IN ('train','read','sleep7')),
         count(*) FILTER(WHERE ch.habit_key NOT IN ('train','read','sleep7')),
         count(*) FILTER(WHERE ch.habit_key='sleep7' AND ch.kind='count' AND ch.target=7)
    INTO v_count,v_bad,v_boundary
    FROM public.challenge_habits ch JOIN public.seasons s ON s.id=ch.season_id
    WHERE s.slug='winter-arc-2026';
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Winter Arc seeds train, read, and 7-hour sleep',v_count=3 AND v_bad=0 AND v_boundary=1,
    format('%s requested keys, %s other key(s), %s 7-hour count target(s)',v_count,v_bad,v_boundary));

  -- Trigger-generated perfect-day and streak moments deduplicate, and faith habits suppress another user's event.
  local_day := public._local_today(u[11]);
  INSERT INTO public.seasons(slug,name,starts_on,ends_on,status,theme_color,challenge_owned,is_demo)
  VALUES('verify-v2-faith-'||substr(u[11]::text,1,8),jsonb_build_object('en','V2 privacy'),local_day,local_day+6,'live','#7FB2FF',false,false)
  RETURNING id INTO faith_season;
  SELECT * INTO v_template FROM public.habit_templates WHERE key='salat';
  INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,rule,is_faith,position,is_demo)
  VALUES(faith_season,v_template.id,v_template.key,v_template.name,
    coalesce(nullif(v_template.what_counts,'{}'::jsonb),v_template.description),v_template.kind,v_template.default_target,v_template.unit,'{}'::jsonb,true,0,false);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[11],'role','authenticated')::text,true);
  PERFORM public.join_season(faith_season,'solo');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[12],'role','authenticated')::text,true);
  PERFORM public.join_season(faith_season,'solo');
  UPDATE public.profiles SET faith_public=false WHERE id=u[11];
  INSERT INTO public.daily_scores(user_id,season_id,day,habit_points,stack_points,multiplier,total,completion,perfect,streak,shield_used,comeback,crew_sync,finalized_at,is_demo)
  VALUES(u[11],faith_season,local_day,100,0,1,100,1,true,7,false,false,false,now(),false);
  PERFORM set_config('lezgo.final_override','on',true);
  UPDATE public.daily_scores SET completion=1,perfect=true,streak=7 WHERE user_id=u[11] AND season_id=faith_season AND day=local_day;
  UPDATE public.daily_scores SET completion=1,perfect=true,streak=7 WHERE user_id=u[11] AND season_id=faith_season AND day=local_day;
  PERFORM set_config('lezgo.final_override','off',true);
  SELECT count(*) INTO v_count FROM public.challenge_events WHERE season_id=faith_season AND user_id=u[11] AND event_type='perfect_day';
  SELECT count(*) INTO v_bad FROM public.challenge_events WHERE season_id=faith_season AND user_id=u[11] AND event_type='streak';
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Auto perfect-day and streak moments are created once',v_count=1 AND v_bad=1,format('perfect=%s, streak=%s',v_count,v_bad));
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[12],'role','authenticated')::text,true);
  v_feed := public.challenge_feed(faith_season,'challenge');
  SELECT count(*) INTO v_count FROM jsonb_array_elements(v_feed) event WHERE event->>'user_id'=u[11]::text;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u[11],'role','authenticated')::text,true);
  v_feed := public.challenge_feed(faith_season,'challenge');
  SELECT count(*) INTO v_bad FROM jsonb_array_elements(v_feed) event WHERE event->>'user_id'=u[11]::text;
  INSERT INTO pg_temp.verify_v2_results(check_name,passed,detail)
  VALUES('Faith-related moments stay hidden unless the owner opts in',v_count=0 AND v_bad>=1,
    format('other participant sees %s; owner sees %s',v_count,v_bad));
END
$verify_v2$;

SELECT check_no,CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result,check_name,detail
FROM pg_temp.verify_v2_results ORDER BY check_no;
SELECT CASE WHEN bool_and(passed) THEN 'ALL V2 CHECKS PASS' ELSE 'V2 CHECKS NEED ATTENTION' END AS summary
FROM pg_temp.verify_v2_results;

ROLLBACK;
