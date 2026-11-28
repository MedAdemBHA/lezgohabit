-- P1.3: one name per habit. Two active templates were both called "Sleep before midnight":
-- the old self-reported `sleep` check and the server-enforced `sleep_before_midnight`
-- time window (21:00-00:00). Keep the enforced one; archive the old template so new
-- players can no longer pick it. Existing user_habits keep working (none today).
UPDATE public.habit_templates SET archived = true WHERE key = 'sleep' AND NOT archived;

-- State each sleep rule in its name so the library never shows two lookalikes.
UPDATE public.habit_templates
SET name = '{"en":"Sleep before midnight","fr":"Dormir avant minuit","ar":"النوم قبل منتصف الليل","aeb":"ارقد قبل نص الليل"}'::jsonb
WHERE key = 'sleep_before_midnight';
