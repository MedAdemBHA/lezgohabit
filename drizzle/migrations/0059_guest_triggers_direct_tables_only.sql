DO $do$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
    WHERE g.tgname = 'zz_guest_read_only' AND c.relnamespace = 'public'::regnamespace
      AND c.relname <> ALL (ARRAY['profiles','user_habits','user_preferences','notification_preferences','time_capsules','push_subscriptions'])
  LOOP
    EXECUTE format('DROP TRIGGER zz_guest_read_only ON public.%I', t);
  END LOOP;
END $do$;