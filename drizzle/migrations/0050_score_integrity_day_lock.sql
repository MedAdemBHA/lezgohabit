ALTER TABLE public.daily_scores ADD COLUMN IF NOT EXISTS finalized_at timestamptz, ADD COLUMN IF NOT EXISTS tz text;
CREATE INDEX IF NOT EXISTS daily_scores_open_idx ON public.daily_scores(user_id,season_id,day) WHERE finalized_at IS NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone_changed_at timestamptz, ADD COLUMN IF NOT EXISTS pending_timezone text, ADD COLUMN IF NOT EXISTS pending_timezone_from date;
ALTER TABLE public.day_extras ADD COLUMN IF NOT EXISTS proof_post_id uuid;
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS frozen_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS bonus_points_one_per_boss ON public.bonus_points(user_id,boss_id);

CREATE OR REPLACE FUNCTION public._final_override() RETURNS boolean LANGUAGE sql STABLE SET search_path=public AS $$ SELECT coalesce(current_setting('lezgo.final_override',true),'')='on' $$;
CREATE OR REPLACE FUNCTION public._effective_tz(_uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN p.pending_timezone IS NOT NULL AND (now() AT TIME ZONE p.timezone)::date>=p.pending_timezone_from THEN p.pending_timezone ELSE p.timezone END FROM public.profiles p WHERE p.id=_uid $$;
CREATE OR REPLACE FUNCTION public._local_today(_user_id uuid) RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN coalesce(p.is_demo,false) AND p.demo_today IS NOT NULL THEN p.demo_today ELSE (now() AT TIME ZONE coalesce(public._effective_tz(_user_id),'Africa/Tunis'))::date END
 FROM (SELECT 1) x LEFT JOIN public.profiles p ON p.id=_user_id $$;
CREATE OR REPLACE FUNCTION public._day_is_final(_uid uuid,_day date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.daily_scores WHERE user_id=_uid AND day=_day AND finalized_at IS NOT NULL) OR EXISTS(SELECT 1 FROM public.day_closes WHERE user_id=_uid AND day=_day) $$;
CREATE OR REPLACE FUNCTION public._check_day_window(_user_id uuid,_day date) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE ts timestamp; today date;
BEGIN
 IF public._day_is_final(_user_id,_day) THEN RAISE EXCEPTION 'day_final'; END IF;
 ts:=now() AT TIME ZONE coalesce(public._effective_tz(_user_id),'Africa/Tunis'); today:=public._local_today(_user_id);
 IF _day=today OR (_day=today-1 AND ts::time<time '03:00') THEN RETURN; END IF;
 RAISE EXCEPTION 'day_final';
END $$;
CREATE OR REPLACE FUNCTION public._caller_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin AND NOT is_demo AND account_status='active') $$;
CREATE OR REPLACE FUNCTION public._viewer_demo() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT is_demo FROM public.profiles WHERE id=auth.uid()),false) $$;

CREATE OR REPLACE FUNCTION public.guard_final_day() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public._final_override() OR (NEW.is_demo AND (auth.uid() IS NULL OR public._caller_is_admin())) THEN RETURN NEW; END IF;
 IF public._day_is_final(NEW.user_id,NEW.day) THEN RAISE EXCEPTION 'day_final'; END IF;
 IF TG_OP='UPDATE' AND (OLD.day<>NEW.day OR OLD.user_id<>NEW.user_id) AND public._day_is_final(OLD.user_id,OLD.day) THEN RAISE EXCEPTION 'day_final'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS final_day_guard ON public.checkins;
CREATE TRIGGER final_day_guard BEFORE INSERT OR UPDATE ON public.checkins FOR EACH ROW EXECUTE FUNCTION public.guard_final_day();
DROP TRIGGER IF EXISTS final_day_guard ON public.day_extras;
CREATE TRIGGER final_day_guard BEFORE INSERT OR UPDATE ON public.day_extras FOR EACH ROW EXECUTE FUNCTION public.guard_final_day();
DROP TRIGGER IF EXISTS final_day_guard ON public.lift_sets;
CREATE TRIGGER final_day_guard BEFORE INSERT OR UPDATE ON public.lift_sets FOR EACH ROW EXECUTE FUNCTION public.guard_final_day();

