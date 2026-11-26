-- UX-15: upcoming events in the public picker can be reminded by season id
-- (the catalog exposes ids, not slugs). Both wrap the existing slug-based records.
CREATE OR REPLACE FUNCTION public.set_season_reminder_by_id(_season_id uuid, _on boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_slug text;
BEGIN
  PERFORM public._guest_guard();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT slug INTO v_slug FROM public.seasons
  WHERE id=_season_id AND status='upcoming' AND published AND NOT archived AND NOT is_demo;
  IF v_slug IS NULL THEN RAISE EXCEPTION 'invalid_season'; END IF;
  PERFORM public.set_season_reminder(v_slug, _on);
END $$;
REVOKE ALL ON FUNCTION public.set_season_reminder_by_id(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_reminder_by_id(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_season_reminder_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(array_agg(s.id), '{}'::uuid[])
  FROM public.season_reminders r JOIN public.seasons s ON s.slug=r.season_slug
  WHERE r.user_id=auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_season_reminder_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_season_reminder_ids() TO authenticated;
