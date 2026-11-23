CREATE OR REPLACE FUNCTION public.boss_action(_boss_id uuid, _action text, _amount numeric DEFAULT 5, _level text DEFAULT 'pro'::text, _part text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid:=auth.uid(); b public.bosses; e public.boss_entries; tz text; today_real date; day_sum numeric; recent integer; last_id uuid; last_at timestamptz; cur_i integer; new_i integer; awarded boolean;
BEGIN
 PERFORM public._require_feature('bosses');
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT * INTO b FROM public.bosses WHERE id=_boss_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=b.season_id) OR public._account_now(uid) NOT BETWEEN b.starts_at AND b.ends_at THEN RAISE EXCEPTION 'boss_closed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(uid::text||_boss_id::text));
 INSERT INTO public.boss_entries(boss_id,user_id) VALUES(_boss_id,uid) ON CONFLICT DO NOTHING;
 SELECT * INTO e FROM public.boss_entries WHERE boss_id=_boss_id AND user_id=uid;
 awarded:=EXISTS(SELECT 1 FROM public.bonus_points WHERE boss_id=_boss_id AND user_id=uid);
 tz:=coalesce(public._effective_tz(uid),'Africa/Tunis');
 today_real:=(now() AT TIME ZONE tz)::date;
 IF _action='hit' THEN
  IF _amount IS NULL OR _amount<=0 OR b.metric IN ('days','posts') OR (b.metric IN ('reps','custom') AND _amount<>floor(_amount)) OR (b.metric='custom' AND (_part IS NULL OR _part NOT IN ('pullups','burpees'))) THEN RAISE EXCEPTION 'invalid_hit'; END IF;
  IF (b.metric='km' AND _amount>30) OR (b.metric<>'km' AND _amount>100) THEN RAISE EXCEPTION 'hit_too_large'; END IF;
  SELECT count(*) INTO recent FROM public.boss_hits WHERE boss_id=_boss_id AND user_id=uid AND created_at>now()-interval '1 minute';
  IF recent>=20 THEN RAISE EXCEPTION 'too_many_hits'; END IF;
  IF b.metric<>'km' THEN
   SELECT coalesce(sum(amount),0) INTO day_sum FROM public.boss_hits WHERE boss_id=_boss_id AND user_id=uid AND (created_at AT TIME ZONE tz)::date=today_real;
   IF day_sum+_amount>1000 THEN RAISE EXCEPTION 'daily_limit'; END IF;
  END IF;
  INSERT INTO public.boss_hits(boss_id,user_id,amount,part) VALUES(_boss_id,uid,_amount,_part);
 ELSIF _action='undo' THEN
  SELECT id,created_at INTO last_id,last_at FROM public.boss_hits WHERE boss_id=_boss_id AND user_id=uid ORDER BY created_at DESC,id DESC LIMIT 1;
  IF last_id IS NULL OR last_at<now()-interval '5 minutes' THEN RAISE EXCEPTION 'undo_expired'; END IF;
  DELETE FROM public.boss_hits WHERE id=last_id;
 ELSIF _action='reset' THEN
  IF e.completed_at IS NOT NULL OR awarded THEN RAISE EXCEPTION 'boss_locked'; END IF;
  DELETE FROM public.boss_hits WHERE boss_id=_boss_id AND user_id=uid AND (created_at AT TIME ZONE tz)::date=today_real;
 ELSIF _action='level' THEN
  SELECT min(i) INTO new_i FROM generate_series(0,jsonb_array_length(b.levels)-1) i WHERE b.levels->i->>'key'=_level;
  IF new_i IS NULL THEN RAISE EXCEPTION 'invalid_level'; END IF;
  SELECT min(i) INTO cur_i FROM generate_series(0,jsonb_array_length(b.levels)-1) i WHERE b.levels->i->>'key'=e.level;
  IF (awarded OR e.completed_at IS NOT NULL OR e.progress>0 OR EXISTS(SELECT 1 FROM public.boss_hits WHERE boss_id=_boss_id AND user_id=uid)) AND new_i<=coalesce(cur_i,-1) THEN RAISE EXCEPTION 'level_locked'; END IF;
  UPDATE public.boss_entries SET level=_level,completed_at=NULL WHERE boss_id=_boss_id AND user_id=uid;
 ELSE RAISE EXCEPTION 'invalid_action'; END IF;
 PERFORM public._sync_boss(uid,_boss_id);
END $function$;
REVOKE ALL ON FUNCTION public.boss_action(uuid,text,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boss_action(uuid,text,numeric,text,text) TO authenticated;