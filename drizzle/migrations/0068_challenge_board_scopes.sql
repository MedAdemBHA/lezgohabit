-- Board navigation uses a participant's own crew and exposes consistency on each row.
-- CREATE OR REPLACE preserves the existing authenticated SECURITY DEFINER contract.
CREATE OR REPLACE FUNCTION public.challenge_scoreboard(_season_id uuid,_scope text DEFAULT 'challenge',_country text DEFAULT 'TN') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); s public.seasons; own_kind text; my_crew uuid; res jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO s FROM public.seasons WHERE id=_season_id;
  SELECT kind INTO own_kind FROM public.season_entries WHERE user_id=uid AND season_id=_season_id;
  IF NOT FOUND OR own_kind='personal' THEN RAISE EXCEPTION 'private_challenge'; END IF;
  SELECT cm.crew_id INTO my_crew FROM public.crew_members cm
    JOIN public.crews cr ON cr.id=cm.crew_id
    WHERE cm.user_id=uid AND cr.season_id=_season_id AND NOT cr.archived LIMIT 1;
  IF _scope NOT IN ('challenge','crew','country','world','crews') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  IF _scope IN ('country','world') AND own_kind<>'official' THEN RAISE EXCEPTION 'official_only'; END IF;
  WITH rows AS (
    SELECT e.user_id,p.display_name,p.handle,p.avatar_url,p.country_code,e.kind,e.joined_at,
      coalesce((SELECT sum(ds.total) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_season_id AND ds.day<=least(s.ends_on,public._local_today(e.user_id))),0)::bigint points,
      coalesce((SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_season_id AND ds.day BETWEEN greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND least(s.ends_on,public._local_today(e.user_id)) AND ds.completion>=0.6),0)::int completed_days,
      coalesce((SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_season_id AND ds.day BETWEEN greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND least(s.ends_on,public._local_today(e.user_id)) AND ds.completion=1),0)::int perfect_days,
      coalesce((SELECT ds.streak FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_season_id AND ds.day<=least(s.ends_on,public._local_today(e.user_id)) ORDER BY ds.day DESC LIMIT 1),0)::int streak,
      greatest(1,least(s.ends_on,public._local_today(e.user_id))-greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date)+1)::int elapsed_days,
      (SELECT cm.crew_id FROM public.crew_members cm JOIN public.crews cr ON cr.id=cm.crew_id WHERE cm.user_id=e.user_id AND cr.season_id=_season_id AND NOT cr.archived LIMIT 1) crew_id
    FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id
    WHERE e.season_id=_season_id AND e.kind IN ('official','creator') AND e.status IN ('active','completed')
      AND p.is_demo=(SELECT is_demo FROM public.profiles WHERE id=uid) AND p.account_status='active'
      AND (_scope NOT IN ('country','world') OR e.kind='official') AND (_scope<>'country' OR p.country_code=_country)
  ), ranked AS (
    SELECT rows.*,row_number() OVER(ORDER BY points DESC,completed_days::numeric/greatest(elapsed_days,1) DESC,joined_at,user_id) rnk
    FROM rows WHERE _scope<>'crews' AND (_scope<>'crew' OR crew_id=my_crew)
  ), rendered AS (
    SELECT jsonb_build_object('rank',rnk,'user_id',user_id,'crew_id',NULL,'display_name',display_name,'handle',handle,'avatar_url',avatar_url,'country_code',country_code,'points',points,'streak',streak,'is_me',user_id=uid,'previous_rank',NULL,'members',NULL,'stat',NULL,
      'completed_days',completed_days,'perfect_days',perfect_days,'elapsed_days',elapsed_days,'consistency',round(100.0*completed_days/greatest(elapsed_days,1),1)) row,rnk
    FROM ranked
  )
  SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(row ORDER BY rnk) FROM rendered WHERE rnk<=100),'[]'::jsonb),'me',(SELECT row FROM rendered WHERE row->>'is_me'='true' LIMIT 1)) INTO res;
  IF _scope='crews' THEN
    WITH crew_rows AS (
      SELECT c.id,c.name,c.created_at,count(m.user_id) members,coalesce(sum((SELECT coalesce(sum(ds.total),0) FROM public.daily_scores ds WHERE ds.user_id=m.user_id AND ds.season_id=_season_id)),0)::bigint points
      FROM public.crews c JOIN public.crew_members m ON m.crew_id=c.id JOIN public.season_entries e ON e.user_id=m.user_id AND e.season_id=_season_id AND e.status IN ('active','completed')
      WHERE c.season_id=_season_id AND NOT c.archived GROUP BY c.id,c.name,c.created_at
    ), ranked_crews AS (SELECT *,row_number() OVER(ORDER BY points DESC,created_at,id) rnk FROM crew_rows), rendered_crews AS (
      SELECT jsonb_build_object('rank',rnk,'user_id',NULL,'crew_id',id,'display_name',name,'handle',NULL,'avatar_url',NULL,'country_code',NULL,'points',points,'streak',0,'is_me',exists(SELECT 1 FROM public.crew_members WHERE crew_id=id AND user_id=uid),'members',members,'previous_rank',NULL,'stat',NULL,'completed_days',0,'perfect_days',0,'elapsed_days',0,'consistency',0) row,rnk FROM ranked_crews
    ) SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(row ORDER BY rnk) FROM rendered_crews WHERE rnk<=100),'[]'::jsonb),'me',(SELECT row FROM rendered_crews WHERE row->>'is_me'='true' LIMIT 1)) INTO res;
  END IF;
  RETURN coalesce(res,jsonb_build_object('rows','[]'::jsonb,'me',NULL));
END $$;

REVOKE ALL ON FUNCTION public.challenge_scoreboard(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.challenge_scoreboard(uuid,text,text) TO authenticated;
