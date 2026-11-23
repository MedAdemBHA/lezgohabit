CREATE TABLE public.posts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, season_id uuid NOT NULL REFERENCES public.seasons(id), crew_id uuid REFERENCES public.crews(id), type text NOT NULL CHECK(type IN ('proof','thought','win')), habit_key text, body text NOT NULL DEFAULT '' CHECK(char_length(body)<=280), image_url text, stats jsonb NOT NULL DEFAULT '{}', visibility text NOT NULL DEFAULT 'everyone' CHECK(visibility IN ('everyone','crew')), day date NOT NULL, hidden boolean NOT NULL DEFAULT false, is_demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT(id,user_id,season_id,crew_id,type,body,image_url,visibility,day,hidden,is_demo,created_at) ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.can_read_post(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.posts p WHERE p.id=_id AND (p.user_id=auth.uid() OR (NOT p.hidden AND (p.visibility='everyone' OR EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=p.crew_id AND m.user_id=auth.uid()))))) $$;
REVOKE ALL ON FUNCTION public.can_read_post(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_post(uuid) TO authenticated,service_role;
CREATE POLICY "visible posts and own pending posts" ON public.posts FOR SELECT TO authenticated USING(public.can_read_post(id));
CREATE INDEX posts_season_created ON public.posts(season_id,created_at DESC);
CREATE INDEX posts_crew ON public.posts(crew_id);
CREATE TABLE public.post_reactions (post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,user_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('respect','beast','lol','legend')),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(post_id,user_id));
GRANT SELECT ON public.post_reactions TO authenticated;
GRANT ALL ON public.post_reactions TO service_role;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visible post reactions" ON public.post_reactions FOR SELECT TO authenticated USING(public.can_read_post(post_id));
CREATE TABLE public.reports (post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,reporter uuid NOT NULL,reason text NOT NULL CHECK(char_length(reason) BETWEEN 1 AND 280),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(post_id,reporter));
GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own confidential reports" ON public.reports FOR SELECT TO authenticated USING(reporter=auth.uid());
CREATE TABLE public.post_hides (post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,user_id uuid NOT NULL,PRIMARY KEY(post_id,user_id));
GRANT SELECT ON public.post_hides TO authenticated;
GRANT ALL ON public.post_hides TO service_role;
ALTER TABLE public.post_hides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feed hides" ON public.post_hides FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.user_preferences (user_id uuid PRIMARY KEY, distance_unit text NOT NULL DEFAULT 'km' CHECK(distance_unit IN ('km','mi')), prayer_enabled boolean NOT NULL DEFAULT true, prayer_method integer NOT NULL DEFAULT 18 CHECK(prayer_method IN (2,3,4,5,18)), equipment text[] NOT NULL DEFAULT ARRAY['bodyweight']::text[] CHECK(equipment <@ ARRAY['dumbbells','pullup','barbell','bodyweight']::text[]), max_dumbbell numeric NOT NULL DEFAULT 10 CHECK(max_dumbbell BETWEEN 0 AND 500), prayer_reminder boolean NOT NULL DEFAULT false, daily_time time NOT NULL DEFAULT '21:00', boss_alerts boolean NOT NULL DEFAULT true);
GRANT SELECT,INSERT,UPDATE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preferences read" ON public.user_preferences FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "own preferences insert" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY "own preferences update" ON public.user_preferences FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE FUNCTION public.create_post(_season_id uuid,_type text,_habit_key text DEFAULT NULL,_body text DEFAULT '',_image_url text DEFAULT NULL,_stats jsonb DEFAULT '{}',_visibility text DEFAULT 'everyone') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); cid uuid; d date; pid uuid; h public.habit_templates; BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _type NOT IN ('proof','thought','win') OR _visibility NOT IN ('everyone','crew') OR char_length(_body)>280 OR (length(trim(_body))=0 AND _image_url IS NULL) THEN RAISE EXCEPTION 'invalid_post'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=_season_id) THEN RAISE EXCEPTION 'not_in_season'; END IF;
 SELECT m.crew_id INTO cid FROM public.crew_members m JOIN public.crews c ON c.id=m.crew_id WHERE m.user_id=uid AND c.season_id=_season_id LIMIT 1;
 IF _visibility='crew' AND cid IS NULL THEN RAISE EXCEPTION 'no_crew'; END IF;
 IF _habit_key IS NOT NULL THEN SELECT t.* INTO h FROM public.habit_templates t JOIN public.user_habits uh ON uh.template_id=t.id WHERE uh.user_id=uid AND uh.season_id=_season_id AND uh.active AND t.key=_habit_key; IF h.id IS NULL THEN RAISE EXCEPTION 'invalid_habit'; END IF; END IF;
 IF _image_url IS NOT NULL AND (split_part(_image_url,'/',1)<>uid::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='proofs' AND name=_image_url)) THEN RAISE EXCEPTION 'proof_not_found'; END IF;
 IF jsonb_typeof(_stats)<>'object' OR octet_length(_stats::text)>1024 THEN RAISE EXCEPTION 'invalid_stats'; END IF;
 -- Stats are supplied from the author's saved check-in, not trusted client claims.
 _stats:='{}'::jsonb;
 d:=public._local_today(uid);
 IF _type='proof' THEN PERFORM public._check_day_window(uid,d); IF NOT EXISTS(SELECT 1 FROM public.seasons WHERE id=_season_id AND d BETWEEN starts_on AND ends_on) THEN RAISE EXCEPTION 'day_closed'; END IF; END IF;
 IF h.id IS NOT NULL THEN
  SELECT jsonb_build_object('value',c.value,'unit',coalesce(uh.unit,h.unit),'target',uh.target) INTO _stats FROM public.checkins c JOIN public.user_habits uh ON uh.id=c.user_habit_id WHERE uh.user_id=uid AND uh.season_id=_season_id AND uh.template_id=h.id AND c.day=d LIMIT 1;
  IF h.kind='salat' THEN SELECT jsonb_build_object('salat',count(*)) INTO _stats FROM public.checkins c JOIN public.user_habits uh ON uh.id=c.user_habit_id CROSS JOIN LATERAL jsonb_each_text(coalesce(c.detail->'prayers','{}')) pr WHERE uh.user_id=uid AND uh.season_id=_season_id AND uh.template_id=h.id AND c.day=d AND pr.value='on_time'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||d::text,7));
 INSERT INTO public.posts(user_id,season_id,crew_id,type,habit_key,body,image_url,stats,visibility,day) VALUES(uid,_season_id,cid,_type,_habit_key,trim(_body),_image_url,coalesce(_stats,'{}'),_visibility,d) RETURNING id INTO pid;
 IF _type='proof' THEN INSERT INTO public.day_extras(user_id,day,proof_posted) VALUES(uid,d,true) ON CONFLICT(user_id,day) DO UPDATE SET proof_posted=true; PERFORM public._recompute_with_crew(uid,_season_id,d); END IF;
 RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.create_post(uuid,text,text,text,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_post(uuid,text,text,text,text,jsonb,text) TO authenticated,service_role;
CREATE FUNCTION public.react_post(_post_id uuid,_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT public.can_read_post(_post_id) OR EXISTS(SELECT 1 FROM public.posts WHERE id=_post_id AND hidden) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF _kind NOT IN ('respect','beast','lol','legend') THEN RAISE EXCEPTION 'invalid_reaction'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||_post_id::text,8));
 IF EXISTS(SELECT 1 FROM public.post_reactions WHERE post_id=_post_id AND user_id=auth.uid() AND kind=_kind) THEN DELETE FROM public.post_reactions WHERE post_id=_post_id AND user_id=auth.uid(); ELSE INSERT INTO public.post_reactions(post_id,user_id,kind) VALUES(_post_id,auth.uid(),_kind) ON CONFLICT(post_id,user_id) DO UPDATE SET kind=excluded.kind; END IF;
