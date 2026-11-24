ALTER TABLE public.habit_templates ADD COLUMN IF NOT EXISTS default_rule jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(default_rule)='object');
UPDATE public.habit_templates SET what_counts=description WHERE what_counts='{}'::jsonb;

-- Replace the old hard-coded kind allowlist while preserving all existing habit keys.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='public.habit_templates'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%kind%' LOOP
    EXECUTE format('ALTER TABLE public.habit_templates DROP CONSTRAINT %I',r.conname);
  END LOOP;
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='public.user_habits'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%kind%' LOOP
    EXECUTE format('ALTER TABLE public.user_habits DROP CONSTRAINT %I',r.conname);
  END LOOP;
END $$;
ALTER TABLE public.habit_templates ADD CONSTRAINT habit_templates_kind_check CHECK(kind IN ('check','count','salat','lift','detox','time_window','quit','timer'));
ALTER TABLE public.user_habits ADD CONSTRAINT user_habits_kind_check CHECK(kind IN ('check','count','salat','lift','detox','time_window','quit','timer'));

INSERT INTO public.habit_templates(key,category,name,description,icon,kind,default_target,unit,is_faith,sort,color,what_counts,default_rule)
VALUES
('cold_shower','body','{"en":"Cold shower","fr":"Douche froide","ar":"دش بارد","aeb":"دوش بارد"}','{"en":"Finish with at least 30 seconds of cold water.","fr":"Termine par au moins 30 secondes d’eau froide.","ar":"اختم بما لا يقل عن 30 ثانية من الماء البارد.","aeb":"اختم بـ30 ثانية ماء بارد على الأقل."}','water','check',1,NULL,false,31,'blue','{"en":"Finish with at least 30 seconds of cold water.","fr":"Termine par au moins 30 secondes d’eau froide.","ar":"اختم بما لا يقل عن 30 ثانية من الماء البارد.","aeb":"اختم بـ30 ثانية ماء بارد على الأقل."}','{}'),
('wake_early','body','{"en":"Wake up early","fr":"Se lever tôt","ar":"الاستيقاظ مبكرًا","aeb":"فيق بكري"}','{"en":"Check in between 04:00 and 07:00 local time.","fr":"Valide entre 04 h et 07 h, heure locale.","ar":"سجّل بين 04:00 و07:00 بالتوقيت المحلي.","aeb":"سجّل بين 04:00 و07:00 بالتوقيت المحلي."}','sleep','time_window',1,NULL,false,32,'purple','{"en":"Check in between 04:00 and 07:00 local time.","fr":"Valide entre 04 h et 07 h, heure locale.","ar":"سجّل بين 04:00 و07:00 بالتوقيت المحلي.","aeb":"سجّل بين 04:00 و07:00 بالتوقيت المحلي."}','{"window_start":"04:00","window_end":"07:00"}'),
('sleep_before_midnight','body','{"en":"Sleep before midnight","fr":"Dormir avant minuit","ar":"النوم قبل منتصف الليل","aeb":"ارقد قبل نص الليل"}','{"en":"Check in from 21:00 until midnight local time.","fr":"Valide de 21 h à minuit, heure locale.","ar":"سجّل من 21:00 حتى منتصف الليل بالتوقيت المحلي.","aeb":"سجّل من 21:00 حتى نص الليل بالتوقيت المحلي."}','sleep','time_window',1,NULL,false,33,'purple','{"en":"Check in from 21:00 until midnight local time.","fr":"Valide de 21 h à minuit, heure locale.","ar":"سجّل من 21:00 حتى منتصف الليل بالتوقيت المحلي.","aeb":"سجّل من 21:00 حتى نص الليل بالتوقيت المحلي."}','{"window_start":"21:00","window_end":"00:00"}'),
('steps10k','body','{"en":"10,000 steps","fr":"10 000 pas","ar":"10 آلاف خطوة","aeb":"10 آلاف خطوة"}','{"en":"Walk 10,000 steps today.","fr":"Marche 10 000 pas aujourd’hui.","ar":"امشِ 10 آلاف خطوة اليوم.","aeb":"امشي 10 آلاف خطوة اليوم."}','footprints','count',10000,'steps',false,34,'orange','{"en":"Walk 10,000 steps today.","fr":"Marche 10 000 pas aujourd’hui.","ar":"امشِ 10 آلاف خطوة اليوم.","aeb":"امشي 10 آلاف خطوة اليوم."}','{}'),
('pushups','body','{"en":"Push-ups","fr":"Pompes","ar":"تمارين الضغط","aeb":"بومبة"}','{"en":"Complete 50 controlled reps.","fr":"Fais 50 répétitions contrôlées.","ar":"أكمل 50 تكرارًا مضبوطًا.","aeb":"كمّل 50 بومبة بالراحة."}','train','count',50,'reps',false,35,'pink','{"en":"Complete 50 controlled reps.","fr":"Fais 50 répétitions contrôlées.","ar":"أكمل 50 تكرارًا مضبوطًا.","aeb":"كمّل 50 بومبة بالراحة."}','{}'),
('plank','body','{"en":"Plank","fr":"Gainage","ar":"بلانك","aeb":"بلانك"}','{"en":"Hold a plank for 3 minutes with this page visible.","fr":"Tiens 3 minutes, page visible.","ar":"اثبت 3 دقائق مع إبقاء الصفحة ظاهرة.","aeb":"اثبت 3 دقايق والصفحة ظاهرة."}','train','timer',3,'min',false,36,'orange','{"en":"Hold a plank for 3 minutes with this page visible.","fr":"Tiens 3 minutes, page visible.","ar":"اثبت 3 دقائق مع إبقاء الصفحة ظاهرة.","aeb":"اثبت 3 دقايق والصفحة ظاهرة."}','{}'),
('stretch','body','{"en":"Stretch / mobility","fr":"Étirements / mobilité","ar":"تمدد وحركة","aeb":"تمطيط وحركة"}','{"en":"Move gently for 10 minutes with this page visible.","fr":"Bouge doucement 10 minutes, page visible.","ar":"تحرك بلطف 10 دقائق مع إبقاء الصفحة ظاهرة.","aeb":"تحرّك بالراحة 10 دقايق والصفحة ظاهرة."}','run','timer',10,'min',false,37,'teal','{"en":"Move gently for 10 minutes with this page visible.","fr":"Bouge doucement 10 minutes, page visible.","ar":"تحرك بلطف 10 دقائق مع إبقاء الصفحة ظاهرة.","aeb":"تحرّك بالراحة 10 دقايق والصفحة ظاهرة."}','{}'),
('sunlight','body','{"en":"Morning sunlight","fr":"Lumière du matin","ar":"شمس الصباح","aeb":"شمس الصباح"}','{"en":"Spend 10 minutes outside before 11:00 local time.","fr":"Passe 10 minutes dehors avant 11 h.","ar":"اقضِ 10 دقائق خارجًا قبل 11:00 بالتوقيت المحلي.","aeb":"اقعد 10 دقايق البرّا قبل 11:00."}','run','count',10,'min',false,38,'yellow','{"en":"Spend 10 minutes outside before 11:00 local time.","fr":"Passe 10 minutes dehors avant 11 h.","ar":"اقضِ 10 دقائق خارجًا قبل 11:00 بالتوقيت المحلي.","aeb":"اقعد 10 دقايق البرّا قبل 11:00."}','{"window_start":"06:00","window_end":"11:00"}'),
('fruit_veg','fuel','{"en":"Fruit & vegetables","fr":"Fruits et légumes","ar":"فواكه وخضار","aeb":"غلة وخضرة"}','{"en":"Eat 5 portions of fruit or vegetables.","fr":"Mange 5 portions de fruits ou légumes.","ar":"تناول 5 حصص من الفواكه أو الخضار.","aeb":"كول 5 حصص غلة ولا خضرة."}','water','count',5,'portions',false,39,'lime','{"en":"Eat 5 portions of fruit or vegetables.","fr":"Mange 5 portions de fruits ou légumes.","ar":"تناول 5 حصص من الفواكه أو الخضار.","aeb":"كول 5 حصص غلة ولا خضرة."}','{}'),
('protein_meals','fuel','{"en":"Protein each meal","fr":"Protéines à chaque repas","ar":"بروتين في كل وجبة","aeb":"بروتين في كل وجبة"}','{"en":"Include a protein source in each meal.","fr":"Ajoute une source de protéines à chaque repas.","ar":"أضف مصدر بروتين إلى كل وجبة.","aeb":"زيد مصدر بروتين في كل وجبة."}','water','count',3,'meals',false,40,'pink','{"en":"Include a protein source in each meal.","fr":"Ajoute une source de protéines à chaque repas.","ar":"أضف مصدر بروتين إلى كل وجبة.","aeb":"زيد مصدر بروتين في كل وجبة."}','{}'),
('energy_drink_free','quit','{"en":"No energy drinks","fr":"Pas de boisson énergisante","ar":"بلا مشروبات طاقة","aeb":"بلا مشروبات طاقة"}','{"en":"Confirm a clean day in the evening window; slips reset this day only.","fr":"Confirme ta journée le soir ; un écart remet cette journée à zéro.","ar":"أكد يومًا بلا مشروبات في الفترة المسائية؛ التعثر يصفر هذا اليوم فقط.","aeb":"أكّد نهار بلا مشروبات طاقة في العشية؛ الزلّة تصفّر النهار هذا برك."}','no-sugar','quit',1,NULL,false,41,'teal','{"en":"Confirm a clean day in the evening window; slips reset this day only.","fr":"Confirme ta journée le soir ; un écart remet cette journée à zéro.","ar":"أكد يومًا بلا مشروبات في الفترة المسائية؛ التعثر يصفر هذا اليوم فقط.","aeb":"أكّد نهار بلا مشروبات طاقة في العشية؛ الزلّة تصفّر النهار هذا برك."}','{"window_start":"18:00","window_end":"03:00"}'),
('study_blocks','mind','{"en":"Focus blocks","fr":"Blocs de concentration","ar":"جلسات تركيز","aeb":"جلسات تركيز"}','{"en":"Finish two 25-minute focus blocks.","fr":"Termine deux blocs de 25 minutes.","ar":"أكمل جلستي تركيز مدة كل منهما 25 دقيقة.","aeb":"كمّل زوز جلسات تركيز كل وحدة 25 دقيقة."}','learn','count',50,'min',false,42,'blue','{"en":"Finish two 25-minute focus blocks.","fr":"Termine deux blocs de 25 minutes.","ar":"أكمل جلستي تركيز مدة كل منهما 25 دقيقة.","aeb":"كمّل زوز جلسات تركيز كل وحدة 25 دقيقة."}','{}'),
('language_practice','mind','{"en":"Language practice","fr":"Pratique d’une langue","ar":"ممارسة لغة","aeb":"ممارسة لغة"}','{"en":"Practice a language for 15 minutes.","fr":"Pratique une langue pendant 15 minutes.","ar":"مارس لغة لمدة 15 دقيقة.","aeb":"مارس لغة 15 دقيقة."}','learn','count',15,'min',false,43,'blue','{"en":"Practice a language for 15 minutes.","fr":"Pratique une langue pendant 15 minutes.","ar":"مارس لغة لمدة 15 دقيقة.","aeb":"مارس لغة 15 دقيقة."}','{}'),
('meditation','mind','{"en":"Meditation / breathing","fr":"Méditation / respiration","ar":"تأمل وتنفس","aeb":"تأمل وتنفس"}','{"en":"Meditate or breathe for 10 minutes with this page visible.","fr":"Médite ou respire 10 minutes, page visible.","ar":"تأمل أو تنفس 10 دقائق مع إبقاء الصفحة ظاهرة.","aeb":"تأمل ولا تنفّس 10 دقايق والصفحة ظاهرة."}','thought','timer',10,'min',false,44,'purple','{"en":"Meditate or breathe for 10 minutes with this page visible.","fr":"Médite ou respire 10 minutes, page visible.","ar":"تأمل أو تنفس 10 دقائق مع إبقاء الصفحة ظاهرة.","aeb":"تأمل ولا تنفّس 10 دقايق والصفحة ظاهرة."}','{}'),
('gratitude','mind','{"en":"Gratitude","fr":"Gratitude","ar":"الامتنان","aeb":"الامتنان"}','{"en":"Name three things you are grateful for.","fr":"Note trois choses qui te rendent reconnaissant.","ar":"اذكر ثلاثة أشياء تشعر بالامتنان لها.","aeb":"سمّي ثلاثة حاجات حامد ربي عليهم."}','thought','check',1,NULL,false,45,'yellow','{"en":"Name three things you are grateful for.","fr":"Note trois choses qui te rendent reconnaissant.","ar":"اذكر ثلاثة أشياء تشعر بالامتنان لها.","aeb":"سمّي ثلاثة حاجات حامد ربي عليهم."}','{}'),
('no_phone_first_hour','digital','{"en":"No phone first hour","fr":"Pas de téléphone au réveil","ar":"بلا هاتف في أول ساعة","aeb":"بلا تليفون في أول ساعة"}','{"en":"Keep your first waking hour phone-free; check in 09:00–10:00 local time.","fr":"Garde ta première heure sans téléphone ; valide de 9 h à 10 h.","ar":"اترك أول ساعة بعد الاستيقاظ بلا هاتف؛ سجّل بين 09:00 و10:00.","aeb":"خلي أول ساعة بعد ما تفيق بلا تليفون؛ سجّل بين 09:00 و10:00."}','phone-off','time_window',1,NULL,false,46,'blue','{"en":"Keep your first waking hour phone-free; check in 09:00–10:00 local time.","fr":"Garde ta première heure sans téléphone ; valide de 9 h à 10 h.","ar":"اترك أول ساعة بعد الاستيقاظ بلا هاتف؛ سجّل بين 09:00 و10:00.","aeb":"خلي أول ساعة بعد ما تفيق بلا تليفون؛ سجّل بين 09:00 و10:00."}','{"window_start":"09:00","window_end":"10:00"}'),
('screen_limit','digital','{"en":"Screen time under 2 h","fr":"Temps d’écran sous 2 h","ar":"وقت الشاشة أقل من ساعتين","aeb":"وقت الشاشة أقل من ساعتين"}','{"en":"Log your screen-time total; under 120 minutes completes the habit.","fr":"Note ton temps d’écran ; moins de 120 min valide l’habitude.","ar":"سجل وقت الشاشة؛ أقل من 120 دقيقة يكمل العادة.","aeb":"سجّل وقت الشاشة؛ أقل من 120 دقيقة تكمل العادة."}','phone-off','count',120,'min',false,47,'purple','{"en":"Log your screen-time total; under 120 minutes completes the habit.","fr":"Note ton temps d’écran ; moins de 120 min valide l’habitude.","ar":"سجل وقت الشاشة؛ أقل من 120 دقيقة يكمل العادة.","aeb":"سجّل وقت الشاشة؛ أقل من 120 دقيقة تكمل العادة."}','{"limit_max":true}'),
('make_bed','life','{"en":"Make your bed","fr":"Faire son lit","ar":"ترتيب السرير","aeb":"رتّب فراشك"}','{"en":"Make your bed before 10:00 local time.","fr":"Fais ton lit avant 10 h.","ar":"رتب سريرك قبل 10:00 بالتوقيت المحلي.","aeb":"رتّب فراشك قبل 10:00."}','sleep','time_window',1,NULL,false,48,'yellow','{"en":"Make your bed before 10:00 local time.","fr":"Fais ton lit avant 10 h.","ar":"رتب سريرك قبل 10:00 بالتوقيت المحلي.","aeb":"رتّب فراشك قبل 10:00."}','{"window_start":"06:00","window_end":"10:00"}'),
('tidy_10','life','{"en":"Tidy for 10 minutes","fr":"Ranger 10 minutes","ar":"ترتيب 10 دقائق","aeb":"رتّب 10 دقايق"}','{"en":"Tidy one space for 10 minutes.","fr":"Range un espace pendant 10 minutes.","ar":"رتب مكانًا واحدًا لمدة 10 دقائق.","aeb":"رتّب بلاصة وحدة 10 دقايق."}','thought','timer',10,'min',false,49,'orange','{"en":"Tidy one space for 10 minutes.","fr":"Range un espace pendant 10 minutes.","ar":"رتب مكانًا واحدًا لمدة 10 دقائق.","aeb":"رتّب بلاصة وحدة 10 دقايق."}','{}'),
('budget_day','life','{"en":"No-spend day","fr":"Journée sans dépense","ar":"يوم بلا مصاريف","aeb":"نهار بلا مصروف"}','{"en":"Stay within your budget today.","fr":"Respecte ton budget aujourd’hui.","ar":"التزم بميزانيتك اليوم.","aeb":"التزم بميزانيتك اليوم."}','thought','check',1,NULL,false,50,'teal','{"en":"Stay within your budget today.","fr":"Respecte ton budget aujourd’hui.","ar":"التزم بميزانيتك اليوم.","aeb":"التزم بميزانيتك اليوم."}','{}'),
('call_friend','life','{"en":"Call someone you care about","fr":"Appeler un proche","ar":"اتصل بشخص تحبه","aeb":"عيّط لواحد عزيز عليك"}','{"en":"Call a family member or friend.","fr":"Appelle un proche ou un ami.","ar":"اتصل بأحد أفراد العائلة أو صديق.","aeb":"عيّط لقريب ولا صاحب."}','thought','check',1,NULL,false,51,'pink','{"en":"Call a family member or friend.","fr":"Appelle un proche ou un ami.","ar":"اتصل بأحد أفراد العائلة أو صديق.","aeb":"عيّط لقريب ولا صاحب."}','{}'),
('smoke_free','quit','{"en":"Smoke-free day","fr":"Journée sans tabac","ar":"يوم بلا تدخين","aeb":"نهار بلا دخان"}','{"en":"Confirm a smoke-free day in the evening; slips only reset today.","fr":"Confirme une journée sans tabac le soir ; un écart ne remet qu’aujourd’hui à zéro.","ar":"أكد يومًا بلا تدخين مساءً؛ التعثر يصفر اليوم فقط.","aeb":"أكد نهار بلا دخان في العشية؛ الزلة تصفر النهار هذا برك."}','no-sugar','quit',1,NULL,false,52,'teal','{"en":"Confirm a smoke-free day in the evening; slips only reset today.","fr":"Confirme une journée sans tabac le soir ; un écart ne remet qu’aujourd’hui à zéro.","ar":"أكد يومًا بلا تدخين مساءً؛ التعثر يصفر اليوم فقط.","aeb":"أكد نهار بلا دخان في العشية؛ الزلة تصفر النهار هذا برك."}','{"window_start":"18:00","window_end":"03:00"}')
ON CONFLICT(key) DO UPDATE SET description=excluded.description,what_counts=excluded.what_counts,default_rule=excluded.default_rule;

