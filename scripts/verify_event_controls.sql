-- Apply 0072 and 0073 to a test database, then execute this file. Everything rolls back.
BEGIN;
CREATE TEMP TABLE event_checks(check_name text, passed boolean) ON COMMIT DROP;

DO $verify$
DECLARE
  admin uuid:=gen_random_uuid(); creator uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  owner uuid:=gen_random_uuid(); member uuid:=gen_random_uuid(); guest uuid:=gen_random_uuid();
  s uuid; future_event uuid; event_id uuid; creator_event uuid; creator_code text; crew uuid; other_crew uuid;
  post_id uuid; crew_post uuid; event_post uuid; notice uuid; report uuid; old_code text; new_code text;
  d date:=public._event_today(); payload jsonb; check_ok boolean;
BEGIN
  INSERT INTO auth.users(id,instance_id,aud,role,created_at,updated_at,email,raw_user_meta_data,raw_app_meta_data)
  SELECT id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),now(),alias||'@example.invalid','{}'::jsonb,'{}'::jsonb
  FROM (VALUES(admin,'fixtures_admin'),(creator,'fixtures_creator'),(outsider,'fixtures_outsider'),
    (owner,'fixtures_owner'),(member,'fixtures_member'),(guest,'demo')) users(id,alias);
  UPDATE public.profiles SET is_admin=true WHERE id=admin;
  INSERT INTO public.user_roles(user_id,role) VALUES(creator,'creator');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);

  payload:=jsonb_build_object('name',jsonb_build_object('en','Draft fixture'),'goal',jsonb_build_object('en','Train daily'),
    'starts_on',d,'ends_on',d+6,'color','blue','published',false);
  s:=public.admin_save_official_event(NULL,payload,'[{"key":"train","target":1}]');
  INSERT INTO event_checks VALUES('draft stays out of public catalog',NOT EXISTS(
    SELECT FROM jsonb_array_elements(public.public_challenge_catalog()) j WHERE j->>'id'=s::text));
  INSERT INTO event_checks VALUES('admin sees draft and canonical rules',EXISTS(
    SELECT FROM jsonb_array_elements(public.admin_official_events()) j WHERE j->>'id'=s::text AND j->>'state'='draft' AND j->'habits'->0->>'key'='train'));
  PERFORM public.admin_save_official_event(s,payload||'{"published":true}','[{"key":"train","target":1}]');
  future_event:=public.admin_save_official_event(NULL,payload||jsonb_build_object('published',true,'starts_on',d+1,'ends_on',d+7),
    '[{"key":"sleep7","target":7}]');

  check_ok:=false;
  BEGIN
    PERFORM public.admin_save_official_event(s,payload||'{"published":true}','[{"key":"train","target":2}]');
  EXCEPTION WHEN raise_exception THEN check_ok:=SQLERRM='event_rules_locked'; END;
  INSERT INTO event_checks VALUES('open event habit rules cannot be edited',check_ok);

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
  check_ok:=false;
  BEGIN PERFORM public.admin_save_official_event(NULL,payload,'[{"key":"train","target":1}]');
  EXCEPTION WHEN raise_exception THEN check_ok:=true; END;
  INSERT INTO event_checks VALUES('normal account cannot publish events',check_ok);

  check_ok:=false;
  BEGIN PERFORM public.join_season(future_event);
  EXCEPTION WHEN raise_exception THEN check_ok:=SQLERRM='challenge_not_started'; END;
  INSERT INTO event_checks VALUES('server rejects early official joins',check_ok);
  PERFORM public.join_season(s);
  PERFORM public.join_season(s);
  INSERT INTO event_checks VALUES('join is idempotent and snapshots actual habits',
    (SELECT count(*) FROM public.season_entries WHERE user_id=outsider AND season_id=s)=1
    AND (SELECT count(*) FROM public.user_habits WHERE user_id=outsider AND season_id=s AND target=1)=1);
  check_ok:=false;
  BEGIN PERFORM public.create_personal_challenge('Parallel fixture',7,'[{"key":"train"}]');
  EXCEPTION WHEN raise_exception THEN check_ok:=SQLERRM='active_challenge_exists'; END;
  INSERT INTO event_checks VALUES('one active slot is shared across event kinds',check_ok);

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
  PERFORM public.join_season(s,'crew');
  crew:=public.create_crew('Crew fixture','squad',6)::uuid;
  UPDATE public.crews SET is_public=true WHERE id=crew;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
  PERFORM public.join_crew((SELECT code FROM public.crews WHERE id=crew));
  post_id:=public.create_post(s,'thought',NULL,'Joined the crew',NULL,'{}','everyone');
  crew_post:=public.create_post(s,'thought',NULL,'Private crew post',NULL,'{}','crew');

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
  PERFORM public.report_community_post(post_id,'Fixture reason',crew);
  PERFORM public.report_community_member(s,member,'Fixture member report',crew);
  report:=(public.community_member_reports_queue(s,crew)->0->>'id')::uuid;
  INSERT INTO event_checks VALUES('crew member report contains no reporter identity',report IS NOT NULL
    AND NOT (public.community_member_reports_queue(s,crew)->0 ? 'reporter'));
  PERFORM public.resolve_community_member_report(report,'Fixture review reason');
  INSERT INTO event_checks VALUES('reviewed member reports leave the queue',jsonb_array_length(public.community_member_reports_queue(s,crew))=0);
  INSERT INTO event_checks VALUES('crew owner can review scoped reports',jsonb_array_length(public.community_moderation_queue(s,crew)->'reports')=1);
  PERFORM public.moderate_community(s,crew,'hide',post_id,'Fixture hide');
  INSERT INTO event_checks VALUES('crew hide does not erase event feed content',
    NOT EXISTS(SELECT FROM jsonb_array_elements(public.proof_feed(s,'crew')) p WHERE p->>'id'=post_id::text)
    AND EXISTS(SELECT FROM jsonb_array_elements(public.proof_feed(s,'challenge')) p WHERE p->>'id'=post_id::text));
  PERFORM public.moderate_community(s,crew,'restore',post_id,'Fixture restore');
  INSERT INTO event_checks VALUES('crew can restore its own hidden post',
    EXISTS(SELECT FROM jsonb_array_elements(public.proof_feed(s,'crew')) p WHERE p->>'id'=post_id::text));
  old_code:=(SELECT code FROM public.crews WHERE id=crew);
  new_code:=public.rotate_crew_invite(s,crew);
  INSERT INTO event_checks VALUES('invite rotation invalidates the old preview',
    new_code<>old_code AND public.crew_invite_preview(old_code) IS NULL AND public.crew_invite_preview(new_code) IS NOT NULL);
  PERFORM public.moderate_community(s,crew,'ban',member,'Fixture crew ban');

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
  check_ok:=false;
  BEGIN PERFORM public.join_crew((SELECT code FROM public.crews WHERE id=crew));
  EXCEPTION WHEN raise_exception THEN check_ok:=SQLERRM='crew_moderation_ban'; END;
  INSERT INTO event_checks VALUES('crew ban rejects valid invite and preserves active event',check_ok
    AND EXISTS(SELECT FROM public.season_entries WHERE user_id=member AND season_id=s AND status='active')
    AND public.can_read_post(crew_post)); -- authors retain access to their own posts
  other_crew:=(public.find_challenge_crew()->>'crew_id')::uuid;
  INSERT INTO event_checks VALUES('automatic matching skips banned crew',other_crew<>crew);
  INSERT INTO event_checks VALUES('private notice visible to affected member',EXISTS(
    SELECT FROM jsonb_array_elements(public.my_moderation_notices()) j WHERE j->>'action'='ban' AND j->>'scope'='crew'));
  SELECT (j->>'id')::uuid INTO notice FROM jsonb_array_elements(public.my_moderation_notices()) j WHERE j->>'action'='ban';
  PERFORM public.submit_moderation_appeal(notice,'Fixture appeal');
  PERFORM public.mark_moderation_notice_read(notice);
  INSERT INTO event_checks VALUES('affected player can appeal and mark private notice read',
    EXISTS(SELECT FROM jsonb_array_elements(public.my_moderation_notices()) j WHERE j->>'id'=notice::text
      AND j->>'appeal'='Fixture appeal' AND j->>'seen'='true'));
  INSERT INTO event_checks VALUES('ordinary members cannot manage another crew',NOT public.community_moderation_access(s,crew));

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
  check_ok:=false;
  BEGIN PERFORM public.submit_moderation_appeal(notice,'Cross-user attempt');
  EXCEPTION WHEN raise_exception THEN check_ok:=SQLERRM='forbidden'; END;
  INSERT INTO event_checks VALUES('another player cannot see or appeal the notice',check_ok AND public.my_moderation_notices()='[]');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
  INSERT INTO event_checks VALUES('Lezgo admin sees pending appeal',EXISTS(SELECT FROM jsonb_array_elements(public.admin_moderation_appeals()) j WHERE j->>'id'=notice::text));
  PERFORM public.admin_resolve_moderation_appeal(notice,'Fixture response');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
  INSERT INTO event_checks VALUES('admin response is private and unread',
    EXISTS(SELECT FROM jsonb_array_elements(public.my_moderation_notices()) j WHERE j->>'id'=notice::text
      AND j->>'response'='Fixture response' AND j->>'seen'='false'));

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',creator,'role','authenticated')::text,true);
  payload:=public.create_creator_challenge('Creator fixture',7,d,'[{"key":"train"}]');
  creator_event:=(payload->>'season_id')::uuid; creator_code:=payload->>'code';
  INSERT INTO event_checks VALUES('creator scope only covers own event',public.community_moderation_access(creator_event)
    AND NOT public.community_moderation_access(s));

  PERFORM public.publish_event_announcement(creator_event,'Fixture announcement');
  INSERT INTO event_checks VALUES('a creator can pin an announcement without consuming a participation slot',
    public.active_season() IS NULL AND EXISTS(SELECT FROM public.posts p WHERE p.season_id=creator_event AND p.is_pinned));

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',guest,'role','authenticated')::text,true);
  PERFORM public.join_challenge(creator_code,'solo');
  INSERT INTO event_checks VALUES('players see the owner announcement in their event feed',
    EXISTS(SELECT FROM jsonb_array_elements(public.proof_feed(creator_event,'challenge')) p WHERE p->>'body'='Fixture announcement'));
  event_post:=public.create_post(creator_event,'thought',NULL,'Creator fixture post');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',creator,'role','authenticated')::text,true);
  PERFORM public.moderate_community(creator_event,NULL,'mute',guest,'Fixture event mute');

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',guest,'role','authenticated')::text,true);
  check_ok:=false;
  BEGIN PERFORM public.create_post(creator_event,'thought',NULL,'Posting after mute');
  EXCEPTION WHEN raise_exception THEN check_ok:=SQLERRM='event_moderation_mute'; END;
  INSERT INTO event_checks VALUES('event mute blocks new posts',check_ok);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',creator,'role','authenticated')::text,true);
  PERFORM public.moderate_community(creator_event,NULL,'ban',guest,'Fixture event ban');
  INSERT INTO event_checks VALUES('event ban ends the active entry and freezes player history',
    EXISTS(SELECT FROM public.season_entries WHERE user_id=guest AND season_id=creator_event AND end_reason='moderation' AND status='surrendered')
    AND EXISTS(SELECT FROM public.season_results WHERE user_id=guest AND season_id=creator_event));
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',guest,'role','authenticated')::text,true);
  check_ok:=false;
  BEGIN PERFORM public.join_challenge(creator_code,'solo');
  EXCEPTION WHEN raise_exception THEN check_ok:=SQLERRM='event_moderation_ban'; END;
  INSERT INTO event_checks VALUES('event ban rejects the original invite',check_ok);
  INSERT INTO event_checks VALUES('ban opens the slot for a different event',public.active_season() IS NULL);
  PERFORM public.join_season(s);
  INSERT INTO event_checks VALUES('the next official event can be joined',EXISTS(
    SELECT FROM public.season_entries WHERE user_id=guest AND season_id=s AND status='active'));
END $verify$;

SELECT check_name, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END result FROM event_checks;
SELECT count(*) FILTER (WHERE passed) AS passed, count(*) AS total FROM event_checks;
ROLLBACK;
