CREATE TABLE public.buddy_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),from_user uuid NOT NULL,to_user uuid NOT NULL,status text NOT NULL DEFAULT 'pending',created_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT buddy_distinct CHECK(from_user<>to_user),CONSTRAINT buddy_status CHECK(status IN ('pending','accepted')),UNIQUE(from_user,to_user));
GRANT SELECT ON public.buddy_links TO authenticated;
GRANT ALL ON public.buddy_links TO service_role;
ALTER TABLE public.buddy_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read buddies" ON public.buddy_links FOR SELECT TO authenticated USING(auth.uid() IN (from_user,to_user));
CREATE OR REPLACE FUNCTION public.buddy_action(_action text,_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); link record;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF uid=_target THEN RAISE EXCEPTION 'invalid_target'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(least(uid::text,_target::text),0));
 PERFORM pg_advisory_xact_lock(hashtextextended(greatest(uid::text,_target::text),0));
 IF _action='invite' THEN
 IF EXISTS(SELECT 1 FROM public.buddy_links WHERE status='accepted' AND (uid IN (from_user,to_user) OR _target IN (from_user,to_user))) THEN RAISE EXCEPTION 'buddy_limit'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.season_entries e ON e.user_id=p.id WHERE p.id=_target AND p.show_on_public_board AND e.season_id IN(SELECT season_id FROM public.season_entries WHERE user_id=uid)) THEN RAISE EXCEPTION 'invalid_target'; END IF;
 IF (SELECT count(*) FROM public.buddy_links WHERE from_user=uid AND status='pending')>=10 THEN RAISE EXCEPTION 'too_many_requests'; END IF;
 IF EXISTS(SELECT 1 FROM public.buddy_links WHERE from_user=_target AND to_user=uid) THEN RAISE EXCEPTION 'incoming_request'; END IF;
 INSERT INTO public.buddy_links(from_user,to_user) VALUES(uid,_target) ON CONFLICT DO NOTHING;
 ELSIF _action='accept' THEN
 SELECT * INTO link FROM public.buddy_links WHERE from_user=_target AND to_user=uid AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_invited'; END IF;
 IF EXISTS(SELECT 1 FROM public.buddy_links WHERE status='accepted' AND (uid IN (from_user,to_user) OR _target IN (from_user,to_user))) THEN RAISE EXCEPTION 'buddy_limit'; END IF;
 UPDATE public.buddy_links SET status='accepted' WHERE id=link.id;
 ELSIF _action='decline' THEN DELETE FROM public.buddy_links WHERE from_user=_target AND to_user=uid AND status='pending';
 ELSIF _action='remove' THEN DELETE FROM public.buddy_links WHERE status='accepted' AND ((from_user=uid AND to_user=_target) OR (from_user=_target AND to_user=uid));
 ELSE RAISE EXCEPTION 'invalid_action'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.buddy_action(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buddy_action(text,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.buddy_directory(_season_id uuid,_search text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); res jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 WITH people AS (
 SELECT p.id AS user_id,p.display_name,p.handle,p.avatar_url,p.country_code,coalesce((SELECT streak FROM public.daily_scores ds WHERE ds.user_id=p.id AND ds.season_id=_season_id AND day<=public._local_today(p.id) ORDER BY day DESC LIMIT 1),0) AS streak,l.status,l.from_user,l.to_user
 FROM public.profiles p LEFT JOIN public.buddy_links l ON (l.from_user=uid AND l.to_user=p.id) OR (l.to_user=uid AND l.from_user=p.id)
 WHERE p.id<>uid AND (l.id IS NOT NULL OR (length(trim(_search))>=2 AND p.show_on_public_board AND p.handle ILIKE '%'||replace(replace(trim(_search),'%',''),'_','')||'%' AND EXISTS(SELECT 1 FROM public.season_entries e WHERE e.user_id=p.id AND e.season_id=_season_id))) LIMIT 30)
 SELECT jsonb_build_object('buddy',(SELECT to_jsonb(x) FROM people x WHERE status='accepted' LIMIT 1),'incoming',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM people x WHERE status='pending' AND to_user=uid),'[]'::jsonb),'results',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM people x WHERE status IS NULL OR (status='pending' AND from_user=uid)),'[]'::jsonb)) INTO res;
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.buddy_directory(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buddy_directory(uuid,text) TO authenticated,service_role;