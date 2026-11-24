-- _freeze_season declared a record variable `r` and also aliased the ranked CTE as `r`,
-- so Postgres rejected `r.user_id` as ambiguous and no challenge could be frozen.
DO $fix$
DECLARE d text; fixed text;
BEGIN
  d := pg_get_functiondef('public._freeze_season(uuid)'::regprocedure);
  fixed := replace(replace(replace(d,
    'DECLARE s public.seasons; r record;','DECLARE s public.seasons; rec record;'),
    'FOR r IN SELECT e.user_id','FOR rec IN SELECT e.user_id'),
    'PERFORM public._finalize_user_day(r.user_id,_sid,s.ends_on);','PERFORM public._finalize_user_day(rec.user_id,_sid,s.ends_on);');
  IF fixed = d OR position('rec record' in fixed) = 0 OR position('rec.user_id' in fixed) = 0 THEN
    RAISE EXCEPTION 'freeze_season patch did not apply';
  END IF;
  EXECUTE fixed;
END $fix$;
REVOKE ALL ON FUNCTION public._freeze_season(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._freeze_season(uuid) TO service_role;
