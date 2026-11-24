-- 0063 seeds challenge snapshots before the expanded habit library exists.
-- Add Sleep 7h now, then complete Winter Arc's agreed train/read/sleep7 list.
INSERT INTO public.habit_templates(key,category,name,description,icon,kind,default_target,unit,is_faith,sort,color,what_counts,default_rule)
VALUES(
  'sleep7','body',
  '{"en":"Sleep 7 hours","fr":"Dormir 7 heures","ar":"النوم 7 ساعات","aeb":"ارقد 7 سوايع"}'::jsonb,
  '{"en":"Get at least 7 hours of sleep.","fr":"Dors au moins 7 heures.","ar":"نم 7 ساعات على الأقل.","aeb":"ارقد 7 سوايع على الأقل."}'::jsonb,
  'moon','count',7,'h',false,53,'purple',
  '{"en":"Get at least 7 hours of sleep.","fr":"Dors au moins 7 heures.","ar":"نم 7 ساعات على الأقل.","aeb":"ارقد 7 سوايع على الأقل."}'::jsonb,
  '{}'::jsonb
)
ON CONFLICT(key) DO UPDATE SET
  category=excluded.category,
  name=excluded.name,
  description=excluded.description,
  icon=excluded.icon,
  kind=excluded.kind,
  default_target=excluded.default_target,
  unit=excluded.unit,
  is_faith=excluded.is_faith,
  sort=excluded.sort,
  color=excluded.color,
  what_counts=excluded.what_counts,
  default_rule=excluded.default_rule;

INSERT INTO public.challenge_habits(season_id,template_id,habit_key,name,what_counts,kind,target,unit,rule,is_faith,position,is_demo)
SELECT s.id,h.id,h.key,h.name,coalesce(nullif(h.what_counts,'{}'::jsonb),h.description),h.kind,h.default_target,h.unit,h.default_rule,h.is_faith,2,s.is_demo
FROM public.seasons s
JOIN public.habit_templates h ON h.key='sleep7'
WHERE s.slug='winter-arc-2026' AND NOT s.archived AND NOT s.is_demo
  AND NOT EXISTS(SELECT 1 FROM public.challenge_habits ch WHERE ch.season_id=s.id AND ch.habit_key='sleep7')
ON CONFLICT(season_id,position) DO NOTHING;
