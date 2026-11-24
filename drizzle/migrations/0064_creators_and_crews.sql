CREATE TABLE IF NOT EXISTS public.creator_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  note text NOT NULL DEFAULT '' CHECK(char_length(note)<=280),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  review_note text NOT NULL DEFAULT '' CHECK(char_length(review_note)<=280),
  is_demo boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS creator_requests_one_pending
  ON public.creator_requests(user_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS creator_requests_admin_list ON public.creator_requests(status,created_at DESC);
ALTER TABLE public.creator_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creator_requests FROM anon,authenticated;
GRANT SELECT ON public.creator_requests TO authenticated;
GRANT ALL ON public.creator_requests TO service_role;
DROP POLICY IF EXISTS creator_requests_owner_read ON public.creator_requests;
CREATE POLICY creator_requests_owner_read ON public.creator_requests FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.request_creator() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); rid uuid;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF public.has_role(uid,'creator') THEN RAISE EXCEPTION 'already_creator'; END IF;
  SELECT id INTO rid FROM public.creator_requests WHERE user_id=uid AND status='pending' ORDER BY created_at DESC LIMIT 1;
  IF rid IS NOT NULL THEN RETURN rid; END IF;
  INSERT INTO public.creator_requests(user_id,note,is_demo) SELECT uid,'',is_demo FROM public.profiles WHERE id=uid RETURNING id INTO rid;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.creator_requests_admin() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'handle',p.handle,'display_name',p.display_name,'status',r.status,'note',r.note,'created_at',r.created_at) ORDER BY r.created_at DESC)
    FROM public.creator_requests r JOIN public.profiles p ON p.id=r.user_id WHERE r.status='pending' AND NOT r.is_demo),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.review_creator_request(_request_id uuid,_approve boolean,_note text DEFAULT '') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE admin uuid; req public.creator_requests;
BEGIN
  PERFORM public._guest_guard();
  admin:=public._require_admin();
  IF char_length(coalesce(_note,''))>280 THEN RAISE EXCEPTION 'note_too_long'; END IF;
  SELECT * INTO req FROM public.creator_requests WHERE id=_request_id AND status='pending' AND NOT is_demo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  UPDATE public.creator_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,reviewed_at=now(),reviewed_by=admin,review_note=coalesce(_note,'') WHERE id=_request_id;
  IF _approve THEN INSERT INTO public.user_roles(user_id,role) VALUES(req.user_id,'creator') ON CONFLICT(user_id,role) DO NOTHING; END IF;
  PERFORM public._admin_audit(CASE WHEN _approve THEN 'approve_creator_request' ELSE 'reject_creator_request' END,_request_id::text,jsonb_build_object('user_id',req.user_id,'note',coalesce(_note,'')));
END $$;

CREATE OR REPLACE FUNCTION public.create_creator_challenge(_name text,_days integer,_starts_on date,_habits jsonb,_cover_color text DEFAULT 'blue') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); today date; sid uuid; cid uuid; vcode text; item jsonb; tpl public.habit_templates; pos integer:=0; keys text[];
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(uid,'creator') THEN RAISE EXCEPTION 'creator_required'; END IF;
  today:=public._local_today(uid);
  IF char_length(trim(coalesce(_name,''))) NOT BETWEEN 1 AND 60 OR _days NOT BETWEEN 7 AND 90 OR _starts_on<today
     OR jsonb_typeof(_habits)<>'array' OR jsonb_array_length(_habits) NOT BETWEEN 1 AND 6
     OR _cover_color NOT IN ('blue','pink','purple','orange','lime','teal','yellow') THEN RAISE EXCEPTION 'invalid_challenge'; END IF;
  IF (SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(_habits))<>jsonb_array_length(_habits) THEN RAISE EXCEPTION 'duplicate_habit'; END IF;
  IF (SELECT count(*) FROM public.challenges WHERE owner_id=uid AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'challenge_limit'; END IF;
  SELECT array_agg(value->>'key' ORDER BY ord) INTO keys FROM jsonb_array_elements(_habits) WITH ORDINALITY x(value,ord);
  LOOP
    vcode:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.challenges WHERE code=vcode) AND NOT EXISTS(SELECT 1 FROM public.crews WHERE code=vcode);
  END LOOP;
  INSERT INTO public.seasons(slug,name,starts_on,ends_on,status,theme_color,challenge_owned,is_demo)
  VALUES('creator-'||lower(vcode),jsonb_build_object('en',trim(_name),'fr',trim(_name),'ar',trim(_name),'aeb',trim(_name)),_starts_on,_starts_on+_days-1,
    CASE WHEN _starts_on=today THEN 'live' ELSE 'upcoming' END,_cover_color,true,(SELECT is_demo FROM public.profiles WHERE id=uid)) RETURNING id INTO sid;
  INSERT INTO public.challenges(owner_id,season_id,name,template,days,audience,same_habits,habit_keys,faith_allowed,weekly_bosses,public_board,starts_on,code,approved,featured,archived,is_demo)
  VALUES(uid,sid,trim(_name),'custom',_days,'creator',true,keys,EXISTS(SELECT 1 FROM jsonb_array_elements(_habits) v JOIN public.habit_templates h ON h.key=v.value->>'key' WHERE h.is_faith),false,true,_starts_on,vcode,true,false,false,(SELECT is_demo FROM public.profiles WHERE id=uid)) RETURNING id INTO cid;
  FOR item IN SELECT value FROM jsonb_array_elements(_habits) LOOP
    SELECT * INTO tpl FROM public.habit_templates WHERE key=item->>'key' AND NOT archived;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_habit'; END IF;
    IF tpl.is_faith AND NOT (SELECT faith_allowed FROM public.challenges WHERE id=cid) THEN RAISE EXCEPTION 'faith_not_allowed'; END IF;
    IF coalesce((item->>'target')::numeric,tpl.default_target)<=0 OR coalesce((item->>'target')::numeric,tpl.default_target)>1000000 THEN RAISE EXCEPTION 'invalid_target'; END IF;
    INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,rule,is_faith,position,is_demo)
    VALUES(sid,tpl.id,tpl.key,tpl.name,coalesce(nullif(tpl.what_counts,'{}'::jsonb),tpl.description),tpl.kind,coalesce((item->>'target')::numeric,tpl.default_target),tpl.unit,coalesce(item->'rule','{}'::jsonb),tpl.is_faith,pos,(SELECT is_demo FROM public.profiles WHERE id=uid));
    pos:=pos+1;
  END LOOP;
  RETURN jsonb_build_object('id',cid,'season_id',sid,'code',vcode,'days',_days,'starts_on',_starts_on,'ends_on',_starts_on+_days-1);
