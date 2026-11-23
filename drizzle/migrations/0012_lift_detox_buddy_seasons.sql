ALTER TABLE public.profiles ADD COLUMN equipment text[] NOT NULL DEFAULT ARRAY['bodyweight']::text[], ADD COLUMN max_dumbbell_kg numeric NOT NULL DEFAULT 10, ADD COLUMN birth_date date, ADD COLUMN gender text;
GRANT UPDATE(equipment,max_dumbbell_kg,birth_date,gender) ON public.profiles TO authenticated;
UPDATE public.profiles p SET equipment=u.equipment,max_dumbbell_kg=u.max_dumbbell FROM public.user_preferences u WHERE u.user_id=p.id;
CREATE FUNCTION public.sync_kit_preferences() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN UPDATE public.profiles SET equipment=NEW.equipment,max_dumbbell_kg=NEW.max_dumbbell WHERE id=NEW.user_id; RETURN NEW; END $$;
CREATE TRIGGER sync_kit AFTER INSERT OR UPDATE OF equipment,max_dumbbell ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.sync_kit_preferences();
CREATE TABLE public.lift_exercises(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text UNIQUE NOT NULL,name jsonb NOT NULL,equipment text NOT NULL CHECK(equipment IN('dumbbell','bar','bodyweight')),sort integer NOT NULL DEFAULT 0);
GRANT SELECT ON public.lift_exercises TO authenticated; GRANT ALL ON public.lift_exercises TO service_role;
ALTER TABLE public.lift_exercises ENABLE ROW LEVEL SECURITY; CREATE POLICY exercises_read ON public.lift_exercises FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
CREATE TABLE public.lift_sets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,exercise_id uuid NOT NULL REFERENCES public.lift_exercises(id),day date NOT NULL,weight numeric,reps integer NOT NULL CHECK(reps BETWEEN 1 AND 1000),unit text NOT NULL DEFAULT 'kg' CHECK(unit IN('kg','lb')),result text NOT NULL DEFAULT 'match',created_at timestamptz NOT NULL DEFAULT now(),is_demo boolean NOT NULL DEFAULT false,UNIQUE(user_id,exercise_id,day));
GRANT SELECT ON public.lift_sets TO authenticated; GRANT ALL ON public.lift_sets TO service_role;
ALTER TABLE public.lift_sets ENABLE ROW LEVEL SECURITY; CREATE POLICY own_lift ON public.lift_sets FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.detox_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,minutes integer NOT NULL CHECK(minutes IN(15,30,60)),started_at timestamptz NOT NULL DEFAULT now(),ended_at timestamptz,completed boolean NOT NULL DEFAULT false,last_seen_at timestamptz NOT NULL DEFAULT now(),day date NOT NULL,season_id uuid NOT NULL REFERENCES public.seasons(id));
GRANT SELECT ON public.detox_sessions TO authenticated; GRANT ALL ON public.detox_sessions TO service_role;
ALTER TABLE public.detox_sessions ENABLE ROW LEVEL SECURITY; CREATE POLICY own_detox ON public.detox_sessions FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE UNIQUE INDEX detox_one_active ON public.detox_sessions(user_id) WHERE ended_at IS NULL;
CREATE TABLE public.detox_duels(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,week_start date NOT NULL,a_avg_min numeric,b_avg_min numeric,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','active','declined','finished')),CHECK(a<>b),UNIQUE(a,b,week_start));
GRANT SELECT ON public.detox_duels TO authenticated; GRANT ALL ON public.detox_duels TO service_role;
ALTER TABLE public.detox_duels ENABLE ROW LEVEL SECURITY; CREATE POLICY own_duels ON public.detox_duels FOR SELECT TO authenticated USING(auth.uid() IN(a,b));
CREATE TABLE public.screen_time_logs(user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,day date NOT NULL,social_minutes integer NOT NULL CHECK(social_minutes BETWEEN 0 AND 1440),proof_url text NOT NULL,PRIMARY KEY(user_id,day));
GRANT SELECT ON public.screen_time_logs TO authenticated; GRANT ALL ON public.screen_time_logs TO service_role;
ALTER TABLE public.screen_time_logs ENABLE ROW LEVEL SECURITY; CREATE POLICY own_screen_time ON public.screen_time_logs FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.buddy_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),from_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,to_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','declined','blocked')),created_at timestamptz NOT NULL DEFAULT now(),crew_id uuid REFERENCES public.crews(id),CHECK(from_user<>to_user),UNIQUE(from_user,to_user));
GRANT SELECT ON public.buddy_requests TO authenticated; GRANT ALL ON public.buddy_requests TO service_role;
ALTER TABLE public.buddy_requests ENABLE ROW LEVEL SECURITY; CREATE POLICY own_requests ON public.buddy_requests FOR SELECT TO authenticated USING(auth.uid() IN(from_user,to_user));
INSERT INTO public.buddy_requests(from_user,to_user,status,created_at) SELECT from_user,to_user,status,created_at FROM public.buddy_links WHERE status IN('accepted','pending');
COMMENT ON TABLE public.buddy_links IS 'DEPRECATED: buddy_requests is the consent and block source of truth';
CREATE TABLE public.buddy_safety_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,target uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 280),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.buddy_safety_reports TO authenticated; GRANT ALL ON public.buddy_safety_reports TO service_role;
ALTER TABLE public.buddy_safety_reports ENABLE ROW LEVEL SECURITY; CREATE POLICY own_buddy_reports ON public.buddy_safety_reports FOR SELECT TO authenticated USING(reporter=auth.uid());
CREATE TABLE public.season_reminders(user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,season_slug text NOT NULL REFERENCES public.seasons(slug),PRIMARY KEY(user_id,season_slug));
GRANT SELECT ON public.season_reminders TO authenticated; GRANT ALL ON public.season_reminders TO service_role;
ALTER TABLE public.season_reminders ENABLE ROW LEVEL SECURITY; CREATE POLICY own_season_reminders ON public.season_reminders FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.season_trophies(user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,season_id uuid NOT NULL REFERENCES public.seasons(id),awarded_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,season_id));
GRANT SELECT ON public.season_trophies TO authenticated; GRANT ALL ON public.season_trophies TO service_role;
ALTER TABLE public.season_trophies ENABLE ROW LEVEL SECURITY; CREATE POLICY own_trophies ON public.season_trophies FOR SELECT TO authenticated USING(user_id=auth.uid());
ALTER TABLE public.day_extras ADD COLUMN detox_points integer NOT NULL DEFAULT 0;
CREATE FUNCTION public.log_lift(_exercise uuid,_weight numeric,_reps integer,_unit text DEFAULT 'kg') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); d date; sid uuid; e record; prev record; kg numeric; res text; beats integer;
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
d:=public._local_today(uid); SELECT s.id INTO sid FROM seasons s JOIN season_entries se ON se.season_id=s.id AND se.user_id=uid WHERE d BETWEEN s.starts_on AND s.ends_on AND s.status='live' LIMIT 1; IF sid IS NULL THEN RAISE EXCEPTION 'season_closed'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,15));
SELECT * INTO e FROM lift_exercises WHERE id=_exercise; IF NOT FOUND OR _reps IS NULL OR _reps NOT BETWEEN 1 AND 1000 OR _unit NOT IN('kg','lb') THEN RAISE EXCEPTION 'invalid_set'; END IF;
kg:=CASE WHEN e.equipment='bodyweight' THEN NULL WHEN _unit='lb' THEN round(_weight/2.2046226218,4) ELSE _weight END;
IF e.equipment<>'bodyweight' AND (kg IS NULL OR kg<=0 OR kg>1000) THEN RAISE EXCEPTION 'invalid_set'; END IF;
SELECT * INTO prev FROM lift_sets WHERE user_id=uid AND exercise_id=_exercise AND day<d ORDER BY day DESC LIMIT 1;
res:=CASE WHEN prev.id IS NULL THEN 'match' WHEN coalesce(kg,1)*_reps>coalesce(prev.weight,1)*prev.reps THEN 'beat' WHEN coalesce(kg,1)*_reps=coalesce(prev.weight,1)*prev.reps THEN 'match' ELSE 'under' END;
INSERT INTO lift_sets(user_id,exercise_id,day,weight,reps,unit,result) VALUES(uid,_exercise,d,kg,_reps,_unit,res) ON CONFLICT(user_id,exercise_id,day) DO UPDATE SET weight=excluded.weight,reps=excluded.reps,unit=excluded.unit,result=excluded.result;
SELECT least(3,count(*)) INTO beats FROM lift_sets WHERE user_id=uid AND day=d AND result='beat';
INSERT INTO day_extras(user_id,day,lift_prs) VALUES(uid,d,beats) ON CONFLICT(user_id,day) DO UPDATE SET lift_prs=excluded.lift_prs;
PERFORM public._recompute_with_crew(uid,sid,d);
RETURN jsonb_build_object('result',res,'beats',beats,'points',beats*5);
END $$;
CREATE FUNCTION public.log_lift_session(_sets jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE x jsonb; res jsonb; BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF; IF jsonb_typeof(_sets)<>'array' OR jsonb_array_length(_sets)>9 OR jsonb_array_length(_sets)<1 THEN RAISE EXCEPTION 'invalid_set'; END IF; FOR x IN SELECT value FROM jsonb_array_elements(_sets) LOOP res:=public.log_lift((x->>'exercise')::uuid,(x->>'weight')::numeric,(x->>'reps')::integer,coalesce(x->>'unit','kg')); END LOOP; RETURN res; END $$;
CREATE FUNCTION public.detox_action(_action text,_session uuid DEFAULT NULL,_minutes integer DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sess record; sid uuid; d date; n integer; h record;
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,16)); d:=public._local_today(uid);
IF _action='start' THEN
IF _minutes NOT IN(15,30,60) THEN RAISE EXCEPTION 'invalid_duration'; END IF;
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
INSERT INTO day_extras(user_id,day,detox_points) VALUES(uid,sess.day,least(15,floor(n/30.0)::integer*5)) ON CONFLICT(user_id,day) DO UPDATE SET detox_points=excluded.detox_points;
FOR h IN SELECT uh.id,uh.target,uh.kind FROM user_habits uh JOIN habit_templates ht ON ht.id=uh.template_id WHERE uh.user_id=uid AND uh.season_id=sess.season_id AND uh.active AND ht.key='detox' LOOP
INSERT INTO checkins(user_id,user_habit_id,day,value) VALUES(uid,h.id,sess.day,CASE WHEN h.kind='count' THEN n WHEN n>=h.target THEN 1 ELSE 0 END) ON CONFLICT(user_habit_id,day) DO UPDATE SET value=excluded.value;
END LOOP;
PERFORM public._recompute_with_crew(uid,sess.season_id,sess.day);
ELSE RAISE EXCEPTION 'invalid_action'; END IF;
END IF;
END IF;
RETURN jsonb_build_object('id',sess.id,'started_at',sess.started_at,'minutes',sess.minutes,'completed',sess.completed,'ended_at',sess.ended_at);
END $$;
CREATE FUNCTION public.log_screen_time(_minutes integer,_path text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE uid uuid:=auth.uid(); BEGIN IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF; IF _minutes IS NULL OR _minutes NOT BETWEEN 0 AND 1440 OR _path NOT LIKE uid::text||'/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='proofs' AND name=_path) THEN RAISE EXCEPTION 'invalid_proof'; END IF; INSERT INTO screen_time_logs VALUES(uid,public._local_today(uid),_minutes,_path) ON CONFLICT(user_id,day) DO UPDATE SET social_minutes=excluded.social_minutes,proof_url=excluded.proof_url; END $$;
CREATE OR REPLACE FUNCTION public.buddy_action(_action text,_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); req record; sid uuid; cid uuid;
BEGIN
IF uid IS NULL OR uid=_target THEN RAISE EXCEPTION 'invalid_target'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(least(uid::text,_target::text),0)); PERFORM pg_advisory_xact_lock(hashtextextended(greatest(uid::text,_target::text),0));
IF _action IN('invite','accept') THEN
IF (SELECT birth_date IS NULL OR birth_date>current_date-interval '18 years' FROM profiles WHERE id=uid) OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=_target AND birth_date<=current_date-interval '18 years') THEN RAISE EXCEPTION 'adults_only'; END IF;
IF EXISTS(SELECT 1 FROM buddy_requests WHERE status='blocked' AND ((from_user=uid AND to_user=_target) OR (from_user=_target AND to_user=uid))) THEN RAISE EXCEPTION 'blocked'; END IF;
IF EXISTS(SELECT 1 FROM buddy_requests WHERE status='accepted' AND (uid IN(from_user,to_user) OR _target IN(from_user,to_user))) THEN RAISE EXCEPTION 'buddy_limit'; END IF;
END IF;
IF _action='invite' THEN
IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=_target AND show_on_public_board) THEN RAISE EXCEPTION 'invalid_target'; END IF;
IF EXISTS(SELECT 1 FROM buddy_requests WHERE from_user=_target AND to_user=uid AND status='pending') THEN RAISE EXCEPTION 'incoming_request'; END IF;
IF (SELECT count(*) FROM buddy_requests WHERE from_user=uid AND status='pending')>=10 THEN RAISE EXCEPTION 'too_many_requests'; END IF;
IF NOT EXISTS(SELECT 1 FROM season_entries a JOIN season_entries b USING(season_id) WHERE a.user_id=uid AND b.user_id=_target) THEN RAISE EXCEPTION 'invalid_target'; END IF;
INSERT INTO buddy_requests(from_user,to_user) VALUES(uid,_target) ON CONFLICT(from_user,to_user) DO UPDATE SET status='pending' WHERE buddy_requests.status='declined';
ELSIF _action='accept' THEN
SELECT * INTO req FROM buddy_requests WHERE from_user=_target AND to_user=uid AND status='pending' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'not_invited'; END IF;
SELECT a.season_id INTO sid FROM season_entries a JOIN season_entries b USING(season_id) JOIN seasons s ON s.id=a.season_id WHERE a.user_id=uid AND b.user_id=_target AND s.status='live' LIMIT 1; IF sid IS NULL THEN RAISE EXCEPTION 'no_season'; END IF;
INSERT INTO crews(season_id,name,code,owner_id,kind,max_members) VALUES(sid,'Duo',upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),uid,'duo',2) RETURNING id INTO cid;
INSERT INTO crew_members(crew_id,user_id,role) VALUES(cid,uid,'owner'),(cid,_target,'member');
UPDATE buddy_requests SET status='accepted',crew_id=cid WHERE id=req.id;
PERFORM public._recompute_with_crew(uid,sid,public._local_today(uid));
ELSIF _action='decline' THEN UPDATE buddy_requests SET status='declined' WHERE from_user=_target AND to_user=uid AND status='pending';
ELSIF _action IN('block','remove') THEN
FOR req IN SELECT * FROM buddy_requests WHERE (from_user=uid AND to_user=_target) OR (from_user=_target AND to_user=uid) LOOP IF req.crew_id IS NOT NULL THEN DELETE FROM crew_members WHERE crew_id=req.crew_id; END IF; END LOOP;
UPDATE buddy_requests SET status='declined' WHERE ((from_user=uid AND to_user=_target) OR (from_user=_target AND to_user=uid)) AND status<>'blocked';
IF _action='block' THEN INSERT INTO buddy_requests(from_user,to_user,status) VALUES(uid,_target,'blocked') ON CONFLICT(from_user,to_user) DO UPDATE SET status='blocked'; END IF;
ELSE RAISE EXCEPTION 'invalid_action'; END IF;
END $$;
CREATE FUNCTION public.report_buddy(_target uuid,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NULL OR auth.uid()=_target OR length(trim(_reason)) NOT BETWEEN 1 AND 280 THEN RAISE EXCEPTION 'invalid_report'; END IF; INSERT INTO buddy_safety_reports(reporter,target,reason) VALUES(auth.uid(),_target,trim(_reason)); PERFORM buddy_action('block',_target); END $$;
CREATE FUNCTION public.detox_duel_action(_action text,_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE uid uuid:=auth.uid(); wk date:=date_trunc('week',public._local_today(auth.uid()))::date; BEGIN IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF; PERFORM pg_advisory_xact_lock(hashtextextended(least(uid::text,_target::text),17)); IF _action='challenge' THEN IF EXISTS(SELECT 1 FROM buddy_requests WHERE status='blocked' AND uid IN(from_user,to_user) AND _target IN(from_user,to_user)) OR NOT(EXISTS(SELECT 1 FROM buddy_requests WHERE status='accepted' AND uid IN(from_user,to_user) AND _target IN(from_user,to_user)) OR EXISTS(SELECT 1 FROM crew_members a JOIN crew_members b USING(crew_id) WHERE a.user_id=uid AND b.user_id=_target)) OR uid=_target THEN RAISE EXCEPTION 'forbidden'; END IF; IF EXISTS(SELECT 1 FROM detox_duels WHERE week_start=wk AND status IN('pending','active') AND (uid IN(a,b) OR _target IN(a,b))) THEN RAISE EXCEPTION 'duel_limit'; END IF; INSERT INTO detox_duels(a,b,week_start) VALUES(uid,_target,wk); ELSIF _action IN('accept','decline') THEN UPDATE detox_duels SET status=CASE WHEN _action='accept' THEN 'active' ELSE 'declined' END WHERE a=_target AND b=uid AND week_start=wk AND status='pending'; ELSE RAISE EXCEPTION 'invalid_action'; END IF; END $$;
CREATE FUNCTION public.set_season_reminder(_slug text,_on boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF; IF NOT EXISTS(SELECT 1 FROM seasons WHERE slug=_slug AND status='upcoming') THEN RAISE EXCEPTION 'invalid_season'; END IF; IF _on THEN INSERT INTO season_reminders VALUES(auth.uid(),_slug) ON CONFLICT DO NOTHING; ELSE DELETE FROM season_reminders WHERE user_id=auth.uid() AND season_slug=_slug; END IF; END $$;
CREATE FUNCTION public.award_season_trophy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF (SELECT count(*) FROM daily_scores WHERE user_id=NEW.user_id AND season_id=NEW.season_id AND completion>=0.6)>=30 THEN INSERT INTO season_trophies(user_id,season_id) VALUES(NEW.user_id,NEW.season_id) ON CONFLICT DO NOTHING; END IF; RETURN NEW; END $$;
CREATE TRIGGER season_trophy_after_score AFTER INSERT OR UPDATE ON public.daily_scores FOR EACH ROW EXECUTE FUNCTION public.award_season_trophy();
REVOKE ALL ON FUNCTION public.sync_kit_preferences(),public.award_season_trophy() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.log_lift(uuid,numeric,integer,text),public.log_lift_session(jsonb),public.detox_action(text,uuid,integer),public.log_screen_time(integer,text),public.buddy_action(text,uuid),public.report_buddy(uuid,text),public.detox_duel_action(text,uuid),public.set_season_reminder(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.log_lift(uuid,numeric,integer,text),public.log_lift_session(jsonb),public.detox_action(text,uuid,integer),public.log_screen_time(integer,text),public.buddy_action(text,uuid),public.report_buddy(uuid,text),public.detox_duel_action(text,uuid),public.set_season_reminder(text,boolean) TO authenticated;