-- Existing template copy becomes the default concise rule shown on every habit card.
UPDATE public.habit_templates SET what_counts=description WHERE what_counts='{}'::jsonb;

CREATE OR REPLACE FUNCTION public._time_window_allows(_rule jsonb,_local_time time) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE start_at time; end_at time;
BEGIN
  IF NOT (_rule ? 'window_start' AND _rule ? 'window_end') THEN RETURN false; END IF;
  start_at:=(_rule->>'window_start')::time;
  end_at:=(_rule->>'window_end')::time;
  IF start_at=end_at THEN RETURN false; END IF;
  IF start_at<end_at THEN RETURN _local_time>=start_at AND _local_time<end_at; END IF;
  RETURN _local_time>=start_at OR _local_time<end_at;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public._time_window_allows(jsonb,time) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.guard_habit_rule() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE start_at time; end_at time;
BEGIN
  IF NEW.kind IN ('time_window','quit') OR NEW.rule ? 'window_start' OR NEW.rule ? 'window_end' THEN
    IF NOT (NEW.rule ? 'window_start' AND NEW.rule ? 'window_end') THEN RAISE EXCEPTION 'invalid_time_window'; END IF;
    BEGIN start_at:=(NEW.rule->>'window_start')::time; end_at:=(NEW.rule->>'window_end')::time;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_time_window'; END;
    IF start_at=end_at THEN RAISE EXCEPTION 'invalid_time_window'; END IF;
  END IF;
  IF NEW.kind='timer' AND (NEW.target NOT BETWEEN 1 AND 180 OR NEW.target<>trunc(NEW.target)) THEN RAISE EXCEPTION 'invalid_timer_target'; END IF;
  IF NEW.kind='quit' AND NEW.rule->>'window_start' IS NULL THEN RAISE EXCEPTION 'invalid_quit_window'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_habit_rule() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS habit_template_rule_guard ON public.habit_templates;
