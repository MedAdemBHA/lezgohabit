REVOKE ALL ON public.posts,public.post_reactions,public.reports,public.post_hides,public.user_preferences FROM anon,authenticated;
GRANT SELECT(id,user_id,season_id,crew_id,type,body,image_url,visibility,day,hidden,is_demo,created_at) ON public.posts TO authenticated;
GRANT SELECT ON public.post_reactions,public.reports,public.post_hides TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.user_preferences TO authenticated;
GRANT ALL ON public.posts,public.post_reactions,public.reports,public.post_hides,public.user_preferences TO service_role;