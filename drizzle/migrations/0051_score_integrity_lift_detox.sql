CREATE OR REPLACE FUNCTION public.log_lift(_exercise uuid, _weight numeric, _reps integer, _unit text DEFAULT 'kg'::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid:=auth.uid();d date;sid uuid;e record;best numeric;kg numeric;res text;beats integer;bw boolean;
BEGIN IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
d:=public._local_today(uid);SELECT s.id INTO sid FROM seasons s JOIN season_entries se ON se.season_id=s.id AND se.user_id=uid WHERE d BETWEEN s.starts_on AND s.ends_on AND s.status='live' LIMIT 1;IF sid IS NULL THEN RAISE EXCEPTION 'season_closed';END IF;
PERFORM public._check_day_window(uid,d);PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,15));SELECT * INTO e FROM lift_exercises WHERE id=_exercise;IF NOT FOUND OR _reps IS NULL OR _reps NOT BETWEEN 1 AND 1000 OR _unit IS NULL OR _unit NOT IN('kg','lb') THEN RAISE EXCEPTION 'invalid_set';END IF;
bw:=e.equipment='bodyweight' OR e.key='pullups';kg:=CASE WHEN bw THEN NULL WHEN _unit='lb' THEN round(_weight/2.2046226218,4) ELSE _weight END;
IF NOT bw AND(kg IS NULL OR kg<=0 OR kg>1000) THEN RAISE EXCEPTION 'invalid_set';END IF;
SELECT max(coalesce(x.weight,1)*x.reps) INTO best FROM (SELECT weight,reps FROM lift_sets WHERE user_id=uid AND exercise_id=_exercise AND day<d ORDER BY day DESC LIMIT 3) x;
res:=CASE WHEN best IS NULL THEN 'match' WHEN coalesce(kg,1)*_reps>best THEN 'beat' WHEN coalesce(kg,1)*_reps=best THEN 'match' ELSE 'under' END;
INSERT INTO lift_sets(user_id,exercise_id,day,weight,reps,unit,result) VALUES(uid,_exercise,d,kg,_reps,_unit,res) ON CONFLICT(user_id,exercise_id,day) DO UPDATE SET weight=excluded.weight,reps=excluded.reps,unit=excluded.unit,result=excluded.result;
SELECT least(3,count(*)) INTO beats FROM lift_sets WHERE user_id=uid AND day=d AND result='beat';INSERT INTO day_extras(user_id,day,lift_prs) VALUES(uid,d,beats) ON CONFLICT(user_id,day) DO UPDATE SET lift_prs=excluded.lift_prs;
PERFORM public._recompute_with_crew(uid,sid,d);RETURN jsonb_build_object('result',res,'beats',beats,'points',beats*5);END $function$;

CREATE OR REPLACE FUNCTION public.detox_action(_action text, _session uuid DEFAULT NULL::uuid, _minutes integer DEFAULT 30)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid:=auth.uid(); sess record; sid uuid; d date; n integer; h record;
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,16)); d:=public._local_today(uid);
IF _action='start' THEN
IF _minutes NOT IN(15,30,60) THEN RAISE EXCEPTION 'invalid_duration'; END IF;
PERFORM public._check_day_window(uid,d);
SELECT s.id INTO sid FROM seasons s JOIN season_entries e ON e.season_id=s.id AND e.user_id=uid WHERE s.status='live' AND d BETWEEN s.starts_on AND s.ends_on LIMIT 1; IF sid IS NULL THEN RAISE EXCEPTION 'season_closed'; END IF;
UPDATE detox_sessions SET ended_at=now() WHERE user_id=uid AND ended_at IS NULL AND last_seen_at<now()-interval '10 seconds';
INSERT INTO detox_sessions(user_id,minutes,day,season_id) VALUES(uid,_minutes,d,sid) RETURNING * INTO sess;
ELSE
SELECT * INTO sess FROM detox_sessions WHERE id=_session AND user_id=uid FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
IF sess.ended_at IS NULL THEN
IF _action='break' OR sess.last_seen_at<now()-interval '10 seconds' THEN UPDATE detox_sessions SET ended_at=now(),completed=false WHERE id=sess.id; sess.completed:=false; sess.ended_at:=now();
ELSIF _action='heartbeat' THEN UPDATE detox_sessions SET last_seen_at=now() WHERE id=sess.id;
ELSIF _action='finish' THEN
IF now()<sess.started_at+make_interval(mins=>sess.minutes) THEN RAISE EXCEPTION 'too_early'; END IF;
PERFORM public._check_day_window(uid,sess.day);
UPDATE detox_sessions SET ended_at=now(),completed=true,last_seen_at=now() WHERE id=sess.id;
sess.completed:=true;sess.ended_at:=now();
SELECT coalesce(sum(minutes),0) INTO n FROM detox_sessions WHERE user_id=uid AND day=sess.day AND completed;
INSERT INTO day_extras(user_id,day,detox_points) VALUES(uid,sess.day,floor(n/30.0)::integer*5) ON CONFLICT(user_id,day) DO UPDATE SET detox_points=excluded.detox_points;
FOR h IN SELECT uh.id,uh.target,uh.kind FROM user_habits uh JOIN habit_templates ht ON ht.id=uh.template_id WHERE uh.user_id=uid AND uh.season_id=sess.season_id AND uh.active AND ht.key='detox' LOOP
INSERT INTO checkins(user_id,user_habit_id,day,value) VALUES(uid,h.id,sess.day,CASE WHEN h.kind='count' THEN n WHEN n>=h.target THEN 1 ELSE 0 END) ON CONFLICT(user_habit_id,day) DO UPDATE SET value=excluded.value;
END LOOP;
PERFORM public._recompute_with_crew(uid,sess.season_id,sess.day);
ELSE RAISE EXCEPTION 'invalid_action'; END IF;
END IF;
END IF;
RETURN jsonb_build_object('id',sess.id,'started_at',sess.started_at,'minutes',sess.minutes,'completed',sess.completed,'ended_at',sess.ended_at);
END $function$;