END $$;
REVOKE ALL ON FUNCTION public.react_post(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.react_post(uuid,text) TO authenticated,service_role;
CREATE FUNCTION public.post_action(_post_id uuid,_action text,_reason text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.posts; BEGIN
 IF auth.uid() IS NULL OR NOT public.can_read_post(_post_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO p FROM public.posts WHERE id=_post_id FOR UPDATE;
 IF _action='delete' AND p.user_id=auth.uid() THEN DELETE FROM public.posts WHERE id=_post_id AND user_id=auth.uid();
 ELSIF _action='hide' THEN INSERT INTO public.post_hides VALUES(_post_id,auth.uid()) ON CONFLICT DO NOTHING;
 ELSIF _action='report' AND p.user_id<>auth.uid() THEN
 IF char_length(trim(_reason)) NOT BETWEEN 1 AND 280 THEN RAISE EXCEPTION 'invalid_reason'; END IF;
 INSERT INTO public.reports(post_id,reporter,reason) VALUES(_post_id,auth.uid(),trim(_reason)) ON CONFLICT DO NOTHING;
 IF (SELECT count(*) FROM public.reports WHERE post_id=_post_id)>=3 THEN UPDATE public.posts SET hidden=true WHERE id=_post_id; END IF;
 ELSE RAISE EXCEPTION 'forbidden'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.post_action(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.post_action(uuid,text,text) TO authenticated,service_role;
CREATE FUNCTION public.proof_feed(_season_id uuid,_scope text DEFAULT 'everyone',_filter text DEFAULT 'all',_before timestamptz DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE uid uuid:=auth.uid(); result jsonb; BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _scope NOT IN ('everyone','crew','country') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
 SELECT coalesce(jsonb_agg(row ORDER BY created_at DESC),'[]'::jsonb) INTO result FROM (
 SELECT p.created_at,jsonb_build_object('id',p.id,'user_id',p.user_id,'type',p.type,'body',p.body,'image_path',p.image_url,'day',p.day,'created_at',p.created_at,'hidden',p.hidden,'visibility',p.visibility,'display_name',pr.display_name,'handle',pr.handle,'avatar_url',pr.avatar_url,'habit_key',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN p.habit_key END,'habit_name',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN h.name END,'category',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN h.category END,'stats',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN p.stats ELSE '{}'::jsonb END,'reactions',(SELECT count(*) FROM public.post_reactions r WHERE r.post_id=p.id),'my_reaction',(SELECT kind FROM public.post_reactions r WHERE r.post_id=p.id AND r.user_id=uid)) row
 FROM public.posts p JOIN public.profiles pr ON pr.id=p.user_id LEFT JOIN public.habit_templates h ON h.key=p.habit_key
 WHERE p.season_id=_season_id AND public.can_read_post(p.id) AND NOT EXISTS(SELECT 1 FROM public.post_hides x WHERE x.post_id=p.id AND x.user_id=uid) AND (_before IS NULL OR p.created_at<_before)
 AND (_scope<>'country' OR pr.country_code=(SELECT country_code FROM public.profiles WHERE id=uid)) AND (_scope<>'crew' OR EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=p.crew_id AND m.user_id=uid))
 AND (_filter='all' OR (_filter='thought' AND p.type='thought') OR (p.habit_key=_filter AND (NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid))) ORDER BY p.created_at DESC LIMIT 20
 ) q; RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.proof_feed(uuid,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proof_feed(uuid,text,text,timestamptz) TO authenticated,service_role;
CREATE POLICY "proof photo owners upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='proofs' AND (storage.foldername(name))[1]=auth.uid()::text AND lower(storage.extension(name))='jpg');
CREATE POLICY "proof photo audience read" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='proofs' AND ((storage.foldername(name))[1]=auth.uid()::text OR EXISTS(SELECT 1 FROM public.posts p WHERE p.image_url=name AND public.can_read_post(p.id) AND NOT p.hidden)));
CREATE POLICY "proof photo owners remove" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='proofs' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE FUNCTION public.scoring_preview(_picked integer,_done integer,_streak integer,_proof boolean,_chaos boolean,_crew boolean,_lift integer) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$ DECLARE habits numeric; stacks numeric; mult numeric; BEGIN
 IF _picked NOT BETWEEN 1 AND 8 OR _done NOT BETWEEN 0 AND _picked OR _streak NOT BETWEEN 0 AND 40 OR _lift NOT BETWEEN 0 AND 3 THEN RAISE EXCEPTION 'invalid_input'; END IF;
 habits:=100::numeric*_done/_picked; stacks:=(CASE WHEN _done=_picked THEN 20 ELSE 0 END)+(CASE WHEN _proof THEN 10 ELSE 0 END)+(CASE WHEN _chaos THEN 10 ELSE 0 END)+(CASE WHEN _crew THEN 10 ELSE 0 END)+5*_lift; mult:=least(1+0.05*_streak,1.5);
 RETURN jsonb_build_object('habits',round(habits,2),'stacks',stacks,'multiplier',mult,'total',floor((habits+stacks)*mult),'max',247);
END $$;
REVOKE ALL ON FUNCTION public.scoring_preview(integer,integer,integer,boolean,boolean,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scoring_preview(integer,integer,integer,boolean,boolean,boolean,integer) TO authenticated,service_role;