CREATE TABLE public.badges (user_id uuid NOT NULL, season_id uuid NOT NULL REFERENCES public.seasons(id), key text NOT NULL, awarded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,season_id,key));
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own badges" ON public.badges FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE OR REPLACE FUNCTION public._award_badges(_uid uuid,_sid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.badges(user_id,season_id,key)
 SELECT _uid,_sid,b.key FROM (VALUES
 ('first_go', EXISTS(SELECT 1 FROM public.checkins ci JOIN public.user_habits h ON h.id=ci.user_habit_id WHERE ci.user_id=_uid AND h.season_id=_sid AND ci.value>0)),
 ('streak7', EXISTS(SELECT 1 FROM public.daily_scores WHERE user_id=_uid AND season_id=_sid AND streak>=7)),
 ('salat5', EXISTS(SELECT 1 FROM public.checkins ci JOIN public.user_habits h ON h.id=ci.user_habit_id WHERE ci.user_id=_uid AND h.season_id=_sid AND h.kind='salat' AND ci.detail->'prayers' @> '{"fajr":"on_time","dhuhr":"on_time","asr":"on_time","maghrib":"on_time","isha":"on_time"}'::jsonb)),
 ('perfect5', (SELECT count(*) FROM public.daily_scores WHERE user_id=_uid AND season_id=_sid AND perfect)>=5),
 ('sugar7', EXISTS(SELECT 1 FROM (SELECT ci.day,ci.day-row_number() OVER(PARTITION BY h.id ORDER BY ci.day)::int AS grp,h.id FROM public.checkins ci JOIN public.user_habits h ON h.id=ci.user_habit_id JOIN public.habit_templates ht ON ht.id=h.template_id WHERE ci.user_id=_uid AND h.season_id=_sid AND ht.key IN ('no_sugar','sugar_free_coffee') AND public._habit_completion(h.kind,h.target,ci.value,ci.detail)>=1) x GROUP BY id,grp HAVING count(*)>=7))
 ) b(key,eligible) WHERE b.eligible ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public._award_badges(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public._score_badges_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public._award_badges(NEW.user_id,NEW.season_id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public._score_badges_trigger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER score_badges AFTER INSERT OR UPDATE ON public.daily_scores FOR EACH ROW EXECUTE FUNCTION public._score_badges_trigger();
CREATE OR REPLACE FUNCTION public._best_habit_stat(_uid uuid,_sid uuid,_viewer uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('value',x.value,'name',x.name,'kind',x.kind,'key',x.key,'faith',x.is_faith) FROM (
 SELECT h.id,h.kind,ht.key,coalesce(ht.is_faith,false) AS is_faith,coalesce(ht.name,jsonb_build_object('en',h.custom_name,'fr',h.custom_name,'ar',h.custom_name,'aeb',h.custom_name)) AS name,
 CASE WHEN h.kind='salat' THEN coalesce(sum((SELECT count(*) FROM jsonb_each_text(coalesce(ci.detail->'prayers','{}'::jsonb)) v WHERE v.value='on_time')),0)
 WHEN h.kind='count' THEN coalesce(sum(ci.value),0) ELSE count(ci.id) FILTER(WHERE ci.value>0) END AS value
 FROM public.user_habits h JOIN public.profiles p ON p.id=h.user_id LEFT JOIN public.habit_templates ht ON ht.id=h.template_id LEFT JOIN public.checkins ci ON ci.user_habit_id=h.id
 WHERE h.user_id=_uid AND h.season_id=_sid AND (NOT coalesce(ht.is_faith,false) OR p.faith_public OR _viewer=_uid)
 GROUP BY h.id,ht.key,ht.is_faith,ht.name ORDER BY value DESC,h.position LIMIT 1) x
$$;
REVOKE ALL ON FUNCTION public._best_habit_stat(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public._rank_rows(_sid uuid,_scope text,_period text,_country text,_day date,_viewer uuid) RETURNS TABLE(entity uuid,rnk bigint,points bigint,streak int,joined timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH bounds AS (SELECT CASE _period WHEN 'today' THEN _day WHEN 'week' THEN date_trunc('week',_day)::date ELSE s.starts_on END AS since FROM public.seasons s WHERE s.id=_sid), base AS (
 SELECT e.user_id AS entity,coalesce(sum(ds.total),0)::bigint AS points,coalesce((SELECT d.streak FROM public.daily_scores d WHERE d.user_id=e.user_id AND d.season_id=_sid AND d.day<=_day ORDER BY d.day DESC LIMIT 1),0) AS streak,e.joined_at AS joined
 FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id CROSS JOIN bounds b LEFT JOIN public.daily_scores ds ON ds.user_id=e.user_id AND ds.season_id=_sid AND ds.day BETWEEN b.since AND _day
 WHERE _scope<>'crews' AND e.season_id=_sid AND e.joined_at<( _day+1)::timestamp AT TIME ZONE p.timezone AND (_scope<>'country' OR p.country_code=_country) AND (p.show_on_public_board OR e.user_id=_viewer)
 GROUP BY e.user_id,e.joined_at
 UNION ALL
 SELECT c.id,coalesce(sum(ds.total),0)::bigint,0,c.created_at FROM public.crews c CROSS JOIN bounds b LEFT JOIN public.crew_members m ON m.crew_id=c.id LEFT JOIN public.daily_scores ds ON ds.user_id=m.user_id AND ds.season_id=_sid AND ds.day BETWEEN b.since AND _day
 WHERE _scope='crews' AND c.season_id=_sid AND c.created_at<(_day+1)::timestamp AT TIME ZONE 'Africa/Tunis' GROUP BY c.id
 ) SELECT entity,row_number() OVER(ORDER BY points DESC,streak DESC,joined ASC,entity),points,streak,joined FROM base
$$;
REVOKE ALL ON FUNCTION public._rank_rows(uuid,text,text,text,date,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.scoreboard(_season_id uuid,_scope text,_period text,_country_code text DEFAULT 'TN') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); d date; res jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _scope NOT IN ('world','country','crews') OR _period NOT IN ('today','week','season') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
 d:=public._local_today(uid);
 WITH current_rows AS (SELECT * FROM public._rank_rows(_season_id,_scope,_period,_country_code,d,uid)), yesterday AS (SELECT * FROM public._rank_rows(_season_id,_scope,_period,_country_code,d-1,uid)), rendered AS (
 SELECT r.rnk,CASE WHEN _scope='crews' THEN EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=r.entity AND m.user_id=uid) ELSE r.entity=uid END AS mine,
 jsonb_build_object('rank',r.rnk,'user_id',CASE WHEN _scope<>'crews' THEN r.entity END,'crew_id',CASE WHEN _scope='crews' THEN r.entity END,'display_name',coalesce(p.display_name,c.name),'handle',p.handle,'avatar_url',p.avatar_url,'country_code',p.country_code,'streak',r.streak,'points',r.points,'previous_rank',y.rnk,'is_me',CASE WHEN _scope='crews' THEN EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=r.entity AND m.user_id=uid) ELSE r.entity=uid END,'members',CASE WHEN _scope='crews' THEN (SELECT count(*) FROM public.crew_members m WHERE m.crew_id=r.entity) END,'stat',CASE WHEN _scope<>'crews' THEN public._best_habit_stat(r.entity,_season_id,uid) END) AS row
 FROM current_rows r LEFT JOIN yesterday y ON y.entity=r.entity LEFT JOIN public.profiles p ON p.id=r.entity LEFT JOIN public.crews c ON c.id=r.entity)
 SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(row ORDER BY rnk) FROM rendered WHERE rnk<=100),'[]'::jsonb),'me',(SELECT row FROM rendered WHERE mine LIMIT 1)) INTO res;
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.scoreboard(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scoreboard(uuid,text,text,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.solo_ghost(_season_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); d date; best record; cur bigint;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 d:=public._local_today(uid);
 SELECT g::date AS starts_on,coalesce(sum(ds.total),0)::bigint AS points INTO best FROM public.seasons s CROSS JOIN LATERAL generate_series(s.starts_on,d-7,interval '1 day') g LEFT JOIN public.daily_scores ds ON ds.user_id=uid AND ds.season_id=_season_id AND ds.day BETWEEN g::date AND g::date+6 WHERE s.id=_season_id GROUP BY g ORDER BY points DESC,g ASC LIMIT 1;
 SELECT coalesce(sum(total),0) INTO cur FROM public.daily_scores WHERE user_id=uid AND season_id=_season_id AND day BETWEEN d-6 AND d;
 RETURN jsonb_build_object('points',best.points,'starts_on',best.starts_on,'current',cur);
END $$;
REVOKE ALL ON FUNCTION public.solo_ghost(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.solo_ghost(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.profile_summary(_season_id uuid,_share boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); result jsonb; viewer uuid;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 PERFORM public._award_badges(uid,_season_id);
 viewer:=CASE WHEN _share THEN NULL ELSE uid END;
 SELECT jsonb_build_object('points',coalesce((SELECT sum(total) FROM public.daily_scores WHERE user_id=uid AND season_id=_season_id),0),'streak',coalesce((SELECT streak FROM public.daily_scores WHERE user_id=uid AND season_id=_season_id AND day<=public._local_today(uid) ORDER BY day DESC LIMIT 1),0),'rank',(SELECT r.rnk FROM public._rank_rows(_season_id,'country','season',p.country_code,public._local_today(uid),uid) r WHERE r.entity=uid),'stat',public._best_habit_stat(uid,_season_id,viewer),'badges',coalesce((SELECT jsonb_agg(key) FROM public.badges WHERE user_id=uid AND season_id=_season_id AND (NOT _share OR p.faith_public OR key<>'salat5')),'[]'::jsonb),'crew',(SELECT jsonb_build_object('id',c.id,'name',c.name) FROM public.crew_members m JOIN public.crews c ON c.id=m.crew_id WHERE m.user_id=uid AND c.season_id=_season_id LIMIT 1),'mode',(SELECT mode FROM public.season_entries WHERE user_id=uid AND season_id=_season_id)) INTO result FROM public.profiles p WHERE p.id=uid;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.profile_summary(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.profile_summary(uuid,boolean) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.crew_details(_crew_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); data jsonb; cr record; country text; rnk bigint; pts bigint;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.crew_members WHERE crew_id=_crew_id AND user_id=uid) THEN RAISE EXCEPTION 'not_member'; END IF;
 data:=public.crew_today(_crew_id);
 SELECT * INTO cr FROM public.crews WHERE id=_crew_id;
 SELECT country_code INTO country FROM public.profiles WHERE id=cr.owner_id;
 WITH ranked AS (SELECT c.id,row_number() OVER(ORDER BY coalesce((SELECT sum(ds.total) FROM public.crew_members m JOIN public.daily_scores ds ON ds.user_id=m.user_id AND ds.season_id=c.season_id WHERE m.crew_id=c.id),0) DESC,c.created_at,c.id) AS rank FROM public.crews c JOIN public.profiles p ON p.id=c.owner_id WHERE c.season_id=cr.season_id AND p.country_code=country) SELECT rank INTO rnk FROM ranked WHERE id=_crew_id;
 SELECT coalesce(sum(ds.total),0) INTO pts FROM public.crew_members m JOIN public.daily_scores ds ON ds.user_id=m.user_id AND ds.season_id=cr.season_id WHERE m.crew_id=_crew_id;
 RETURN data || jsonb_build_object('country_code',country,'country_rank',rnk,'season_points',pts);
END $$;
REVOKE ALL ON FUNCTION public.crew_details(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crew_details(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.leave_crew(_crew_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); cr record; successor uuid; member record;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT * INTO cr FROM public.crews WHERE id=_crew_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.crew_members WHERE crew_id=_crew_id AND user_id=uid) THEN RAISE EXCEPTION 'not_member'; END IF;
 DELETE FROM public.crew_members WHERE crew_id=_crew_id AND user_id=uid;
 IF cr.owner_id=uid THEN SELECT user_id INTO successor FROM public.crew_members WHERE crew_id=_crew_id ORDER BY joined_at LIMIT 1; IF successor IS NOT NULL THEN UPDATE public.crews SET owner_id=successor WHERE id=_crew_id; UPDATE public.crew_members SET role='owner' WHERE crew_id=_crew_id AND user_id=successor; END IF; END IF;
 UPDATE public.season_entries SET mode='solo' WHERE user_id=uid AND season_id=cr.season_id;
 PERFORM public.recompute_day(uid,cr.season_id,public._local_today(uid));
 FOR member IN SELECT user_id FROM public.crew_members WHERE crew_id=_crew_id LOOP PERFORM public.recompute_day(member.user_id,cr.season_id,public._local_today(member.user_id)); END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.leave_crew(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.leave_crew(uuid) TO authenticated,service_role;