-- P1.3 check: no two active habit templates share a display name in any locale.
-- Run in the SQL editor; it raises with the duplicates or reports PASS.
DO $test$
DECLARE dupes text;
BEGIN
  SELECT string_agg(format('%s "%s": %s', l, n, keys), E'\n') INTO dupes FROM (
    SELECT x.l, t.name->>x.l AS n, array_agg(t.key ORDER BY t.key) AS keys
    FROM public.habit_templates t, (VALUES ('en'),('fr'),('ar'),('aeb')) x(l)
    WHERE NOT t.archived GROUP BY 1, 2 HAVING count(*) > 1) d;
  IF dupes IS NOT NULL THEN RAISE EXCEPTION E'FAIL duplicate habit names:\n%', dupes; END IF;
  RAISE NOTICE 'PASS unique habit names';
END $test$;
