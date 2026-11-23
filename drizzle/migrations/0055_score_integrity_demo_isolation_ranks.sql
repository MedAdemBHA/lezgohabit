CREATE OR REPLACE FUNCTION public._rank_rows(_sid uuid,_scope text,_period text,_country text,_day date,_viewer uuid)
 RETURNS TABLE(entity uuid,rnk bigint,points bigint,streak integer,joined timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
WITH v AS (SELECT coalesce((SELECT is_demo FROM public.profiles WHERE id=_viewer),false) demo, public._local_today(_viewer)-_day off),
s AS (SELECT starts_on FROM public.seasons WHERE id=_sid),
access AS (SELECT NOT EXISTS(SELECT 1 FROM public.challenges c WHERE c.season_id=_sid AND NOT c.public_board) OR EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=_viewer AND season_id=_sid) allowed),
players AS (
 SELECT e.user_id,e.joined_at,coalesce(p.timezone,'Africa/Tunis') timezone,p.country_code,p.show_on_public_board,public._local_today(e.user_id)-v.off pd
 FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id CROSS JOIN v CROSS JOIN access a
 WHERE a.allowed AND e.season_id=_sid AND p.is_demo=v.demo AND p.account_status='active'),
scored AS (
 SELECT pl.*,
  (coalesce((SELECT sum(ds.total) FROM public.daily_scores ds CROSS JOIN s WHERE ds.user_id=pl.user_id AND ds.season_id=_sid AND ds.day<=pl.pd
     AND ds.day>=CASE _period WHEN 'today' THEN pl.pd WHEN 'week' THEN date_trunc('week',pl.pd)::date ELSE s.starts_on END),0)
   +CASE WHEN _period='season' THEN coalesce((SELECT sum(bp.points) FROM public.bonus_points bp WHERE bp.user_id=pl.user_id AND bp.season_id=_sid AND (bp.awarded_at AT TIME ZONE pl.timezone)::date<=pl.pd),0) ELSE 0 END)::bigint points,
  coalesce((SELECT d.streak FROM public.daily_scores d WHERE d.user_id=pl.user_id AND d.season_id=_sid AND d.day<=pl.pd ORDER BY d.day DESC LIMIT 1),0) streak
 FROM players pl WHERE pl.joined_at<(pl.pd+1)::timestamp AT TIME ZONE pl.timezone),
base AS (
 SELECT user_id entity,points,streak,joined_at joined FROM scored
 WHERE _scope<>'crews' AND (_scope<>'country' OR country_code=_country)
  AND (show_on_public_board OR user_id=_viewer OR EXISTS(SELECT 1 FROM public.challenges ch JOIN public.season_entries ce ON ce.season_id=ch.season_id WHERE ch.season_id=_sid AND NOT ch.public_board AND ce.user_id=_viewer))
 UNION ALL
 SELECT c.id,coalesce((SELECT sum(sc.points) FROM scored sc JOIN public.crew_members m ON m.user_id=sc.user_id AND m.crew_id=c.id),0)::bigint,0,c.created_at
 FROM public.crews c CROSS JOIN v CROSS JOIN access a
 WHERE a.allowed AND _scope='crews' AND c.season_id=_sid AND c.is_demo=v.demo AND c.created_at<(_day+1)::timestamp AT TIME ZONE 'Africa/Tunis'
  AND (c.is_public OR EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=c.id AND m.user_id=_viewer)))
SELECT entity,row_number() OVER(ORDER BY points DESC,streak DESC,joined ASC,entity),points,streak,joined FROM base $fn$;

CREATE OR REPLACE FUNCTION public.can_read_post(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.posts p JOIN public.profiles a ON a.id=p.user_id WHERE p.id=_id AND (p.user_id=auth.uid() OR (
  (a.is_demo=public._viewer_demo() OR public._caller_is_admin()) AND a.account_status='active' AND NOT p.hidden
  AND (NOT EXISTS(SELECT 1 FROM public.challenges ch WHERE ch.season_id=p.season_id AND NOT ch.public_board) OR EXISTS(SELECT 1 FROM public.season_entries e WHERE e.season_id=p.season_id AND e.user_id=auth.uid()))
  AND (p.visibility='everyone' OR EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=p.crew_id AND m.user_id=auth.uid()))))) $fn$;

