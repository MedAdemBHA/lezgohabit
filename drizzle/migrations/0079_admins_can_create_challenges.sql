-- UX-14: active, non-demo admins (profiles.is_admin, same rule as _require_admin) can create
-- creator challenges and see their dashboard without applying for the creator role.
CREATE OR REPLACE FUNCTION public._can_create_challenges(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid,'creator')
    OR EXISTS(SELECT 1 FROM public.profiles WHERE id=_uid AND is_admin AND NOT is_demo AND account_status='active')
  )
$$;
REVOKE ALL ON FUNCTION public._can_create_challenges(uuid) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE f text; patched text; fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.create_creator_challenge(text,integer,date,jsonb,text)',
    'public.creator_dashboard()'
  ] LOOP
    SELECT pg_get_functiondef(fn::regprocedure) INTO f;
    patched := replace(f, 'NOT public.has_role(uid,''creator'')', 'NOT public._can_create_challenges(uid)');
    IF patched = f THEN RAISE EXCEPTION 'creator check not found in %', fn; END IF;
    EXECUTE patched;
  END LOOP;
END $$;