CREATE TRIGGER habit_template_rule_guard BEFORE INSERT OR UPDATE ON public.habit_templates FOR EACH ROW EXECUTE FUNCTION public.guard_habit_rule();
DROP TRIGGER IF EXISTS challenge_habit_rule_guard ON public.challenge_habits;
CREATE TRIGGER challenge_habit_rule_guard BEFORE INSERT OR UPDATE ON public.challenge_habits FOR EACH ROW EXECUTE FUNCTION public.guard_habit_rule();
DROP TRIGGER IF EXISTS user_habit_rule_guard ON public.user_habits;
CREATE TRIGGER user_habit_rule_guard BEFORE INSERT OR UPDATE ON public.user_habits FOR EACH ROW EXECUTE FUNCTION public.guard_habit_rule();

CREATE OR REPLACE FUNCTION public.validate_challenge_habit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ch public.challenge_habits; challenge public.challenges; entry_kind text; hkey text;
BEGIN
  IF coalesce(current_setting('lezgo.habit_rpc',true),'')='on' THEN RETURN NEW; END IF;
  SELECT kind INTO entry_kind FROM public.season_entries WHERE user_id=NEW.user_id AND season_id=NEW.season_id;
  IF entry_kind='personal' AND NOT EXISTS(SELECT 1 FROM public.challenges WHERE season_id=NEW.season_id) THEN RETURN NEW; END IF;
  SELECT * INTO challenge FROM public.challenges WHERE season_id=NEW.season_id;
  SELECT key INTO hkey FROM public.habit_templates WHERE id=NEW.template_id;
  SELECT * INTO ch FROM public.challenge_habits WHERE season_id=NEW.season_id AND template_id IS NOT DISTINCT FROM NEW.template_id AND habit_key=coalesce(hkey,NEW.custom_name) LIMIT 1;
  IF NOT FOUND OR NEW.kind IS DISTINCT FROM ch.kind OR NEW.target IS DISTINCT FROM ch.target OR NEW.unit IS DISTINCT FROM ch.unit OR NEW.rule IS DISTINCT FROM ch.rule OR NEW.what_counts IS DISTINCT FROM ch.what_counts OR NOT NEW.active THEN
    RAISE EXCEPTION 'challenge_habits_locked';
  END IF;
  IF ch.is_faith AND challenge.season_id IS NOT NULL AND NOT challenge.faith_allowed THEN RAISE EXCEPTION 'challenge_faith_disabled'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_challenge_habit() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS challenge_habit_guard ON public.user_habits;
