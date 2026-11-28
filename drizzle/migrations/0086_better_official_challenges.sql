-- Each official challenge gets its own goal and a habit set that fits its theme
-- (before: all five used train / read / sleep 7 h and had no goal text).
-- Follows admin_save_official_event's lock rule: once an event has started or has players,
-- only its name, goal and colour may change. Winter Arc (live) gets a goal only.

CREATE TEMP TABLE _event_plan(slug text PRIMARY KEY, goal jsonb, habits text[], ends_on date) ON COMMIT DROP;
INSERT INTO _event_plan VALUES
 ('winter-arc-2026',
  '{"en":"Finish the year stronger: move, read and sleep well every day until 31 December.","fr":"Termine l''année plus fort : bouge, lis et dors bien chaque jour jusqu''au 31 décembre.","ar":"أنهِ السنة أقوى: تحرّك واقرأ ونم جيدًا كل يوم حتى 31 ديسمبر.","aeb":"كمّل العام أقوى: تحرّك، اقرا وارقد مليح كل نهار حتى 31 ديسمبر."}',
  NULL, NULL),
 ('new-year-reset-2027',
  '{"en":"30 days, 3 habits, one clean start: move, read, and keep your phone away for the first hour.","fr":"30 jours, 3 habitudes, un vrai nouveau départ : bouge, lis, et pas de téléphone la première heure.","ar":"30 يومًا، 3 عادات، وبداية نظيفة: تحرّك، اقرأ، وابتعد عن الهاتف في الساعة الأولى.","aeb":"30 نهار، 3 عادات، بداية نظيفة: تحرّك، اقرا، وبلاش تليفون في أول ساعة."}',
  ARRAY['train','read','no_phone_first_hour'], DATE '2027-01-30'),
 ('ramadan-2027',
  '{"en":"A calmer, fuller Ramadan: pray on time, read a page of Quran and stay hydrated between iftar and suhoor.","fr":"Un Ramadan plus serein : prie à l''heure, lis une page de Coran et hydrate-toi entre l''iftar et le shour.","ar":"رمضان أهدأ وأعمق: صلِّ في وقتها، اقرأ صفحة من القرآن، واشرب الماء بين الإفطار والسحور.","aeb":"رمضان أهدى: صلّي في وقتها، اقرا صفحة قرآن، واشرب الماء بين الفطور والسحور."}',
  ARRAY['salat','quran','water'], NULL),
 ('summer-body-2027',
  '{"en":"Six weeks to summer: train, walk 10,000 steps and skip the sugar.","fr":"Six semaines avant l''été : entraîne-toi, marche 10 000 pas et oublie le sucre.","ar":"ستة أسابيع قبل الصيف: تمرّن، امشِ 10,000 خطوة، وتجنّب السكر.","aeb":"ست جمعات قبل الصيف: تمرّن، امشي 10,000 خطوة، وبلاش سكّر."}',
  ARRAY['train','steps10k','no_sugar'], NULL),
 ('comeback-2027',
  '{"en":"Back to school, back to work, back on track: wake early, focus in blocks and sleep before midnight.","fr":"La rentrée, sans stress : lève-toi tôt, travaille par blocs et dors avant minuit.","ar":"العودة إلى الدراسة والعمل بإيقاع جيد: استيقظ مبكرًا، ركّز على فترات، ونم قبل منتصف الليل.","aeb":"الرجعة للقراية والخدمة: قوم بكري، ركّز بالبلوكات، وارقد قبل نص الليل."}',
  ARRAY['wake_early','study_blocks','sleep_before_midnight'], NULL);

-- Goals: always editable.
UPDATE public.seasons s SET event_goal = p.goal
FROM _event_plan p WHERE s.slug = p.slug AND NOT s.is_demo AND NOT s.archived;

-- Habits and dates: only for events that haven't started and have no players.
DO $$
DECLARE p record; sid uuid; i int;
BEGIN
  FOR p IN SELECT * FROM _event_plan WHERE habits IS NOT NULL LOOP
    SELECT id INTO sid FROM public.seasons
    WHERE slug = p.slug AND NOT is_demo AND NOT archived
      AND starts_on > (now() AT TIME ZONE 'Africa/Tunis')::date
      AND NOT EXISTS (SELECT 1 FROM public.season_entries e WHERE e.season_id = seasons.id);
    IF sid IS NULL THEN CONTINUE; END IF;
    IF (SELECT count(*) FROM public.habit_templates WHERE key = ANY(p.habits) AND NOT archived) <> cardinality(p.habits) THEN
      RAISE EXCEPTION 'missing habit template for %', p.slug;
    END IF;
    DELETE FROM public.challenge_habits WHERE season_id = sid;
    FOR i IN 1 .. cardinality(p.habits) LOOP
      INSERT INTO public.challenge_habits(season_id, template_id, habit_key, name, what_counts, kind, target, unit, rule, is_faith, position, is_demo)
      SELECT sid, h.id, h.key, h.name, coalesce(nullif(h.what_counts, '{}'::jsonb), h.description), h.kind,
             h.default_target, h.unit, h.default_rule, h.is_faith, i - 1, false
      FROM public.habit_templates h WHERE h.key = p.habits[i];
    END LOOP;
    IF p.ends_on IS NOT NULL THEN UPDATE public.seasons SET ends_on = p.ends_on WHERE id = sid; END IF;
  END LOOP;
END $$;
