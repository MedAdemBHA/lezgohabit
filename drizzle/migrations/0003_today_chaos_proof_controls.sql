ALTER TABLE public.day_extras ADD COLUMN chaos_spins integer NOT NULL DEFAULT 0, ADD COLUMN chaos_index integer, ADD COLUMN proof_path text;
ALTER TABLE public.habit_templates ADD COLUMN color text;
UPDATE public.habit_templates SET color = CASE WHEN key IN ('sleep','sleep7') THEN 'purple' WHEN key = 'run' THEN 'orange' WHEN key IN ('coffee','no_sugar','no_fast_food') THEN 'pink' WHEN key = 'water' OR category = 'mind' THEN 'blue' WHEN category = 'faith' THEN 'teal' ELSE 'lime' END;
CREATE POLICY "own proof uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'habit-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own proof reads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'habit-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own proof cleanup" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'habit-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE FUNCTION public.spin_daily_chaos(_season_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d date; ex public.day_extras; next_index integer;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.season_entries WHERE user_id = uid AND season_id = _season_id) THEN RAISE EXCEPTION 'not_in_season'; END IF;
 d := public._local_today(uid); PERFORM public._check_day_window(uid, d);
 INSERT INTO public.day_extras(user_id, day) VALUES(uid, d) ON CONFLICT (user_id,day) DO NOTHING;
 SELECT * INTO ex FROM public.day_extras WHERE user_id = uid AND day = d FOR UPDATE;
 IF ex.chaos_spins >= 3 THEN RAISE EXCEPTION 'spin_limit'; END IF;
 next_index := (coalesce(ex.chaos_index, ((d - DATE '2026-11-22') % 7 + 7) % 7) + 1 + floor(random()*6)::integer) % 7;
 UPDATE public.day_extras SET chaos_spins = ex.chaos_spins + 1, chaos_index = next_index, chaos_done = false WHERE user_id = uid AND day = d RETURNING * INTO ex;
 PERFORM public._recompute_with_crew(uid, _season_id, d);
 RETURN jsonb_build_object('extras',to_jsonb(ex),'score',(SELECT to_jsonb(s) FROM public.daily_scores s WHERE user_id = uid AND season_id = _season_id AND day = d));
END $$;
REVOKE ALL ON FUNCTION public.spin_daily_chaos(uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.spin_daily_chaos(uuid) TO authenticated;
CREATE FUNCTION public.post_daily_proof(_season_id uuid, _path text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d date; r jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.season_entries WHERE user_id = uid AND season_id = _season_id) THEN RAISE EXCEPTION 'not_in_season'; END IF;
 d := public._local_today(uid); PERFORM public._check_day_window(uid, d);
 IF split_part(_path,'/',1) <> uid::text OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'habit-proofs' AND name = _path) THEN RAISE EXCEPTION 'proof_not_found'; END IF;
 INSERT INTO public.day_extras(user_id, day, proof_posted, proof_path) VALUES(uid,d,true,_path) ON CONFLICT(user_id,day) DO UPDATE SET proof_posted = true, proof_path = excluded.proof_path;
 PERFORM public._recompute_with_crew(uid,_season_id,d);
 SELECT to_jsonb(ds) INTO r FROM public.daily_scores ds WHERE user_id = uid AND season_id = _season_id AND day = d;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.post_daily_proof(uuid,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.post_daily_proof(uuid,text) TO authenticated;
CREATE FUNCTION public.today_habit_points(_season_id uuid, _day date) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'share', round(x.share,2), 'earned', round(x.share * public._habit_completion(x.kind,x.target,c.value,c.detail),2))), '[]'::jsonb) FROM (
 SELECT h.id,h.kind,h.target, (100::numeric / count(*) OVER ()) * CASE WHEN coalesce(ds.comeback,false) THEN 2 ELSE 1 END AS share
 FROM public.user_habits h LEFT JOIN public.daily_scores ds ON ds.user_id = h.user_id AND ds.season_id = h.season_id AND ds.day = _day
 WHERE h.user_id = auth.uid() AND h.season_id = _season_id AND h.active
 ) x LEFT JOIN public.checkins c ON c.user_habit_id = x.id AND c.day = _day;
$$;
REVOKE ALL ON FUNCTION public.today_habit_points(uuid,date) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.today_habit_points(uuid,date) TO authenticated;