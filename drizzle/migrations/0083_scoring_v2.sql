-- P2.2: simpler scoring for challenges that start after this ships (owner decision 2026-11-28).
-- Rule v2, in one sentence: up to 100 points for your habits, +20 for a perfect day,
-- +10 for a proof photo, +10 when your crew syncs, and a streak adds up to 10%.
--   v1 (unchanged, Winter Arc and every season that already started): Daily Dare +10,
--      Lift PRs up to +15, streak multiplier up to x1.5.
--   v2: no Daily Dare or Lift bonus (both hidden for launch), streak multiplier capped at x1.10.
-- Nothing is recalculated: finalized days are frozen and v1 seasons keep v1.

ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS scoring_version smallint NOT NULL DEFAULT 1;
-- Rows that exist now stay on v1; every season created from now on gets v2.
ALTER TABLE public.seasons ALTER COLUMN scoring_version SET DEFAULT 2;
-- Seasons already created but not started yet (e.g. drafts for January) also move to v2.
UPDATE public.seasons SET scoring_version = 2
WHERE starts_on > (now() AT TIME ZONE 'Africa/Tunis')::date AND scoring_version = 1;
ALTER TABLE public.seasons ADD CONSTRAINT seasons_scoring_version_check CHECK (scoring_version IN (1, 2));

-- recompute_day: branch the two bonuses and the multiplier cap on the season's version.
DO $$
DECLARE f text; fixed text;
BEGIN
  SELECT pg_get_functiondef('public.recompute_day(uuid,uuid,date)'::regprocedure) INTO f;
  IF position('scoring_version' IN f) > 0 THEN RETURN; END IF;
  fixed := replace(f,
    'IF coalesce(ex.chaos_done,false) THEN st:=st+10;END IF;st:=st+least(coalesce(ex.lift_prs,0)*5,15);',
    'IF s.scoring_version<2 THEN IF coalesce(ex.chaos_done,false) THEN st:=st+10;END IF;st:=st+least(coalesce(ex.lift_prs,0)*5,15);END IF;');
  IF fixed = f THEN RAISE EXCEPTION 'recompute_day: bonus block not found'; END IF;
  f := fixed;
  fixed := replace(f, 'mult:=least(1+0.05*v_streak,1.5);',
    'mult:=least(1+0.05*v_streak,CASE WHEN s.scoring_version>=2 THEN 1.10 ELSE 1.5 END);');
  IF fixed = f THEN RAISE EXCEPTION 'recompute_day: multiplier not found'; END IF;
  EXECUTE fixed;
END $$;

-- Calculator for v2 seasons (scoring_preview keeps serving v1).
CREATE OR REPLACE FUNCTION public.scoring_preview_v2(_picked integer, _done integer, _streak integer, _proof boolean, _crew boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE habits numeric; stacks numeric; mult numeric;
BEGIN
  IF _picked NOT BETWEEN 1 AND 8 OR _done NOT BETWEEN 0 AND _picked OR _streak NOT BETWEEN 0 AND 90 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  habits := 100::numeric * _done / _picked;
  stacks := (CASE WHEN _done = _picked THEN 20 ELSE 0 END) + (CASE WHEN _proof THEN 10 ELSE 0 END)
          + (CASE WHEN _crew THEN 10 ELSE 0 END);
  mult := least(1 + 0.05 * _streak, 1.10);
  RETURN jsonb_build_object('habits', round(habits, 2), 'stacks', stacks, 'multiplier', mult,
    'total', floor((habits + stacks) * mult), 'max', floor((100 + 20 + 10 + 10) * 1.10));
END $$;
REVOKE ALL ON FUNCTION public.scoring_preview_v2(integer, integer, integer, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scoring_preview_v2(integer, integer, integer, boolean, boolean) TO authenticated;