CREATE OR REPLACE FUNCTION public.guard_final_score() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.finalized_at IS NOT NULL AND NOT public._final_override() AND NOT (OLD.is_demo AND (auth.uid() IS NULL OR public._caller_is_admin())) THEN RAISE EXCEPTION 'day_final'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS final_score_guard ON public.daily_scores;
CREATE TRIGGER final_score_guard BEFORE UPDATE ON public.daily_scores FOR EACH ROW EXECUTE FUNCTION public.guard_final_score();

CREATE OR REPLACE FUNCTION public.guard_timezone_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public._final_override() OR auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NEW.timezone IS NOT DISTINCT FROM OLD.timezone THEN
  NEW.pending_timezone:=OLD.pending_timezone; NEW.pending_timezone_from:=OLD.pending_timezone_from; NEW.timezone_changed_at:=OLD.timezone_changed_at; RETURN NEW;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'invalid_timezone'; END IF;
 IF NOT OLD.onboarded THEN RETURN NEW; END IF;
 IF OLD.timezone_changed_at IS NOT NULL AND OLD.timezone_changed_at>now()-interval '7 days' THEN RAISE EXCEPTION 'timezone_locked'; END IF;
 NEW.pending_timezone:=NEW.timezone; NEW.pending_timezone_from:=(now() AT TIME ZONE OLD.timezone)::date+1;
 NEW.timezone:=OLD.timezone; NEW.timezone_changed_at:=now();
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS timezone_change_guard ON public.profiles;
CREATE TRIGGER timezone_change_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_timezone_change();

CREATE TABLE IF NOT EXISTS public.checkin_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL, user_habit_id uuid NOT NULL, day date NOT NULL,
 old_value numeric, new_value numeric, old_detail jsonb, new_detail jsonb,
 at timestamptz NOT NULL DEFAULT now(), is_demo boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.checkin_events TO authenticated;
GRANT ALL ON public.checkin_events TO service_role;
ALTER TABLE public.checkin_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own checkin events" ON public.checkin_events;
CREATE POLICY "own checkin events" ON public.checkin_events FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE INDEX IF NOT EXISTS checkin_events_user_idx ON public.checkin_events(user_id,at);
CREATE OR REPLACE FUNCTION public.log_checkin_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.value IS NOT DISTINCT FROM NEW.value AND OLD.detail IS NOT DISTINCT FROM NEW.detail THEN RETURN NEW; END IF;
 INSERT INTO public.checkin_events(user_id,user_habit_id,day,old_value,new_value,old_detail,new_detail,is_demo)
 VALUES(NEW.user_id,NEW.user_habit_id,NEW.day,CASE WHEN TG_OP='UPDATE' THEN OLD.value END,NEW.value,CASE WHEN TG_OP='UPDATE' THEN OLD.detail END,NEW.detail,NEW.is_demo);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS checkin_event_log ON public.checkins;
CREATE TRIGGER checkin_event_log AFTER INSERT OR UPDATE ON public.checkins FOR EACH ROW EXECUTE FUNCTION public.log_checkin_event();
CREATE OR REPLACE FUNCTION public.guard_append_only() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' AND (OLD.is_demo OR public._final_override()) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'append_only';
END $$;
DROP TRIGGER IF EXISTS checkin_events_append_only ON public.checkin_events;
CREATE TRIGGER checkin_events_append_only BEFORE UPDATE OR DELETE ON public.checkin_events FOR EACH ROW EXECUTE FUNCTION public.guard_append_only();

