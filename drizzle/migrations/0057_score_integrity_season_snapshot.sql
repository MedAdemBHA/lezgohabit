CREATE TABLE IF NOT EXISTS public.season_results(
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
 score integer NOT NULL, daily_points integer NOT NULL, boss_points integer NOT NULL,
 rank_country integer NOT NULL, rank_world integer NOT NULL, rank_crew integer, crew_id uuid,
 perfect_days integer NOT NULL, best_streak integer NOT NULL, active_days integer NOT NULL, trophy boolean NOT NULL,
 is_demo boolean NOT NULL DEFAULT false, frozen_at timestamptz NOT NULL DEFAULT now(), corrected_at timestamptz,
 PRIMARY KEY(user_id,season_id));
GRANT SELECT ON public.season_results TO authenticated;
GRANT ALL ON public.season_results TO service_role;
ALTER TABLE public.season_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own season results" ON public.season_results;
CREATE POLICY "own season results" ON public.season_results FOR SELECT TO authenticated USING (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.crew_results(
 crew_id uuid NOT NULL, season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
 name text NOT NULL, score integer NOT NULL, rank integer NOT NULL, members integer NOT NULL,
 is_demo boolean NOT NULL DEFAULT false, frozen_at timestamptz NOT NULL DEFAULT now(), corrected_at timestamptz,
 PRIMARY KEY(crew_id,season_id));
GRANT SELECT ON public.crew_results TO authenticated;
GRANT ALL ON public.crew_results TO service_role;
ALTER TABLE public.crew_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crew results same world" ON public.crew_results;
CREATE POLICY "crew results same world" ON public.crew_results FOR SELECT TO authenticated USING (is_demo=public._viewer_demo());

CREATE OR REPLACE FUNCTION public.guard_frozen_result() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF public._final_override() THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_OP='DELETE' AND (OLD.is_demo OR NOT EXISTS(SELECT 1 FROM public.seasons WHERE id=OLD.season_id)) THEN RETURN OLD; END IF;
 IF TG_OP='DELETE' AND TG_TABLE_NAME='season_results' THEN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 END IF;
 RAISE EXCEPTION 'season_frozen';
END $fn$;
DROP TRIGGER IF EXISTS frozen_guard ON public.season_results;
CREATE TRIGGER frozen_guard BEFORE UPDATE OR DELETE ON public.season_results FOR EACH ROW EXECUTE FUNCTION public.guard_frozen_result();
DROP TRIGGER IF EXISTS frozen_guard ON public.crew_results;
CREATE TRIGGER frozen_guard BEFORE UPDATE OR DELETE ON public.crew_results FOR EACH ROW EXECUTE FUNCTION public.guard_frozen_result();

CREATE OR REPLACE FUNCTION public._freeze_season(_sid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE s public.seasons; r record;
BEGIN
 SELECT * INTO s FROM public.seasons WHERE id=_sid FOR UPDATE;
 IF NOT FOUND OR s.frozen_at IS NOT NULL THEN RETURN; END IF;
 FOR r IN SELECT e.user_id FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.season_id=_sid LOOP
  PERFORM public._finalize_user_day(r.user_id,_sid,s.ends_on);
 END LOOP;
 INSERT INTO public.season_results(user_id,season_id,score,daily_points,boss_points,rank_country,rank_world,rank_crew,crew_id,perfect_days,best_streak,active_days,trophy,is_demo)
 WITH base AS (
  SELECT e.user_id,p.country_code,p.is_demo,e.joined_at,
   coalesce((SELECT sum(total) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid AND ds.day BETWEEN s.starts_on AND s.ends_on),0)::int daily,
   coalesce((SELECT sum(points) FROM public.bonus_points bp WHERE bp.user_id=e.user_id AND bp.season_id=_sid),0)::int boss,
   (SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid AND ds.perfect AND ds.day BETWEEN s.starts_on AND s.ends_on)::int perfect,
   coalesce((SELECT max(streak) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid),0) best,
   (SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid AND ds.completion>=0.6 AND ds.day BETWEEN s.starts_on AND s.ends_on)::int active,
   coalesce((SELECT streak FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid ORDER BY day DESC LIMIT 1),0) last_streak,
   (SELECT cm.crew_id FROM public.crew_members cm JOIN public.crews c ON c.id=cm.crew_id WHERE cm.user_id=e.user_id AND c.season_id=_sid AND c.kind<>'duo' LIMIT 1) crew
  FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.season_id=_sid AND p.account_status='active')
 SELECT user_id,_sid,daily+boss,daily,boss,
  row_number() OVER(PARTITION BY is_demo,country_code ORDER BY daily+boss DESC,last_streak DESC,joined_at,user_id),
  row_number() OVER(PARTITION BY is_demo ORDER BY daily+boss DESC,last_streak DESC,joined_at,user_id),
  CASE WHEN crew IS NOT NULL THEN row_number() OVER(PARTITION BY crew ORDER BY daily+boss DESC,last_streak DESC,joined_at,user_id) END,
  crew,perfect,best,active,active>=30,is_demo FROM base
 ON CONFLICT DO NOTHING;
 INSERT INTO public.crew_results(crew_id,season_id,name,score,rank,members,is_demo)
 SELECT c.id,_sid,c.name,coalesce(sum(r.score),0)::int,row_number() OVER(PARTITION BY c.is_demo ORDER BY coalesce(sum(r.score),0) DESC,c.created_at,c.id),count(r.user_id)::int,c.is_demo
 FROM public.crews c LEFT JOIN public.season_results r ON r.crew_id=c.id AND r.season_id=_sid
 WHERE c.season_id=_sid AND c.kind<>'duo' GROUP BY c.id,c.name,c.is_demo,c.created_at ON CONFLICT DO NOTHING;
 INSERT INTO public.season_trophies(user_id,season_id,is_demo) SELECT user_id,_sid,is_demo FROM public.season_results WHERE season_id=_sid AND trophy ON CONFLICT DO NOTHING;
 UPDATE public.seasons SET frozen_at=now() WHERE id=_sid;
END $fn$;

CREATE OR REPLACE FUNCTION public.freeze_due_seasons() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE s record; n integer:=0;
BEGIN
 FOR s IN SELECT id FROM public.seasons WHERE frozen_at IS NULL AND NOT is_demo AND now()>=((ends_on+1)::timestamp AT TIME ZONE 'Africa/Tunis')+interval '3 hours' LOOP
  PERFORM public._freeze_season(s.id); n:=n+1;
 END LOOP;
 RETURN n;
END $fn$;

CREATE OR REPLACE FUNCTION public.integrity_tick() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 RETURN jsonb_build_object('finalized',public.finalize_due_days(),'frozen',public.freeze_due_seasons());
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_correct_season_result(_user uuid,_season uuid,_score integer,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE old integer;
BEGIN
 PERFORM public._require_admin();
 IF char_length(trim(coalesce(_reason,'')))<5 THEN RAISE EXCEPTION 'reason_required'; END IF;
 IF _score IS NULL OR _score<0 THEN RAISE EXCEPTION 'invalid_score'; END IF;
 SELECT score INTO old FROM public.season_results WHERE user_id=_user AND season_id=_season;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM set_config('lezgo.final_override','on',true);
 UPDATE public.season_results SET score=_score,corrected_at=now() WHERE user_id=_user AND season_id=_season;
 PERFORM set_config('lezgo.final_override','off',true);
 PERFORM public._admin_audit('correct_season_result',_user::text,jsonb_build_object('season',_season,'before',old,'after',_score,'reason',trim(_reason)));
END $fn$;

CREATE OR REPLACE FUNCTION public.my_season_result(_season_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
 SELECT to_jsonb(r) FROM public.season_results r WHERE r.user_id=auth.uid() AND r.season_id=_season_id $fn$;

CREATE OR REPLACE FUNCTION public.wrapped_summary(_season_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE uid uuid:=auth.uid(); s public.seasons; p public.profiles; r jsonb; BEGIN IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF; SELECT * INTO s FROM public.seasons WHERE id=_season_id; SELECT * INTO p FROM public.profiles WHERE id=uid; IF NOT EXISTS(SELECT 1 FROM public.season_entries WHERE season_id=_season_id AND user_id=uid) THEN RAISE EXCEPTION 'forbidden'; END IF; IF public._local_today(uid)<s.ends_on AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid AND email='demo@lezgo.app') THEN RETURN jsonb_build_object('locked',true,'ends_on',s.ends_on); END IF; SELECT jsonb_build_object('locked',false,'result',(SELECT to_jsonb(sr) FROM public.season_results sr WHERE sr.user_id=uid AND sr.season_id=_season_id),'season',to_jsonb(s),'handle',p.handle,'days',(SELECT count(DISTINCT ci.day) FROM public.checkins ci JOIN public.user_habits h ON h.id=ci.user_habit_id WHERE ci.user_id=uid AND h.season_id=_season_id AND ci.value>0),'rank',coalesce((SELECT sr.rank_country FROM public.season_results sr WHERE sr.user_id=uid AND sr.season_id=_season_id),(SELECT rr.rnk FROM public._rank_rows(_season_id,'country','season',p.country_code,least(public._local_today(uid),s.ends_on),uid) rr WHERE rr.entity=uid)),'stats',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT ht.key,ht.name,h.unit,h.kind,CASE WHEN ht.key IN ('sleep','sleep7') THEN round(avg(ci.value),2) WHEN h.kind='count' THEN sum(ci.value) ELSE count(ci.id) FILTER(WHERE ci.value>0)::numeric END value FROM public.user_habits h JOIN public.habit_templates ht ON ht.id=h.template_id JOIN public.checkins ci ON ci.user_habit_id=h.id WHERE h.user_id=uid AND h.season_id=_season_id AND (NOT ht.is_faith OR p.faith_public) GROUP BY ht.key,ht.name,h.unit,h.kind,h.position ORDER BY count(ci.id) DESC,h.position LIMIT 5) x),'[]'::jsonb),'lift_days',(SELECT count(DISTINCT day) FROM public.lift_sets WHERE user_id=uid AND day BETWEEN s.starts_on AND s.ends_on),'bosses_done',(SELECT count(DISTINCT boss_id) FROM public.bonus_points WHERE user_id=uid AND season_id=_season_id),'bosses_total',(SELECT count(*) FROM public.bosses WHERE season_id=_season_id),'crew',(SELECT jsonb_build_object('name',c.name,'code',c.code) FROM public.crews c JOIN public.crew_members m ON m.crew_id=c.id WHERE m.user_id=uid AND c.season_id=_season_id LIMIT 1),'capsule',(public.capsule_read(_season_id)->>'body')) INTO r; RETURN r; END $function$;

REVOKE ALL ON FUNCTION public.guard_frozen_result(), public._freeze_season(uuid), public.freeze_due_seasons(), public.integrity_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integrity_tick() TO service_role;
REVOKE ALL ON FUNCTION public.admin_correct_season_result(uuid,uuid,integer,text), public.my_season_result(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_correct_season_result(uuid,uuid,integer,text), public.my_season_result(uuid) TO authenticated;