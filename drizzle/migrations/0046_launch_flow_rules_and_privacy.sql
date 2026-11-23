DROP POLICY "crews readable" ON public.crews;
CREATE POLICY crews_member_read ON public.crews FOR SELECT TO authenticated USING(owner_id=auth.uid() OR EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=crews.id AND m.user_id=auth.uid()));
REVOKE EXECUTE ON FUNCTION public._check_day_window(uuid,date),public._local_today(uuid),public.handle_new_user(),public.guard_active_challenge(),public.guard_challenge_post(),public.guard_creator_crew(),public.guard_shared_habit_delete() FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.post_daily_proof(uuid,text),public.spin_daily_chaos(uuid) FROM PUBLIC,anon;
DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef(oid) INTO def FROM pg_proc WHERE proname='recompute_day' AND pronamespace='public'::regnamespace; IF strpos(def,'IF v_sync THEN st:=st+10;END IF;')=0 THEN RAISE EXCEPTION 'scoring_contract_changed'; END IF; EXECUTE replace(def,'IF v_sync THEN st:=st+10;END IF;','IF d<=start_d THEN v_sync:=false;END IF;IF v_sync THEN st:=st+10;END IF;'); END $$;
ALTER TABLE public.notification_preferences ADD CONSTRAINT valid_notification_choices CHECK((enabled - ARRAY['morning','prayer','risk','nudge','crew','buddy','reaction','rank','boss','broadcast','season'])='{}'::jsonb AND NOT jsonb_path_exists(enabled,'$.* ? (@.type() != "boolean")'));
CREATE TABLE public.notification_rank_state(user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,season_id uuid NOT NULL REFERENCES public.seasons(id),rank integer NOT NULL,day date NOT NULL,PRIMARY KEY(user_id,season_id));
GRANT SELECT ON public.notification_rank_state TO authenticated;GRANT ALL ON public.notification_rank_state TO service_role;
ALTER TABLE public.notification_rank_state ENABLE ROW LEVEL SECURITY;CREATE POLICY own_rank_state ON public.notification_rank_state FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.launch_notification_tick() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p record;d date;local_now timestamp;s record;r record;old_rank integer;rem record;a record;usual time; BEGIN PERFORM public.enqueue_timed_notifications();
FOR p IN SELECT pr.*,up.daily_time FROM profiles pr LEFT JOIN user_preferences up ON up.user_id=pr.id WHERE pr.onboarded AND pr.account_status='active' AND NOT pr.is_demo LOOP
local_now:=now() AT TIME ZONE p.timezone;d:=local_now::date;
SELECT make_time(coalesce(round(avg(extract(hour FROM created_at AT TIME ZONE p.timezone)))::integer,extract(hour FROM coalesce(p.daily_time,'21:00'::time))::integer),0,0) INTO usual FROM checkins WHERE user_id=p.id AND created_at>now()-interval '7 days';
IF p.notif_daily AND local_now::time>=usual AND local_now::time<usual+interval '5 minutes' AND NOT EXISTS(SELECT 1 FROM daily_scores WHERE user_id=p.id AND day=d AND completion>=0.6) THEN PERFORM _notify(p.id,'morning',d::text||':usual'); END IF;
FOR rem IN SELECT ss.slug FROM season_reminders sr JOIN seasons ss ON ss.slug=sr.season_slug WHERE sr.user_id=p.id AND NOT ss.is_demo AND ss.starts_on BETWEEN d AND d+1 AND ss.status IN('upcoming','live') LOOP PERFORM _notify(p.id,'season',rem.slug,'/seasons');END LOOP;
FOR rem IN SELECT * FROM moment_reminders WHERE user_id=p.id AND read_at IS NULL AND due_at<=now() AND due_at>now()-interval '1 day' LOOP PERFORM _notify(p.id,'risk',d::text||':23');END LOOP;
FOR a IN SELECT * FROM announcements WHERE scheduled_at<=now() AND scheduled_at>now()-interval '1 day' AND NOT is_demo AND (country IS NULL OR country=p.country_code) AND (language IS NULL OR language=p.language) AND (season_id IS NULL OR EXISTS(SELECT 1 FROM season_entries WHERE season_id=a.season_id AND user_id=p.id)) LOOP PERFORM _notify(p.id,'broadcast',a.id::text);END LOOP;
END LOOP;
FOR s IN SELECT id FROM seasons WHERE NOT is_demo AND status='live' AND NOT challenge_owned LOOP
FOR r IN SELECT rr.entity,rr.rnk FROM _rank_rows(s.id,'world','season',NULL,current_date,NULL) rr JOIN profiles p ON p.id=rr.entity WHERE p.show_on_public_board AND NOT p.is_demo AND p.account_status='active' LOOP
SELECT rank INTO old_rank FROM notification_rank_state WHERE user_id=r.entity AND season_id=s.id;
IF old_rank IS NOT NULL AND old_rank<>r.rnk AND least(old_rank,r.rnk)<=10 THEN PERFORM _notify(r.entity,'rank',s.id::text||':'||current_date::text,'/ranks');END IF;
INSERT INTO notification_rank_state(user_id,season_id,rank,day) VALUES(r.entity,s.id,r.rnk,current_date) ON CONFLICT(user_id,season_id) DO UPDATE SET rank=excluded.rank,day=excluded.day;
END LOOP;END LOOP;RETURN 1;END $$;
REVOKE ALL ON FUNCTION public.launch_notification_tick() FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.launch_notification_tick() TO service_role;