-- Detox minutes count inside the shared 65-point stack cap (documented in How scoring works).
CREATE OR REPLACE FUNCTION public.recompute_day(_user_id uuid, _season_id uuid, _day date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s record;tz text;today date;start_d date;end_d date;d date;n int;comp numeric;allfull boolean;hp numeric;st numeric;mult numeric;tot int;v_streak int:=0;prev_missed boolean:=false;v_cb_used boolean:=false;shield_weeks date[]:='{}';wk date;v_shield boolean;v_cb boolean;v_perfect boolean;v_crew uuid;v_sync boolean;ex record;joined timestamptz;fr record;
BEGIN
SELECT * INTO s FROM seasons WHERE id=_season_id;IF NOT FOUND THEN RETURN;END IF;
SELECT joined_at INTO joined FROM season_entries WHERE user_id=_user_id AND season_id=_season_id;IF joined IS NULL THEN RETURN;END IF;
tz:=coalesce(public._effective_tz(_user_id),'Africa/Tunis');today:=public._local_today(_user_id);start_d:=greatest(s.starts_on,(joined AT TIME ZONE tz)::date);end_d:=least(s.ends_on,today);
SELECT count(*) INTO n FROM user_habits WHERE user_id=_user_id AND season_id=_season_id AND active;
SELECT cm.crew_id INTO v_crew FROM crew_members cm JOIN crews c ON c.id=cm.crew_id WHERE cm.user_id=_user_id AND c.season_id=_season_id AND c.kind<>'duo' LIMIT 1;
d:=start_d;
WHILE d<=end_d LOOP
SELECT * INTO fr FROM daily_scores WHERE user_id=_user_id AND season_id=_season_id AND day=d AND finalized_at IS NOT NULL;
IF FOUND THEN v_streak:=fr.streak;IF fr.shield_used THEN shield_weeks:=shield_weeks||date_trunc('week',d)::date;END IF;IF fr.comeback THEN v_cb_used:=true;END IF;prev_missed:=fr.completion<0.6 AND NOT fr.shield_used AND d<>today;d:=d+1;CONTINUE;END IF;
IF n=0 THEN comp:=0;allfull:=false;ELSE SELECT coalesce(avg(x.c),0),coalesce(bool_and(x.c>=1),false) INTO comp,allfull FROM(SELECT public._habit_completion(h.kind,h.target,ci.value,ci.detail) c FROM user_habits h LEFT JOIN checkins ci ON ci.user_habit_id=h.id AND ci.day=d WHERE h.user_id=_user_id AND h.season_id=_season_id AND h.active)x;END IF;
v_perfect:=n>0 AND allfull;v_shield:=false;v_cb:=false;
IF comp>=0.6 THEN v_streak:=v_streak+1;ELSIF d<>today THEN wk:=date_trunc('week',d)::date;IF v_streak>0 AND NOT(wk=ANY(shield_weeks)) THEN v_shield:=true;shield_weeks:=shield_weeks||wk;ELSE v_streak:=0;END IF;END IF;
IF EXISTS(SELECT 1 FROM admin_streak_resets WHERE user_id=_user_id AND season_id=_season_id AND day=d) THEN v_streak:=0; END IF;hp:=100*comp;IF prev_missed AND NOT v_cb_used AND comp>0 THEN v_cb:=true;v_cb_used:=true;hp:=least(200,hp*2);END IF;
st:=CASE WHEN v_perfect THEN 20 ELSE 0 END;SELECT * INTO ex FROM day_extras WHERE user_id=_user_id AND day=d;
IF coalesce(ex.proof_posted,false) THEN st:=st+10;END IF;IF coalesce(ex.chaos_done,false) THEN st:=st+10;END IF;st:=st+least(coalesce(ex.lift_prs,0)*5,15);v_sync:=false;
IF v_crew IS NOT NULL AND v_perfect AND (SELECT count(*) FROM crew_members WHERE crew_id=v_crew)>=2 AND NOT EXISTS(SELECT 1 FROM crew_members m WHERE m.crew_id=v_crew AND (NOT EXISTS(SELECT 1 FROM user_habits h WHERE h.user_id=m.user_id AND h.season_id=_season_id AND h.active) OR EXISTS(SELECT 1 FROM user_habits h LEFT JOIN checkins ci ON ci.user_habit_id=h.id AND ci.day=d WHERE h.user_id=m.user_id AND h.season_id=_season_id AND h.active AND public._habit_completion(h.kind,h.target,ci.value,ci.detail)<1))) THEN v_sync:=true;END IF;
IF EXISTS(SELECT 1 FROM buddy_requests r JOIN crews c ON c.id=r.crew_id WHERE r.status='accepted' AND _user_id IN(r.from_user,r.to_user) AND c.season_id=_season_id AND EXISTS(SELECT 1 FROM crew_members WHERE crew_id=c.id AND user_id=r.from_user) AND EXISTS(SELECT 1 FROM crew_members WHERE crew_id=c.id AND user_id=r.to_user) AND EXISTS(SELECT 1 FROM checkins ci JOIN user_habits h ON h.id=ci.user_habit_id WHERE ci.user_id=r.from_user AND ci.day=d AND ci.value>0 AND h.season_id=_season_id AND h.active) AND EXISTS(SELECT 1 FROM checkins ci JOIN user_habits h ON h.id=ci.user_habit_id WHERE ci.user_id=r.to_user AND ci.day=d AND ci.value>0 AND h.season_id=_season_id AND h.active)) THEN v_sync:=true;END IF;
IF d<=start_d THEN v_sync:=false;END IF;IF v_sync THEN st:=st+10;END IF;st:=least(65,st+coalesce(ex.detox_points,0));mult:=least(1+0.05*v_streak,1.5);tot:=floor((hp+st)*mult);
INSERT INTO daily_scores(user_id,season_id,day,habit_points,stack_points,multiplier,total,completion,perfect,streak,shield_used,comeback,crew_sync,tz) VALUES(_user_id,_season_id,d,round(hp,2),st,mult,tot,round(comp,4),v_perfect,v_streak,v_shield,v_cb,v_sync,tz) ON CONFLICT(user_id,season_id,day) DO UPDATE SET habit_points=excluded.habit_points,stack_points=excluded.stack_points,multiplier=excluded.multiplier,total=excluded.total,completion=excluded.completion,perfect=excluded.perfect,streak=excluded.streak,shield_used=excluded.shield_used,comeback=excluded.comeback,crew_sync=excluded.crew_sync,tz=coalesce(daily_scores.tz,excluded.tz);
prev_missed:=comp<0.6 AND NOT v_shield AND d<>today;d:=d+1;
END LOOP;UPDATE season_entries SET comeback_used=v_cb_used WHERE user_id=_user_id AND season_id=_season_id;
END $function$;

CREATE OR REPLACE FUNCTION public._finalize_user_day(_uid uuid,_sid uuid,_day date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.recompute_day(_uid,_sid,_day);
 UPDATE public.daily_scores SET finalized_at=now() WHERE user_id=_uid AND season_id=_sid AND day<=_day AND finalized_at IS NULL;
END $$;
CREATE OR REPLACE FUNCTION public.finalize_due_days() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; n integer:=0;
BEGIN
 PERFORM set_config('lezgo.final_override','on',true);
 UPDATE public.profiles SET timezone=pending_timezone,pending_timezone=NULL,pending_timezone_from=NULL
  WHERE pending_timezone IS NOT NULL AND (now() AT TIME ZONE timezone)::date>=pending_timezone_from;
 PERFORM set_config('lezgo.final_override','off',true);
 FOR r IN
  SELECT x.* FROM (
   SELECT e.user_id,e.season_id,s.starts_on,s.ends_on,(e.joined_at AT TIME ZONE coalesce(public._effective_tz(e.user_id),'Africa/Tunis'))::date joined_d,
    least(s.ends_on,public._local_today(e.user_id)-CASE WHEN (now() AT TIME ZONE coalesce(public._effective_tz(e.user_id),'Africa/Tunis'))::time>=time '03:00' THEN 1 ELSE 2 END) due
   FROM public.season_entries e JOIN public.seasons s ON s.id=e.season_id JOIN public.profiles p ON p.id=e.user_id
   WHERE p.account_status='active' AND s.frozen_at IS NULL) x
  WHERE x.due>=greatest(x.starts_on,x.joined_d)
   AND (EXISTS(SELECT 1 FROM public.daily_scores d WHERE d.user_id=x.user_id AND d.season_id=x.season_id AND d.day<=x.due AND d.finalized_at IS NULL)
        OR NOT EXISTS(SELECT 1 FROM public.daily_scores d WHERE d.user_id=x.user_id AND d.season_id=x.season_id AND d.day=x.due))
 LOOP
  PERFORM public._finalize_user_day(r.user_id,r.season_id,r.due); n:=n+1;
 END LOOP;
 RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.close_my_day(_mood text,_tomorrow text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); d date; s record;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=uid AND account_status='active') THEN RAISE EXCEPTION 'forbidden'; END IF;
 d:=public._local_today(uid);
 FOR s IN SELECT e.season_id FROM public.season_entries e JOIN public.seasons x ON x.id=e.season_id WHERE e.user_id=uid AND d BETWEEN x.starts_on AND x.ends_on AND x.frozen_at IS NULL LOOP
  PERFORM public._recompute_with_crew(uid,s.season_id,d);
  PERFORM public._finalize_user_day(uid,s.season_id,d);
 END LOOP;
 INSERT INTO public.day_closes(user_id,day,mood,tomorrow,is_demo) SELECT id,d,_mood,coalesce(_tomorrow,''),is_demo FROM public.profiles WHERE id=uid
 ON CONFLICT(user_id,day) DO UPDATE SET mood=excluded.mood,tomorrow=excluded.tomorrow;
END $$;

CREATE OR REPLACE FUNCTION public.admin_recompute_final_day(_user uuid,_season uuid,_day date,_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; before jsonb;
BEGIN
 PERFORM public._require_admin();
 IF char_length(trim(coalesce(_reason,'')))<5 THEN RAISE EXCEPTION 'reason_required'; END IF;
 SELECT to_jsonb(ds) INTO before FROM public.daily_scores ds WHERE user_id=_user AND season_id=_season AND day=_day;
 PERFORM set_config('lezgo.final_override','on',true);
 UPDATE public.daily_scores SET finalized_at=NULL WHERE user_id=_user AND season_id=_season AND day=_day;
 PERFORM public.recompute_day(_user,_season,_day);
 UPDATE public.daily_scores SET finalized_at=now() WHERE user_id=_user AND season_id=_season AND day=_day;
 PERFORM set_config('lezgo.final_override','off',true);
 SELECT to_jsonb(ds) INTO r FROM public.daily_scores ds WHERE user_id=_user AND season_id=_season AND day=_day;
 PERFORM public._admin_audit('recompute_final_day',_user::text,jsonb_build_object('season',_season,'day',_day,'reason',trim(_reason),'before',before->'total','after',r->'total'));
 RETURN r;
END $$;

REVOKE ALL ON FUNCTION public._final_override(), public._effective_tz(uuid), public._day_is_final(uuid,date), public._caller_is_admin(),
 public._finalize_user_day(uuid,uuid,date), public.finalize_due_days(), public.guard_final_day(), public.guard_final_score(), public.guard_timezone_change(),
 public.log_checkin_event(), public.guard_append_only(), public._check_day_window(uuid,date), public._local_today(uuid), public.recompute_day(uuid,uuid,date)
 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_recompute_final_day(uuid,uuid,date,text), public.close_my_day(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recompute_final_day(uuid,uuid,date,text), public.close_my_day(text,text) TO authenticated;