END $$;

CREATE OR REPLACE FUNCTION public.creator_dashboard() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); res jsonb;
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid,'creator') THEN RAISE EXCEPTION 'creator_required'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'season_id',c.season_id,'name',c.name,'code',c.code,'days',c.days,'starts_on',c.starts_on,'ends_on',s.ends_on,
    'participants',(SELECT count(*) FROM public.season_entries e WHERE e.season_id=c.season_id AND e.status IN ('active','completed')),
    'surrenders',(SELECT count(*) FROM public.season_entries e WHERE e.season_id=c.season_id AND e.status='surrendered'),
    'checked_in',(SELECT count(*) FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.season_id=c.season_id AND e.status='active' AND EXISTS(SELECT 1 FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=c.season_id AND ds.day=public._local_today(e.user_id) AND ds.completion>=0.6)),
    'checkin_percent',round(100.0*(SELECT count(*) FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.season_id=c.season_id AND e.status='active' AND EXISTS(SELECT 1 FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=c.season_id AND ds.day=public._local_today(e.user_id) AND ds.completion>=0.6))/greatest(1,(SELECT count(*) FROM public.season_entries e WHERE e.season_id=c.season_id AND e.status='active')),1),
    'url','https://joinlezgo.com/c/'||c.code) ORDER BY c.created_at DESC),'[]'::jsonb)
  INTO res FROM public.challenges c JOIN public.seasons s ON s.id=c.season_id WHERE c.owner_id=uid AND c.audience='creator' AND NOT c.archived;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.create_crew(_name text,_kind text,_max_members integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sid uuid; v_code text; cid uuid;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT season_id INTO sid FROM public.season_entries WHERE user_id=uid AND status='active' LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  IF char_length(trim(coalesce(_name,''))) NOT BETWEEN 1 AND 40 OR _max_members NOT BETWEEN 4 AND 8 OR _kind<>'squad' THEN RAISE EXCEPTION 'invalid_crew'; END IF;
  IF EXISTS(SELECT 1 FROM public.crew_members cm JOIN public.crews c ON c.id=cm.crew_id WHERE cm.user_id=uid AND c.season_id=sid) THEN RAISE EXCEPTION 'already_in_crew'; END IF;
  LOOP v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)); EXIT WHEN NOT EXISTS(SELECT 1 FROM public.crews c WHERE c.code=v_code) AND NOT EXISTS(SELECT 1 FROM public.challenges c WHERE c.code=v_code); END LOOP;
  INSERT INTO public.crews(season_id,name,code,owner_id,kind,max_members,is_public,is_demo)
  VALUES(sid,trim(_name),v_code,uid,'squad',_max_members,false,(SELECT is_demo FROM public.profiles WHERE id=uid)) RETURNING id INTO cid;
  INSERT INTO public.crew_members(crew_id,user_id,role) VALUES(cid,uid,'owner');
  RETURN cid::text;
END $$;

