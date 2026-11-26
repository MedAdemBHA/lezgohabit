-- UX-09: crew activity shows moments that matter, not every tap.
-- Rows: a habit reaching its target, a perfect day, a streak milestone, a member joining.
-- Faith habits stay private unless the owner opted in; respects still attach to check-ins only.
CREATE OR REPLACE FUNCTION public.crew_activity(_crew_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); sid uuid; res jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crew_members WHERE crew_id = _crew_id AND user_id = uid) THEN RAISE EXCEPTION 'not_member'; END IF;
  SELECT season_id INTO sid FROM public.crews WHERE id = _crew_id;
  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb) INTO res FROM (
    SELECT * FROM (
      -- A habit reaching its target.
      SELECT ci.id, 'habit'::text AS kind, coalesce(ci.done_at, ci.created_at) AS created_at, p.id AS user_id, p.display_name, p.avatar_url,
        CASE WHEN coalesce(ht.is_faith, false) AND NOT p.faith_public AND p.id <> uid THEN NULL
             WHEN uh.custom_name IS NOT NULL THEN jsonb_build_object('en', uh.custom_name) ELSE ht.name END AS habit,
        NULL::int AS streak,
        (SELECT count(*) FROM public.respects r WHERE r.checkin_id = ci.id) AS respects,
        EXISTS (SELECT 1 FROM public.respects r WHERE r.checkin_id = ci.id AND r.user_id = uid) AS respected
      FROM public.checkins ci
      JOIN public.crew_members m ON m.user_id = ci.user_id AND m.crew_id = _crew_id
      JOIN public.profiles p ON p.id = ci.user_id
      JOIN public.user_habits uh ON uh.id = ci.user_habit_id AND uh.season_id = sid
      LEFT JOIN public.habit_templates ht ON ht.id = uh.template_id
      WHERE ci.value > 0 AND ci.created_at > now() - interval '3 days'
        AND public._habit_completion(uh.kind, uh.target, ci.value, ci.detail) >= 1
      UNION ALL
      -- A perfect day, or a streak milestone, from saved scores.
      SELECT NULL::uuid, CASE WHEN ds.perfect THEN 'perfect' ELSE 'streak' END,
        coalesce((SELECT max(coalesce(ci.done_at, ci.created_at)) FROM public.checkins ci WHERE ci.user_id = ds.user_id AND ci.day = ds.day), ds.day::timestamptz),
        p.id, p.display_name, p.avatar_url, NULL::jsonb,
        CASE WHEN ds.perfect THEN NULL ELSE ds.streak END, 0, false
      FROM public.daily_scores ds
      JOIN public.crew_members m ON m.user_id = ds.user_id AND m.crew_id = _crew_id
      JOIN public.profiles p ON p.id = ds.user_id
      WHERE ds.season_id = sid AND ds.day > current_date - 3
        AND (ds.perfect OR ds.streak IN (3, 7, 14, 21, 30, 40, 60, 90))
      UNION ALL
      -- A member joining the crew.
      SELECT NULL::uuid, 'joined', m.joined_at, p.id, p.display_name, p.avatar_url, NULL::jsonb, NULL::int, 0, false
      FROM public.crew_members m
      JOIN public.profiles p ON p.id = m.user_id
      WHERE m.crew_id = _crew_id AND m.joined_at > now() - interval '3 days'
    ) rows
    ORDER BY created_at DESC LIMIT 30
  ) a;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.crew_activity(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crew_activity(uuid) TO authenticated;
