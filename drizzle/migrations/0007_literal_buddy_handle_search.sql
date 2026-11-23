CREATE OR REPLACE FUNCTION public.buddy_directory(_season_id uuid,_search text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); res jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 WITH people AS (
 SELECT p.id AS user_id,p.display_name,p.handle,p.avatar_url,p.country_code,coalesce((SELECT streak FROM public.daily_scores ds WHERE ds.user_id=p.id AND ds.season_id=_season_id AND day<=public._local_today(p.id) ORDER BY day DESC LIMIT 1),0) AS streak,l.status,l.from_user,l.to_user
 FROM public.profiles p LEFT JOIN public.buddy_links l ON (l.from_user=uid AND l.to_user=p.id) OR (l.to_user=uid AND l.from_user=p.id)
 WHERE p.id<>uid AND (l.id IS NOT NULL OR (length(trim(_search))>=2 AND p.show_on_public_board AND position(lower(trim(_search)) in lower(p.handle))>0 AND EXISTS(SELECT 1 FROM public.season_entries e WHERE e.user_id=p.id AND e.season_id=_season_id))) LIMIT 30)
 SELECT jsonb_build_object('buddy',(SELECT to_jsonb(x) FROM people x WHERE status='accepted' LIMIT 1),'incoming',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM people x WHERE status='pending' AND to_user=uid),'[]'::jsonb),'results',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM people x WHERE status IS NULL OR (status='pending' AND from_user=uid)),'[]'::jsonb)) INTO res;
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.buddy_directory(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buddy_directory(uuid,text) TO authenticated,service_role;