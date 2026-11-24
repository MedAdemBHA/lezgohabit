-- Own hosting: the notifications job calls the app every 5 minutes once `lezgo_app_url` is stored in Vault.
-- The bearer token lives in Vault as `lezgo_cron_secret` and must equal the Worker secret LOVABLE_CRON_SECRET.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'lezgo_cron_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'lezgo_cron_secret',
      'Bearer token the app checks on /api/public/notifications (Worker secret LOVABLE_CRON_SECRET)');
  END IF;
END $do$;

SELECT cron.schedule('lezgo-integrity-tick', '*/15 * * * *', 'SELECT public.integrity_tick();');
SELECT cron.schedule('lezgo-notifications', '*/5 * * * *', $c$
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'lezgo_app_url') || '/api/public/notifications',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'lezgo_cron_secret')),
  body := '{}'::jsonb)
where exists (select 1 from vault.decrypted_secrets where name = 'lezgo_app_url');
$c$);
