CREATE OR REPLACE FUNCTION public.public_challenge_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(card ORDER BY order_group,starts_on,created_at),'[]'::jsonb)
  FROM (
    SELECT
      CASE WHEN s.challenge_owned THEN 2 ELSE CASE WHEN s.status='live' THEN 0 ELSE 1 END END order_group,
      s.starts_on,
      coalesce(c.created_at,s.starts_on::timestamp AT TIME ZONE 'UTC') created_at,
      jsonb_build_object(
        'id',s.id,
        'season_id',s.id,
        'challenge_id',c.id,
        'kind',CASE WHEN s.challenge_owned THEN 'creator' ELSE 'official' END,
        'name',CASE WHEN s.challenge_owned THEN jsonb_build_object('en',c.name,'fr',c.name,'ar',c.name,'aeb',c.name) ELSE s.name END,
        'creator',CASE WHEN s.challenge_owned THEN p.handle ELSE 'Lezgo' END,
        'code',c.code,
        'days',s.ends_on-s.starts_on+1,
        'starts_on',s.starts_on,
        'ends_on',s.ends_on,
        'status',s.status,
        'members',(SELECT count(*) FROM public.season_entries e WHERE e.season_id=s.id AND e.status IN ('active','completed')),
        'habits',coalesce((SELECT jsonb_agg(jsonb_build_object('key',h.habit_key,'name',h.name,'what_counts',h.what_counts,'kind',h.kind,'target',h.target,'unit',h.unit,'is_faith',h.is_faith) ORDER BY h.position) FROM public.challenge_habits h WHERE h.season_id=s.id),'[]'::jsonb)
      ) card
    FROM public.seasons s
    LEFT JOIN public.challenges c ON c.season_id=s.id
    LEFT JOIN public.profiles p ON p.id=c.owner_id
    WHERE s.is_demo=false AND NOT s.archived AND s.ends_on>=current_date AND s.status IN ('live','upcoming')
      AND (
        (NOT s.challenge_owned AND (c.id IS NULL OR c.audience<>'creator'))
        OR (s.challenge_owned AND c.id IS NOT NULL AND c.audience='creator' AND c.public_board AND c.approved AND c.featured AND NOT c.archived AND NOT c.is_demo)
      )
  ) catalog;
$$;
REVOKE ALL ON FUNCTION public.public_challenge_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_challenge_catalog() TO anon,authenticated,service_role;
