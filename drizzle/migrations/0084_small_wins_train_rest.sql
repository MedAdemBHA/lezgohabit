-- P2.6: Small Wins can suggest the player's own habits. Two new win keys so workouts
-- ("train") and the 7-hour sleep habit ("rest") can be posted; post_small_wins only accepts
-- keys present in its labels map, so add them there (other keys and rules unchanged).
DO $$
DECLARE f text; fixed text;
BEGIN
  SELECT pg_get_functiondef('public.post_small_wins(uuid,text[],text,text)'::regprocedure) INTO f;
  IF position('"rest":' IN f) > 0 THEN RETURN; END IF;
  fixed := replace(f, 'labels jsonb:=''{',
    'labels jsonb:=''{"train":{"en":"Trained today","fr":"Entraîné aujourd’hui","ar":"تمرّنت اليوم","aeb":"تمرّنت اليوم"},'
    || '"rest":{"en":"Slept 7 hours","fr":"Dormi 7 heures","ar":"نمت 7 ساعات","aeb":"رقدت 7 سوايع"},');
  IF fixed = f THEN RAISE EXCEPTION 'post_small_wins labels not found'; END IF;
  EXECUTE fixed;
END $$;
