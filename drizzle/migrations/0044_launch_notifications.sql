CREATE TABLE public.notification_preferences (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, enabled jsonb NOT NULL DEFAULT '{"morning":true,"prayer":false,"risk":true,"nudge":true,"crew":true,"buddy":true,"reaction":true,"rank":true,"boss":true,"broadcast":true,"season":true}'::jsonb, push_enabled boolean NOT NULL DEFAULT false, CHECK (jsonb_typeof(enabled)='object'));
GRANT SELECT,INSERT,UPDATE ON public.notification_preferences TO authenticated; GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_notification_preferences ON public.notification_preferences FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE TABLE public.push_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,endpoint text NOT NULL UNIQUE CHECK(length(endpoint)<2048 AND endpoint LIKE 'https://%'),p256dh text NOT NULL CHECK(length(p256dh) BETWEEN 40 AND 180),auth text NOT NULL CHECK(length(auth) BETWEEN 16 AND 80),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,DELETE ON public.push_subscriptions TO authenticated; GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_push_read ON public.push_subscriptions FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_push_delete ON public.push_subscriptions FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,type text NOT NULL CHECK(type IN ('morning','prayer','risk','nudge','crew','buddy','reaction','rank','boss','broadcast','season')),event_key text NOT NULL CHECK(length(event_key)<=200),url text NOT NULL DEFAULT '/today' CHECK(url LIKE '/%' AND url NOT LIKE '//%'),created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,push_sent_at timestamptz,attempts integer NOT NULL DEFAULT 0,unique(user_id,type,event_key));
GRANT SELECT ON public.notifications TO authenticated; GRANT UPDATE(read_at) ON public.notifications TO authenticated; GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_notification_read ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_notification_seen ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE INDEX notifications_pending ON public.notifications(created_at) WHERE push_sent_at IS NULL AND attempts<5;
CREATE TABLE public.prayer_cache(user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,day date NOT NULL,city text NOT NULL,method integer NOT NULL,times jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,day));
GRANT SELECT,INSERT,UPDATE ON public.prayer_cache TO authenticated; GRANT ALL ON public.prayer_cache TO service_role;
ALTER TABLE public.prayer_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_prayer_cache ON public.prayer_cache FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public._notify(_uid uuid,_type text,_key text,_url text DEFAULT '/today') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM profiles WHERE id=_uid AND banned_at IS NULL) AND coalesce((SELECT (enabled->>_type)::boolean FROM notification_preferences WHERE user_id=_uid),_type<>'prayer') THEN
 INSERT INTO notifications(user_id,type,event_key,url) VALUES(_uid,_type,_key,_url) ON CONFLICT(user_id,type,event_key) DO NOTHING; END IF; END $$;
REVOKE ALL ON FUNCTION public._notify(uuid,text,text,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public._notify(uuid,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public._notification_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE owner_id uuid; BEGIN
 IF TG_TABLE_NAME='nudges' THEN PERFORM _notify(NEW.to_user,'nudge',NEW.crew_id::text||':'||NEW.day::text,'/community');
 ELSIF TG_TABLE_NAME='buddy_requests' AND NEW.status='pending' THEN PERFORM _notify(NEW.to_user,'buddy',NEW.id::text,'/buddies');
 ELSIF TG_TABLE_NAME='post_reactions' THEN SELECT user_id INTO owner_id FROM posts WHERE id=NEW.post_id AND NOT hidden; IF owner_id IS NOT NULL AND owner_id<>NEW.user_id THEN PERFORM _notify(owner_id,'reaction',NEW.post_id::text||':'||NEW.user_id::text,'/community'); END IF;
 ELSIF TG_TABLE_NAME='daily_scores' AND NEW.crew_sync THEN PERFORM _notify(NEW.user_id,'crew',NEW.season_id::text||':'||NEW.day::text,'/community'); END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public._notification_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notification_nudge AFTER INSERT ON public.nudges FOR EACH ROW EXECUTE FUNCTION public._notification_event();
CREATE TRIGGER notification_buddy AFTER INSERT ON public.buddy_requests FOR EACH ROW EXECUTE FUNCTION public._notification_event();
CREATE TRIGGER notification_reaction AFTER INSERT ON public.post_reactions FOR EACH ROW EXECUTE FUNCTION public._notification_event();
CREATE TRIGGER notification_crew AFTER INSERT OR UPDATE ON public.daily_scores FOR EACH ROW EXECUTE FUNCTION public._notification_event();
CREATE OR REPLACE FUNCTION public.enqueue_timed_notifications() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p record; d date; local_now timestamp; sid uuid; score record; b record; a record; pc record; prayer record; n integer:=0; BEGIN
 FOR p IN SELECT pr.*,up.prayer_reminder,up.boss_alerts FROM profiles pr LEFT JOIN user_preferences up ON up.user_id=pr.id WHERE pr.onboarded AND pr.banned_at IS NULL AND NOT pr.is_demo LOOP
 local_now:=now() AT TIME ZONE p.timezone; d:=local_now::date;
 SELECT e.season_id INTO sid FROM season_entries e JOIN seasons s ON s.id=e.season_id WHERE e.user_id=p.id AND NOT s.is_demo AND d BETWEEN s.starts_on AND s.ends_on ORDER BY e.joined_at DESC LIMIT 1;
 IF sid IS NULL THEN CONTINUE; END IF;
 IF local_now::time BETWEEN '08:00'::time AND '08:10'::time THEN PERFORM _notify(p.id,'morning',d::text); END IF;
 SELECT * INTO score FROM daily_scores WHERE user_id=p.id AND season_id=sid AND day=d;
 IF local_now::time BETWEEN '21:00'::time AND '21:10'::time AND coalesce(score.completion,0)<0.6 THEN PERFORM _notify(p.id,'risk',d::text); END IF;
 IF p.prayer_reminder THEN FOR pc IN SELECT * FROM prayer_cache WHERE user_id=p.id AND day=d LOOP FOR prayer IN SELECT * FROM jsonb_each_text(pc.times) LOOP IF local_now::time >= (prayer.value::time - interval '10 minutes')::time AND local_now::time < prayer.value::time THEN PERFORM _notify(p.id,'prayer',d::text||':'||prayer.key); END IF; END LOOP; END LOOP; END IF;
 IF coalesce(p.boss_alerts,true) THEN FOR b IN SELECT id FROM bosses WHERE season_id=sid AND NOT archived AND ends_at>now() AND ends_at<=now()+interval '24 hours' LOOP PERFORM _notify(p.id,'boss',b.id::text,'/boss'); END LOOP; END IF;
 FOR a IN SELECT * FROM announcements WHERE scheduled_at<=now() AND scheduled_at>now()-interval '1 day' AND is_demo=false AND (country IS NULL OR country=p.country_code) AND (language IS NULL OR language=p.language) AND (season_id IS NULL OR season_id=sid) LOOP PERFORM _notify(p.id,'broadcast',a.id::text); END LOOP;
 n:=n+1; END LOOP; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.enqueue_timed_notifications() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.enqueue_timed_notifications() TO service_role;