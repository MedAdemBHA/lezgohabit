-- UX-08: matched crews get a friendly name ("Winter Arc Crew 3") instead of a code fragment ("Crew B50").

CREATE OR REPLACE FUNCTION public._crew_auto_name(_season_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT left(coalesce(
      (SELECT nullif(btrim(ch.name),'') FROM public.challenges ch WHERE ch.season_id=_season_id ORDER BY ch.created_at LIMIT 1),
      nullif(btrim(s.name->>'en'),''),
      'Lezgo'),40)
    ||' Crew '||(SELECT count(*)+1 FROM public.crews cr WHERE cr.season_id=_season_id AND cr.is_public AND cr.max_members=6)
  FROM public.seasons s WHERE s.id=_season_id
$$;
REVOKE ALL ON FUNCTION public._crew_auto_name(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.find_challenge_crew() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sid uuid; c public.crews; cid uuid; v_code text; created boolean:=false; n integer;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT season_id INTO sid FROM public.season_entries WHERE user_id=uid AND status='active' LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(sid::text||uid::text,73));
  IF NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=sid AND status='active' AND kind<>'personal')
  THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text||sid::text));
  SELECT cr.* INTO c FROM public.crews cr JOIN public.crew_members mine ON mine.crew_id=cr.id AND mine.user_id=uid WHERE cr.season_id=sid LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('crew_id',c.id,'code',c.code,'name',c.name,'members',(SELECT count(*) FROM public.crew_members WHERE crew_id=c.id),'created',false); END IF;
  SELECT cr.* INTO c FROM public.crews cr WHERE cr.season_id=sid AND cr.is_public AND NOT cr.archived AND cr.max_members=6
    AND NOT public._community_restricted('crew',cr.id,uid,'ban')
    AND (SELECT count(*) FROM public.crew_members m WHERE m.crew_id=cr.id)<6
    ORDER BY (SELECT count(*) FROM public.crew_members m WHERE m.crew_id=cr.id),cr.created_at
    LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF FOUND THEN
    INSERT INTO public.crew_members(crew_id,user_id,role) VALUES(c.id,uid,'member');
    cid:=c.id; v_code:=c.code;
  ELSE
    LOOP v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)); EXIT WHEN NOT EXISTS(SELECT 1 FROM public.crews cr WHERE cr.code=v_code) AND NOT EXISTS(SELECT 1 FROM public.challenges ch WHERE ch.code=v_code); END LOOP;
    INSERT INTO public.crews(season_id,name,code,owner_id,kind,max_members,is_public,is_demo)
      VALUES(sid,public._crew_auto_name(sid),v_code,uid,'squad',6,true,(SELECT is_demo FROM public.profiles WHERE id=uid)) RETURNING id INTO cid;
    INSERT INTO public.crew_members(crew_id,user_id,role) VALUES(cid,uid,'owner');
    created:=true;
  END IF;
  UPDATE public.season_entries e SET mode='crew' WHERE e.season_id=sid AND e.user_id=uid AND e.status='active';
  SELECT count(*) INTO n FROM public.crew_members WHERE crew_id=cid;
  RETURN jsonb_build_object('crew_id',cid,'code',v_code,'name',(SELECT name FROM public.crews WHERE id=cid),'members',n,'created',created);
END $$;

-- Rename crews that still carry the old generated name, numbered in creation order per season.
WITH auto AS (
  SELECT cr.id, cr.season_id,
    row_number() OVER (PARTITION BY cr.season_id ORDER BY cr.created_at, cr.id) AS n
  FROM public.crews cr
  WHERE cr.is_public AND cr.max_members=6 AND cr.name = 'Crew '||substr(cr.code,1,3)
)
UPDATE public.crews cr
SET name = left(coalesce(
    (SELECT nullif(btrim(ch.name),'') FROM public.challenges ch WHERE ch.season_id=cr.season_id ORDER BY ch.created_at LIMIT 1),
    nullif(btrim(s.name->>'en'),''),
    'Lezgo'),40)||' Crew '||auto.n
FROM auto JOIN public.seasons s ON s.id=auto.season_id
WHERE cr.id=auto.id;