CREATE TRIGGER challenge_habit_guard BEFORE INSERT OR UPDATE ON public.user_habits FOR EACH ROW EXECUTE FUNCTION public.validate_challenge_habit();

CREATE OR REPLACE FUNCTION public._habit_completion(_kind text,_target numeric,_value numeric,_detail jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path=public AS $$
SELECT CASE
  WHEN coalesce((_detail->>'held')::boolean,false) THEN 0
  WHEN _detail ? 'limit_met' THEN CASE WHEN coalesce((_detail->>'limit_met')::boolean,false) THEN 1 ELSE 0 END
  WHEN _kind='salat' THEN least(1,coalesce((SELECT sum(CASE e.v WHEN 'on_time' THEN 1 WHEN 'late' THEN 0.5 ELSE 0 END) FROM jsonb_each_text(coalesce(_detail->'prayers','{}'::jsonb)) AS e(k,v)),0)/5.0)
  WHEN _kind='count' THEN least(1,greatest(0,coalesce(_value,0)/nullif(_target,0)))
  ELSE CASE WHEN coalesce(_value,0)>0 THEN 1 ELSE 0 END
END
$$;

CREATE OR REPLACE FUNCTION public.checkin_upsert(_user_habit_id uuid,_value numeric,_detail jsonb DEFAULT NULL::jsonb,_day date DEFAULT NULL::date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); h public.user_habits; d date; today date; ex public.checkins; tk text; comp numeric; v_done timestamptz; v_detail jsonb; reason text; n int; cid uuid; held boolean:=false; cap numeric;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO h FROM public.user_habits WHERE id=_user_habit_id AND user_id=uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit_not_found'; END IF;
  IF h.kind='salat' THEN RAISE EXCEPTION 'use_mark_prayer'; END IF;
  IF h.kind='timer' THEN RAISE EXCEPTION 'timer_required'; END IF;
  today:=public._local_today(uid); d:=coalesce(_day,today);
  PERFORM public._check_day_window(uid,d);
  IF _value IS NULL OR _value<0 OR _value>1000000 THEN RAISE EXCEPTION 'bad_value'; END IF;
  SELECT key INTO tk FROM public.habit_templates WHERE id=h.template_id;
  IF h.kind='quit' THEN
    IF _value NOT IN (0,1) THEN RAISE EXCEPTION 'bad_value'; END IF;
    IF _value>0 AND (d<>today OR NOT public._time_window_allows(h.rule,(now() AT TIME ZONE coalesce(public._effective_tz(uid),'Africa/Tunis'))::time)) THEN RAISE EXCEPTION 'outside_time_window'; END IF;
  ELSIF h.kind='time_window' OR h.rule ? 'window_start' THEN
    IF d<>today OR NOT public._time_window_allows(h.rule,(now() AT TIME ZONE coalesce(public._effective_tz(uid),'Africa/Tunis'))::time) THEN RAISE EXCEPTION 'outside_time_window'; END IF;
  END IF;
  IF h.kind IN ('check','time_window') AND _value NOT IN (0,1) THEN RAISE EXCEPTION 'bad_value'; END IF;
  SELECT * INTO ex FROM public.checkins WHERE user_habit_id=_user_habit_id AND day=d FOR UPDATE;
  IF FOUND THEN
    held:=coalesce((ex.detail->>'held')::boolean,false) AND EXISTS(SELECT 1 FROM public.point_reviews WHERE checkin_id=ex.id AND status='pending');
    IF ex.done_at IS NOT NULL AND ex.done_at<now()-interval '10 minutes' AND NOT (h.kind='count' AND _value>=ex.value) THEN RAISE EXCEPTION 'habit_locked'; END IF;
  END IF;
  v_detail:=coalesce(_detail,'{}'::jsonb)-'held'-'prayers'-'marked_at'-'limit_met'-'logged_minutes';
  IF h.kind='quit' AND _value=0 THEN v_detail:=v_detail||jsonb_build_object('slip',true); END IF;
  IF tk='screen_limit' THEN v_detail:=v_detail||jsonb_build_object('limit_met',_value<h.target,'logged_minutes',_value); END IF;
  cap:=CASE WHEN tk='steps' THEN 60000 WHEN tk='water' THEN 6 WHEN tk='run' THEN 50 WHEN tk='read' THEN 300 WHEN tk='pushups' THEN 1000 WHEN tk='screen_limit' THEN 1440 WHEN h.unit='reps' THEN 1000 WHEN h.unit='km' THEN 100 WHEN h.unit='min' THEN 600 WHEN h.unit='L' THEN 8 WHEN h.kind='count' THEN greatest(100,h.target*10) ELSE NULL END;
  reason:=CASE WHEN cap IS NOT NULL AND _value>cap THEN 'count_cap' END;
  SELECT count(*) INTO n FROM public.activity_events WHERE user_id=uid AND kind='checkin' AND created_at>now()-interval '1 minute';
  IF reason IS NULL AND n>=40 THEN reason:='burst'; END IF;
  IF reason IS NOT NULL OR held THEN v_detail:=v_detail||'{"held":true}'::jsonb; END IF;
  comp:=public._habit_completion(h.kind,h.target,_value,v_detail-'held');
  v_done:=CASE WHEN comp>=1 THEN coalesce(ex.done_at,now()) END;
  INSERT INTO public.checkins(user_id,user_habit_id,day,value,detail,done_at,is_demo)
  VALUES(uid,_user_habit_id,d,_value,v_detail,v_done,h.is_demo)
  ON CONFLICT(user_habit_id,day) DO UPDATE SET value=excluded.value,detail=excluded.detail,done_at=excluded.done_at,created_at=now()
  RETURNING id INTO cid;
  IF reason IS NOT NULL THEN
    INSERT INTO public.point_reviews(user_id,checkin_id,user_habit_id,season_id,day,reason,value,is_demo)
    VALUES(uid,cid,_user_habit_id,h.season_id,d,reason,_value,h.is_demo)
    ON CONFLICT(checkin_id) WHERE status='pending' DO UPDATE SET reason=excluded.reason,value=excluded.value;
  ELSIF held THEN UPDATE public.point_reviews SET value=_value WHERE checkin_id=cid AND status='pending'; END IF;
  PERFORM public._recompute_with_crew(uid,h.season_id,d);
  RETURN coalesce((SELECT to_jsonb(ds) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=h.season_id AND ds.day=d),'{}'::jsonb)||jsonb_build_object('done_at',v_done,'held',reason IS NOT NULL OR held);
END $$;

CREATE TABLE IF NOT EXISTS public.habit_timer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_habit_id uuid NOT NULL REFERENCES public.user_habits(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  day date NOT NULL,
  target_minutes integer NOT NULL CHECK(target_minutes BETWEEN 1 AND 180),
  tracked_seconds integer NOT NULL DEFAULT 0 CHECK(tracked_seconds>=0),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','abandoned')),
  is_demo boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS habit_timer_one_running_per_user_habit ON public.habit_timer_sessions(user_habit_id) WHERE status='running';
CREATE UNIQUE INDEX IF NOT EXISTS habit_timer_one_running_per_user ON public.habit_timer_sessions(user_id) WHERE status='running';
ALTER TABLE public.habit_timer_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.habit_timer_sessions FROM anon,authenticated;
GRANT ALL ON public.habit_timer_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.start_habit_timer(_user_habit_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); h public.user_habits; sess public.habit_timer_sessions; d date;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO h FROM public.user_habits WHERE id=_user_habit_id AND user_id=uid AND active;
  IF NOT FOUND OR h.kind<>'timer' THEN RAISE EXCEPTION 'habit_not_found'; END IF;
  PERFORM public._require_active_participation(uid,h.season_id);
  d:=public._local_today(uid); PERFORM public._check_day_window(uid,d);
  SELECT * INTO sess FROM public.habit_timer_sessions WHERE user_habit_id=h.id AND status='running' FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('id',sess.id,'tracked_seconds',sess.tracked_seconds,'target_minutes',sess.target_minutes,'started_at',sess.started_at); END IF;
  INSERT INTO public.habit_timer_sessions(user_id,user_habit_id,season_id,day,target_minutes,is_demo)
  VALUES(uid,h.id,h.season_id,d,h.target::int,h.is_demo) RETURNING * INTO sess;
  RETURN jsonb_build_object('id',sess.id,'tracked_seconds',0,'target_minutes',sess.target_minutes,'started_at',sess.started_at);
END $$;

CREATE OR REPLACE FUNCTION public.habit_timer_heartbeat(_session_id uuid,_visible boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sess public.habit_timer_sessions; gap integer; tracked integer;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO sess FROM public.habit_timer_sessions WHERE id=_session_id AND user_id=uid AND status='running' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'timer_not_running'; END IF;
  PERFORM public._require_active_participation(uid,sess.season_id);
  gap:=greatest(0,extract(epoch FROM now()-sess.last_heartbeat_at)::int);
  tracked:=sess.tracked_seconds+CASE WHEN _visible AND gap BETWEEN 5 AND 45 THEN gap ELSE 0 END;
  UPDATE public.habit_timer_sessions SET tracked_seconds=tracked,last_heartbeat_at=now() WHERE id=sess.id;
  RETURN jsonb_build_object('tracked_seconds',tracked,'target_minutes',sess.target_minutes,'complete',tracked>=sess.target_minutes*60);
END $$;

CREATE OR REPLACE FUNCTION public.complete_habit_timer(_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sess public.habit_timer_sessions; h public.user_habits; ex public.checkins; r jsonb;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO sess FROM public.habit_timer_sessions WHERE id=_session_id AND user_id=uid AND status='running' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'timer_not_running'; END IF;
  PERFORM public._require_active_participation(uid,sess.season_id);
  IF sess.tracked_seconds<sess.target_minutes*60 THEN RAISE EXCEPTION 'timer_too_short'; END IF;
  SELECT * INTO h FROM public.user_habits WHERE id=sess.user_habit_id AND user_id=uid AND active;
  SELECT * INTO ex FROM public.checkins WHERE user_habit_id=h.id AND day=sess.day FOR UPDATE;
  IF FOUND AND ex.done_at IS NOT NULL AND ex.done_at<now()-interval '10 minutes' THEN RAISE EXCEPTION 'habit_locked'; END IF;
  INSERT INTO public.checkins(user_id,user_habit_id,day,value,detail,done_at,is_demo)
  VALUES(uid,h.id,sess.day,h.target,jsonb_build_object('timer_seconds',sess.tracked_seconds),coalesce(ex.done_at,now()),h.is_demo)
  ON CONFLICT(user_habit_id,day) DO UPDATE SET value=excluded.value,detail=excluded.detail,done_at=coalesce(public.checkins.done_at,now()),created_at=now();
  UPDATE public.habit_timer_sessions SET status='completed',ended_at=now() WHERE id=sess.id;
  PERFORM public._recompute_with_crew(uid,sess.season_id,sess.day);
  SELECT to_jsonb(ds) INTO r FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=sess.season_id AND ds.day=sess.day;
  RETURN coalesce(r,'{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_habit_timer(_session_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._guest_guard();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.habit_timer_sessions SET status='abandoned',ended_at=now() WHERE id=_session_id AND user_id=auth.uid() AND status='running';
END $$;

REVOKE ALL ON FUNCTION public.start_habit_timer(uuid),public.habit_timer_heartbeat(uuid,boolean),public.complete_habit_timer(uuid),public.cancel_habit_timer(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_habit_timer(uuid),public.habit_timer_heartbeat(uuid,boolean),public.complete_habit_timer(uuid),public.cancel_habit_timer(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public._time_window_allows(jsonb,time),public.guard_habit_rule(),public._habit_completion(text,numeric,numeric,jsonb) FROM PUBLIC,anon,authenticated;
