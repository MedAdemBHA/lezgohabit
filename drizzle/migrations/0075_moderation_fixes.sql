-- Fixes found while reviewing 0073/0074 before applying them.
-- 1. Lifting an event ban now gives the player their place back (if the event is still running and
--    they have not started another challenge). Before, an unbanned player stayed surrendered forever.
-- 2. Creator announcements on private-board challenges no longer fail with no_crew.
-- 3. Appeals validate their text and return a readable error instead of a constraint violation.

CREATE OR REPLACE FUNCTION public._reinstate_moderated_entry(_user uuid,_season uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.seasons; prev text:=coalesce(current_setting('lezgo.final_override',true),'');
BEGIN
  SELECT * INTO s FROM public.seasons WHERE id=_season;
  IF NOT FOUND OR s.frozen_at IS NOT NULL OR s.status='ended' OR s.ends_on<public._event_today() THEN RETURN false; END IF;
  PERFORM 1 FROM public.season_entries WHERE user_id=_user AND season_id=_season
    AND status='surrendered' AND end_reason='moderation' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=_user AND status='active') THEN RETURN false; END IF;
  PERFORM set_config('lezgo.final_override','on',true);
  DELETE FROM public.season_results WHERE user_id=_user AND season_id=_season AND participation_status='surrendered';
  UPDATE public.season_entries SET status='active',ended_at=NULL,end_reason=NULL WHERE user_id=_user AND season_id=_season;
  PERFORM set_config('lezgo.final_override',prev,true);
  INSERT INTO public.user_preferences(user_id,active_challenge_id)
  VALUES(_user,(SELECT id FROM public.challenges WHERE season_id=_season))
  ON CONFLICT(user_id) DO UPDATE SET active_challenge_id=excluded.active_challenge_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public._reinstate_moderated_entry(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.moderate_community(_season uuid,_crew uuid,_action text,_target uuid,_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); p public.posts; target_user uuid; why text:=trim(coalesce(_reason,''));
  context_scope text:=CASE WHEN _crew IS NULL THEN 'event' ELSE 'crew' END;
  context_id uuid:=coalesce(_crew,_season); restriction_kind text;
BEGIN
  PERFORM public._guest_guard();
  IF _crew IS NOT NULL THEN PERFORM 1 FROM public.crews WHERE id=_crew FOR UPDATE; END IF;
  IF NOT public._can_moderate_community(_season,_crew) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(why) NOT BETWEEN 3 AND 280 THEN RAISE EXCEPTION 'invalid_reason'; END IF;

  IF _action IN ('hide','restore','dismiss') THEN
    SELECT * INTO p FROM public.posts WHERE id=_target FOR UPDATE;
    IF NOT FOUND OR NOT coalesce(public._community_post_in_scope(p,_season,_crew),false) THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO public.community_post_moderation(scope,scope_id,post_id,hidden)
    VALUES(context_scope,context_id,p.id,_action='hide')
    ON CONFLICT(scope,scope_id,post_id) DO UPDATE SET
      hidden=CASE WHEN _action='dismiss' THEN community_post_moderation.hidden ELSE excluded.hidden END,reviewed_at=now();
    IF _action='hide' AND _crew IS NULL AND p.is_pinned THEN UPDATE public.posts SET is_pinned=false WHERE id=p.id; END IF;
    IF _action<>'dismiss' THEN target_user:=p.user_id; END IF;
  ELSIF _action IN ('mute','unmute','ban','unban','remove','transfer') THEN
    target_user:=_target;
    IF uid=target_user OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target_user AND NOT is_demo
      AND (NOT is_admin OR public._caller_is_admin())) THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF _crew IS NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended(_season::text||target_user::text,73)); END IF;
    IF _action IN ('mute','ban','remove','transfer') AND NOT (
      CASE WHEN _crew IS NULL THEN EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=target_user AND season_id=_season AND status='active')
        ELSE EXISTS(SELECT 1 FROM public.crew_members WHERE user_id=target_user AND crew_id=_crew) END)
    THEN RAISE EXCEPTION 'member_not_found'; END IF;
    IF _action IN ('mute','ban','unmute','unban') THEN
      restriction_kind:=CASE WHEN _action IN ('mute','unmute') THEN 'mute' ELSE 'ban' END;
      IF _action IN ('mute','ban') THEN
        INSERT INTO public.community_restrictions(scope,scope_id,user_id,restriction,reason)
        VALUES(context_scope,context_id,target_user,restriction_kind,why)
        ON CONFLICT(scope,scope_id,user_id,restriction) DO UPDATE SET reason=excluded.reason;
      ELSE
        DELETE FROM public.community_restrictions r WHERE r.scope=context_scope AND r.scope_id=context_id
          AND r.user_id=target_user AND r.restriction=restriction_kind;
      END IF;
    END IF;
    IF _action IN ('remove','transfer') AND _crew IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF _action='transfer' THEN
      UPDATE public.crew_members SET role=CASE WHEN user_id=target_user THEN 'owner' ELSE 'member' END WHERE crew_id=_crew;
      UPDATE public.crews SET owner_id=target_user WHERE id=_crew;
    ELSIF _crew IS NOT NULL AND _action IN ('remove','ban') THEN
      IF EXISTS(SELECT 1 FROM public.crews WHERE id=_crew AND owner_id=target_user) THEN RAISE EXCEPTION 'forbidden'; END IF;
      DELETE FROM public.crew_members WHERE crew_id=_crew AND user_id=target_user;
      UPDATE public.season_entries e SET mode='solo' WHERE e.season_id=_season AND e.user_id=target_user AND e.status='active'
        AND NOT EXISTS(SELECT 1 FROM public.crew_members m JOIN public.crews c ON c.id=m.crew_id
          WHERE m.user_id=e.user_id AND c.season_id=e.season_id AND c.kind<>'duo');
    ELSIF _action='ban' THEN
      PERFORM public._snapshot_moderated_entry(target_user,_season);
    ELSIF _action='unban' AND _crew IS NULL THEN
      PERFORM public._reinstate_moderated_entry(target_user,_season);
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_moderation_action';
  END IF;

  INSERT INTO public.community_moderation_log(scope,scope_id,season_id,actor_id,target_id,post_id,action,reason)
  VALUES(context_scope,context_id,_season,uid,target_user,p.id,_action,why);
END $$;

CREATE OR REPLACE FUNCTION public.guard_challenge_post() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Pinned creator/admin announcements are published to every participant of the event.
  IF coalesce(current_setting('lezgo.event_announcement',true),'')='on' THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.challenges c WHERE c.season_id=NEW.season_id AND NOT c.public_board AND c.audience<>'solo') THEN
    IF NEW.crew_id IS NULL THEN RAISE EXCEPTION 'no_crew'; END IF;
    NEW.visibility:='crew';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.submit_moderation_appeal(_notice uuid,_body text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE body_text text:=trim(coalesce(_body,''));
BEGIN
  PERFORM public._guest_guard();
  IF length(body_text) NOT BETWEEN 3 AND 280 THEN RAISE EXCEPTION 'invalid_appeal'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.community_moderation_log l
    WHERE l.id=_notice AND l.target_id=auth.uid() AND l.action IN ('hide','mute','ban','remove'))
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.community_appeals(notice_id,body) VALUES(_notice,body_text)
  ON CONFLICT(notice_id) DO NOTHING;
END $$;
