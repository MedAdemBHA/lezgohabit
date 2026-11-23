CREATE OR REPLACE FUNCTION public._proof_is_duplicate(_uid uuid,_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
 SELECT f.fingerprint IS NULL OR EXISTS(SELECT 1 FROM public.proof_fingerprints o WHERE o.fingerprint=f.fingerprint AND o.path<>_path AND o.created_at<=f.created_at)
 FROM (SELECT 1) one LEFT JOIN public.proof_fingerprints f ON f.path=_path AND f.user_id=_uid $fn$;

CREATE OR REPLACE FUNCTION public.register_saved_proof(_path text,_fingerprint text,_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF split_part(_path,'/',1)<>_user::text OR char_length(coalesce(_fingerprint,''))<>64 OR _fingerprint ~ '[^0-9a-f]' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id IN ('proofs','habit-proofs') AND name=_path) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM proof_fingerprints WHERE fingerprint=_fingerprint AND path<>_path) THEN INSERT INTO admin_suspicious_activity(user_id,kind,detail,is_demo) SELECT _user,'duplicate_proof',jsonb_build_object('path',_path),is_demo FROM profiles WHERE id=_user; END IF;
 INSERT INTO proof_fingerprints(path,user_id,fingerprint,is_demo) SELECT _path,_user,_fingerprint,is_demo FROM profiles WHERE id=_user ON CONFLICT(path) DO NOTHING;
END $fn$;

CREATE OR REPLACE FUNCTION public.post_daily_proof(_season_id uuid, _path text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); d date; r jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.season_entries WHERE user_id = uid AND season_id = _season_id) THEN RAISE EXCEPTION 'not_in_season'; END IF;
 d := public._local_today(uid); PERFORM public._check_day_window(uid, d);
 IF split_part(_path,'/',1) <> uid::text OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'habit-proofs' AND name = _path) THEN RAISE EXCEPTION 'proof_not_found'; END IF;
 IF public._proof_is_duplicate(uid,_path) THEN RAISE EXCEPTION 'duplicate_proof'; END IF;
 INSERT INTO public.day_extras(user_id, day, proof_posted, proof_path, proof_post_id) VALUES(uid,d,true,_path,NULL) ON CONFLICT(user_id,day) DO UPDATE SET proof_posted = true, proof_path = excluded.proof_path, proof_post_id = NULL;
 PERFORM public._recompute_with_crew(uid,_season_id,d);
 SELECT to_jsonb(ds) INTO r FROM public.daily_scores ds WHERE user_id = uid AND season_id = _season_id AND day = d;
 RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.create_post(_season_id uuid, _type text, _habit_key text DEFAULT NULL::text, _body text DEFAULT ''::text, _image_url text DEFAULT NULL::text, _stats jsonb DEFAULT '{}'::jsonb, _visibility text DEFAULT 'everyone'::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid:=auth.uid(); cid uuid; d date; pid uuid; h public.habit_templates; BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _type NOT IN ('proof','thought','win') OR _visibility NOT IN ('everyone','crew') OR char_length(_body)>280 OR (length(trim(_body))=0 AND _image_url IS NULL) THEN RAISE EXCEPTION 'invalid_post'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=_season_id) THEN RAISE EXCEPTION 'not_in_season'; END IF;
 SELECT m.crew_id INTO cid FROM public.crew_members m JOIN public.crews c ON c.id=m.crew_id WHERE m.user_id=uid AND c.season_id=_season_id LIMIT 1;
 IF _visibility='crew' AND cid IS NULL THEN RAISE EXCEPTION 'no_crew'; END IF;
 IF _habit_key IS NOT NULL THEN SELECT t.* INTO h FROM public.habit_templates t JOIN public.user_habits uh ON uh.template_id=t.id WHERE uh.user_id=uid AND uh.season_id=_season_id AND uh.active AND t.key=_habit_key; IF h.id IS NULL THEN RAISE EXCEPTION 'invalid_habit'; END IF; END IF;
 IF _image_url IS NOT NULL AND (split_part(_image_url,'/',1)<>uid::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='proofs' AND name=_image_url)) THEN RAISE EXCEPTION 'proof_not_found'; END IF;
 IF jsonb_typeof(_stats)<>'object' OR octet_length(_stats::text)>1024 THEN RAISE EXCEPTION 'invalid_stats'; END IF;
 _stats:='{}'::jsonb;
 d:=public._local_today(uid);
 IF _type='proof' THEN PERFORM public._check_day_window(uid,d); IF NOT EXISTS(SELECT 1 FROM public.seasons WHERE id=_season_id AND d BETWEEN starts_on AND ends_on) THEN RAISE EXCEPTION 'day_closed'; END IF; END IF;
 IF h.id IS NOT NULL THEN
  SELECT jsonb_build_object('value',c.value,'unit',coalesce(uh.unit,h.unit),'target',uh.target) INTO _stats FROM public.checkins c JOIN public.user_habits uh ON uh.id=c.user_habit_id WHERE uh.user_id=uid AND uh.season_id=_season_id AND uh.template_id=h.id AND c.day=d LIMIT 1;
  IF h.kind='salat' THEN SELECT jsonb_build_object('salat',count(*)) INTO _stats FROM public.checkins c JOIN public.user_habits uh ON uh.id=c.user_habit_id CROSS JOIN LATERAL jsonb_each_text(coalesce(c.detail->'prayers','{}')) pr WHERE uh.user_id=uid AND uh.season_id=_season_id AND uh.template_id=h.id AND c.day=d AND pr.value='on_time'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||d::text,7));
 INSERT INTO public.posts(user_id,season_id,crew_id,type,habit_key,body,image_url,stats,visibility,day) VALUES(uid,_season_id,cid,_type,_habit_key,trim(_body),_image_url,coalesce(_stats,'{}'),_visibility,d) RETURNING id INTO pid;
 IF _type='proof' AND _image_url IS NOT NULL AND NOT public._proof_is_duplicate(uid,_image_url) AND NOT EXISTS(SELECT 1 FROM public.day_extras WHERE user_id=uid AND day=d AND proof_posted) THEN INSERT INTO public.day_extras(user_id,day,proof_posted,proof_post_id) VALUES(uid,d,true,pid) ON CONFLICT(user_id,day) DO UPDATE SET proof_posted=true,proof_post_id=pid; PERFORM public._recompute_with_crew(uid,_season_id,d); END IF;
 RETURN pid;