CREATE OR REPLACE FUNCTION public.join_crew(_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); cr public.crews; sid uuid; ch_code text;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT season_id INTO sid FROM public.season_entries WHERE user_id=uid AND status='active' LIMIT 1;
  IF sid IS NULL THEN
    IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND status='active') THEN RAISE EXCEPTION 'active_challenge_exists'; END IF;
    SELECT c.code INTO ch_code FROM public.challenges c JOIN public.crews x ON x.season_id=c.season_id WHERE x.code=upper(trim(_code)) AND c.public_board AND c.audience<>'solo' AND NOT c.archived LIMIT 1;
    IF ch_code IS NOT NULL THEN PERFORM public.join_challenge(ch_code); ELSE
      SELECT x.season_id INTO sid FROM public.crews x WHERE x.code=upper(trim(_code)) AND NOT x.archived;
      IF sid IS NULL THEN RAISE EXCEPTION 'crew_not_found'; END IF;
      PERFORM public.join_season(sid,'crew');
    END IF;
    SELECT season_id INTO sid FROM public.season_entries WHERE user_id=uid AND status='active' LIMIT 1;
  END IF;
  IF sid IS NULL THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  SELECT * INTO cr FROM public.crews WHERE code=upper(trim(_code)) AND season_id=sid AND NOT archived FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'crew_not_found'; END IF;
  IF EXISTS(SELECT 1 FROM public.crew_members WHERE crew_id=cr.id AND user_id=uid) THEN RETURN cr.id; END IF;
  IF EXISTS(SELECT 1 FROM public.crew_members m JOIN public.crews c ON c.id=m.crew_id WHERE m.user_id=uid AND c.season_id=sid) THEN RAISE EXCEPTION 'already_in_crew'; END IF;
  IF (SELECT count(*) FROM public.crew_members WHERE crew_id=cr.id)>=cr.max_members THEN RAISE EXCEPTION 'crew_full'; END IF;
  INSERT INTO public.crew_members(crew_id,user_id,role) VALUES(cr.id,uid,'member');
  RETURN cr.id;
END $$;

CREATE OR REPLACE FUNCTION public.find_challenge_crew() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sid uuid; c public.crews; cid uuid; v_code text; created boolean:=false; n integer;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT season_id INTO sid FROM public.season_entries WHERE user_id=uid AND status='active' LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text||sid::text));
  SELECT cr.* INTO c FROM public.crews cr JOIN public.crew_members mine ON mine.crew_id=cr.id AND mine.user_id=uid WHERE cr.season_id=sid LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('crew_id',c.id,'code',c.code,'name',c.name,'members',(SELECT count(*) FROM public.crew_members WHERE crew_id=c.id),'created',false); END IF;
  SELECT cr.* INTO c FROM public.crews cr WHERE cr.season_id=sid AND cr.is_public AND NOT cr.archived AND cr.max_members=6
    AND (SELECT count(*) FROM public.crew_members m WHERE m.crew_id=cr.id)<6
    ORDER BY (SELECT count(*) FROM public.crew_members m WHERE m.crew_id=cr.id),cr.created_at
    LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF FOUND THEN
    INSERT INTO public.crew_members(crew_id,user_id,role) VALUES(c.id,uid,'member');
    cid:=c.id; v_code:=c.code;
  ELSE
    LOOP v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)); EXIT WHEN NOT EXISTS(SELECT 1 FROM public.crews cr WHERE cr.code=v_code) AND NOT EXISTS(SELECT 1 FROM public.challenges ch WHERE ch.code=v_code); END LOOP;
    INSERT INTO public.crews(season_id,name,code,owner_id,kind,max_members,is_public,is_demo)
      VALUES(sid,'Crew '||substr(v_code,1,3),v_code,uid,'squad',6,true,(SELECT is_demo FROM public.profiles WHERE id=uid)) RETURNING id INTO cid;
    INSERT INTO public.crew_members(crew_id,user_id,role) VALUES(cid,uid,'owner');
    created:=true;
  END IF;
  SELECT count(*) INTO n FROM public.crew_members WHERE crew_id=cid;
  RETURN jsonb_build_object('crew_id',cid,'code',v_code,'name',(SELECT name FROM public.crews WHERE id=cid),'members',n,'created',created);
END $$;

REVOKE ALL ON FUNCTION public.request_creator(),public.review_creator_request(uuid,boolean,text),public.create_creator_challenge(text,integer,date,jsonb,text),public.create_crew(text,text,integer),public.join_crew(text),public.find_challenge_crew() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_creator(),public.review_creator_request(uuid,boolean,text),public.create_creator_challenge(text,integer,date,jsonb,text),public.create_crew(text,text,integer),public.join_crew(text),public.find_challenge_crew() TO authenticated;
REVOKE ALL ON FUNCTION public.creator_requests_admin(),public.creator_dashboard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.creator_requests_admin(),public.creator_dashboard() TO authenticated;