CREATE OR REPLACE FUNCTION public.participating_countries() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
 SELECT count(DISTINCT p.country_code)::integer FROM public.profiles p JOIN public.season_entries e ON e.user_id=p.id WHERE p.show_on_public_board AND NOT p.is_demo AND p.account_status='active' $fn$;

CREATE OR REPLACE FUNCTION public.proof_feed(_season_id uuid, _scope text DEFAULT 'everyone'::text, _filter text DEFAULT 'all'::text, _before timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE uid uuid:=auth.uid(); result jsonb; BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _scope NOT IN ('everyone','crew','country') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
 SELECT coalesce(jsonb_agg(row ORDER BY created_at DESC),'[]'::jsonb) INTO result FROM (
 SELECT p.created_at,jsonb_build_object('id',p.id,'user_id',p.user_id,'type',p.type,'body',p.body,'image_path',p.image_url,'day',p.day,'created_at',p.created_at,'hidden',p.hidden,'visibility',p.visibility,'display_name',pr.display_name,'handle',pr.handle,'avatar_url',pr.avatar_url,'habit_key',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN p.habit_key END,'habit_name',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN h.name END,'category',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN h.category END,'stats',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN p.stats ELSE '{}'::jsonb END,'reactions',(SELECT count(*) FROM public.post_reactions r WHERE r.post_id=p.id),'my_reaction',(SELECT kind FROM public.post_reactions r WHERE r.post_id=p.id AND r.user_id=uid)) row
 FROM public.posts p JOIN public.profiles pr ON pr.id=p.user_id LEFT JOIN public.habit_templates h ON h.key=p.habit_key
 WHERE p.season_id=_season_id AND public.can_read_post(p.id) AND pr.is_demo=public._viewer_demo() AND NOT EXISTS(SELECT 1 FROM public.post_hides x WHERE x.post_id=p.id AND x.user_id=uid) AND (_before IS NULL OR p.created_at<_before)
 AND (_scope<>'country' OR pr.country_code=(SELECT country_code FROM public.profiles WHERE id=uid)) AND (_scope<>'crew' OR EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=p.crew_id AND m.user_id=uid))
 AND (_filter='all' OR (_filter='thought' AND p.type='thought') OR (p.habit_key=_filter AND (NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid))) ORDER BY p.created_at DESC LIMIT 20
 ) q; RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.buddy_matches(_season_id uuid, _language boolean DEFAULT false, _timezone boolean DEFAULT false, _goals boolean DEFAULT false, _gender boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid:=auth.uid(); me record;p record;rel record;shared jsonb;card jsonb;incoming jsonb:='[]';results jsonb:='[]';buddy jsonb:=NULL;score integer;offset_h numeric;own_days integer;active_days integer;
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;SELECT * INTO me FROM profiles WHERE id=uid;
SELECT count(*) INTO own_days FROM daily_scores WHERE user_id=uid AND season_id=_season_id AND completion>=0.6;
FOR p IN SELECT * FROM profiles WHERE id<>uid AND is_demo=me.is_demo AND account_status='active' AND EXISTS(SELECT 1 FROM season_entries WHERE user_id=profiles.id AND season_id=_season_id) ORDER BY id LOOP
IF EXISTS(SELECT 1 FROM buddy_requests WHERE status='blocked' AND uid IN(from_user,to_user) AND p.id IN(from_user,to_user)) THEN CONTINUE;END IF;
SELECT * INTO rel FROM buddy_requests WHERE uid IN(from_user,to_user) AND p.id IN(from_user,to_user) AND status IN('pending','accepted') ORDER BY status LIMIT 1;
IF rel.id IS NULL AND (NOT p.show_on_public_board OR p.birth_date IS NULL OR p.birth_date>current_date-interval '18 years' OR me.birth_date IS NULL OR me.birth_date>current_date-interval '18 years' OR EXISTS(SELECT 1 FROM buddy_requests WHERE status='accepted' AND p.id IN(from_user,to_user))) THEN CONTINUE;END IF;
SELECT coalesce(jsonb_agg(jsonb_build_object('key',ht.key,'name',ht.name,'color',ht.color,'icon',ht.icon)),'[]') INTO shared FROM user_habits h JOIN habit_templates ht ON ht.id=h.template_id WHERE h.user_id=p.id AND h.season_id=_season_id AND h.active AND (NOT ht.is_faith OR p.faith_public) AND EXISTS(SELECT 1 FROM user_habits mine WHERE mine.user_id=uid AND mine.season_id=_season_id AND mine.template_id=h.template_id AND mine.active);
offset_h:=extract(epoch FROM((now() AT TIME ZONE p.timezone)-(now() AT TIME ZONE me.timezone)))/3600;
SELECT count(*) INTO active_days FROM daily_scores WHERE user_id=p.id AND season_id=_season_id AND completion>=0.6;
score:=25+CASE WHEN p.language=me.language THEN 20 ELSE 0 END+CASE WHEN abs(offset_h)<=2 THEN 20 ELSE 0 END+least(25,jsonb_array_length(shared)*10)+CASE WHEN abs(active_days-own_days)<=7 THEN 10 ELSE 0 END;
card:=jsonb_build_object('user_id',p.id,'display_name',p.display_name,'handle',p.handle,'avatar_url',p.avatar_url,'country_code',p.country_code,'city',p.city,'utc_offset',extract(epoch FROM((now() AT TIME ZONE p.timezone)-(now() AT TIME ZONE 'UTC')))/3600,'streak',coalesce((SELECT streak FROM daily_scores WHERE user_id=p.id AND season_id=_season_id ORDER BY day DESC LIMIT 1),0),'active_days',active_days,'shared',shared,'match',score,'status',rel.status,'crew_id',rel.crew_id);
IF rel.status='accepted' THEN buddy:=card;ELSIF rel.status='pending' AND rel.to_user=uid THEN incoming:=incoming||jsonb_build_array(card);
ELSIF rel.id IS NULL AND (NOT _language OR p.language=me.language) AND (NOT _timezone OR abs(offset_h)<=2) AND (NOT _goals OR jsonb_array_length(shared)>0) AND (NOT _gender OR p.gender IS NOT NULL AND me.gender IS NOT NULL AND p.gender=me.gender) THEN results:=results||jsonb_build_array(card);END IF;
END LOOP;
SELECT coalesce(jsonb_agg(value),'[]') INTO results FROM(SELECT value FROM jsonb_array_elements(results) ORDER BY (value->>'match')::integer DESC LIMIT 30)x;
RETURN jsonb_build_object('eligible',coalesce(me.birth_date<=current_date-interval '18 years',false),'buddy',buddy,'incoming',incoming,'results',results);
END $function$;

CREATE OR REPLACE FUNCTION public.boss_overview(_season_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE uid uuid:=auth.uid(); b public.bosses; r jsonb; cc text; BEGIN IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.season_entries WHERE season_id=_season_id AND user_id=uid) THEN RAISE EXCEPTION 'forbidden'; END IF; SELECT country_code INTO cc FROM public.profiles WHERE id=uid; SELECT * INTO b FROM public.bosses WHERE season_id=_season_id AND public._account_now(auth.uid()) BETWEEN starts_at AND ends_at ORDER BY week_no LIMIT 1; IF b.id IS NOT NULL THEN PERFORM public._sync_boss(uid,b.id); END IF; SELECT jsonb_build_object('boss',CASE WHEN b.id IS NOT NULL THEN to_jsonb(b) END,'entry',(SELECT to_jsonb(e) FROM public.boss_entries e WHERE boss_id=b.id AND user_id=uid),'awarded',coalesce((SELECT jsonb_agg(level) FROM public.bonus_points WHERE boss_id=b.id AND user_id=uid),'[]'::jsonb),'bonus',coalesce((SELECT sum(points) FROM public.bonus_points WHERE user_id=uid AND season_id=_season_id),0),'next',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.starts_at) FROM public.bosses n WHERE n.season_id=_season_id AND n.starts_at>public._account_now(auth.uid())),'[]'::jsonb),'country',cc,'community',coalesce((SELECT sum(e.progress) FROM public.boss_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.boss_id=b.id AND p.country_code=cc AND p.show_on_public_board AND p.is_demo=public._viewer_demo() AND p.account_status='active'),0),'community_target',50000,'leaders',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT p.display_name,p.handle,e.progress FROM public.boss_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.boss_id=b.id AND p.country_code=cc AND p.show_on_public_board AND p.is_demo=public._viewer_demo() AND p.account_status='active' ORDER BY e.progress DESC,p.handle LIMIT 5) x),'[]'::jsonb)) INTO r; RETURN r; END $function$;

REVOKE ALL ON FUNCTION public._rank_rows(uuid,text,text,text,date,uuid) FROM PUBLIC, anon, authenticated;