END $function$;

CREATE OR REPLACE FUNCTION public.revoke_removed_proof() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND NOT (NEW.hidden AND NOT OLD.hidden) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.day_extras WHERE user_id=OLD.user_id AND day=OLD.day AND proof_post_id=OLD.id) AND NOT public._day_is_final(OLD.user_id,OLD.day) THEN
  UPDATE public.day_extras SET proof_posted=false,proof_post_id=NULL WHERE user_id=OLD.user_id AND day=OLD.day;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id=OLD.user_id) THEN PERFORM public._recompute_with_crew(OLD.user_id,OLD.season_id,OLD.day); END IF;
 END IF;
 RETURN coalesce(NEW,OLD);
END $fn$;
DROP TRIGGER IF EXISTS posts_revoke_proof ON public.posts;
CREATE TRIGGER posts_revoke_proof AFTER DELETE OR UPDATE OF hidden ON public.posts FOR EACH ROW EXECUTE FUNCTION public.revoke_removed_proof();

CREATE OR REPLACE FUNCTION public.admin_remove_fake_proof(_post uuid,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE p public.posts; was_final boolean;
BEGIN
 PERFORM public._require_admin();
 IF char_length(trim(coalesce(_reason,'')))<5 THEN RAISE EXCEPTION 'reason_required'; END IF;
 SELECT * INTO p FROM public.posts WHERE id=_post; IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 was_final:=public._day_is_final(p.user_id,p.day);
 PERFORM set_config('lezgo.final_override','on',true);
 UPDATE public.day_extras SET proof_posted=false,proof_post_id=NULL WHERE user_id=p.user_id AND day=p.day AND proof_post_id=p.id;
 UPDATE public.posts SET hidden=true WHERE id=_post;
 IF was_final THEN
  UPDATE public.daily_scores SET finalized_at=NULL WHERE user_id=p.user_id AND season_id=p.season_id AND day=p.day;
  PERFORM public.recompute_day(p.user_id,p.season_id,p.day);
  UPDATE public.daily_scores SET finalized_at=now() WHERE user_id=p.user_id AND season_id=p.season_id AND day=p.day;
 ELSE PERFORM public._recompute_with_crew(p.user_id,p.season_id,p.day); END IF;
 PERFORM set_config('lezgo.final_override','off',true);
 PERFORM public._admin_audit('remove_fake_proof',p.user_id::text,jsonb_build_object('post',_post,'day',p.day,'reason',trim(_reason)));
END $fn$;

REVOKE ALL ON FUNCTION public._proof_is_duplicate(uuid,text), public.revoke_removed_proof(), public.register_saved_proof(text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_saved_proof(text,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.admin_remove_fake_proof(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_fake_proof(uuid,text) TO authenticated;