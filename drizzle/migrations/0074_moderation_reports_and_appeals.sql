CREATE TABLE IF NOT EXISTS public.community_member_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  crew_id uuid REFERENCES public.crews(id) ON DELETE CASCADE,
  reporter uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 280),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE NULLS NOT DISTINCT (season_id,crew_id,reporter,target_id)
);
CREATE INDEX IF NOT EXISTS community_member_reports_open ON public.community_member_reports(season_id,crew_id,created_at DESC) WHERE reviewed_at IS NULL;
ALTER TABLE public.community_member_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_member_reports FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.community_member_reports TO service_role;

CREATE OR REPLACE FUNCTION public.report_community_member(_season uuid,_target uuid,_reason text,_crew uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); why text:=trim(coalesce(_reason,''));
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL OR uid=_target OR length(why) NOT BETWEEN 3 AND 280 THEN RAISE EXCEPTION 'invalid_report'; END IF;
  IF (SELECT count(*) FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id
      WHERE e.season_id=_season AND e.user_id IN(uid,_target) AND NOT p.is_demo AND p.account_status='active'
        AND e.status IN ('active','completed'))<>2 THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _crew IS NOT NULL AND (SELECT count(*) FROM public.crew_members m JOIN public.crews c ON c.id=m.crew_id
      WHERE m.crew_id=_crew AND c.season_id=_season AND NOT c.archived AND m.user_id IN(uid,_target))<>2
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.community_member_reports(season_id,crew_id,reporter,target_id,reason)
  VALUES(_season,_crew,uid,_target,why) ON CONFLICT(season_id,crew_id,reporter,target_id) DO UPDATE
    SET reason=excluded.reason,created_at=now(),reviewed_at=NULL WHERE community_member_reports.reviewed_at IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION public.community_member_reports_queue(_season uuid,_crew uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public._can_moderate_community(_season,_crew) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN coalesce((SELECT jsonb_agg(row) FROM (
    SELECT jsonb_build_object('id',r.id,'handle',p.handle,'reason',r.reason) row
    FROM public.community_member_reports r JOIN public.profiles p ON p.id=r.target_id
    WHERE r.season_id=_season AND r.crew_id IS NOT DISTINCT FROM _crew AND r.reviewed_at IS NULL
    ORDER BY r.created_at DESC LIMIT 50
  ) x),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.resolve_community_member_report(_report uuid,_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.community_member_reports; why text:=trim(coalesce(_reason,''));
BEGIN
  PERFORM public._guest_guard();
  SELECT * INTO r FROM public.community_member_reports WHERE id=_report AND reviewed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT public._can_moderate_community(r.season_id,r.crew_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(why) NOT BETWEEN 3 AND 280 THEN RAISE EXCEPTION 'invalid_reason'; END IF;
  UPDATE public.community_member_reports SET reviewed_at=now() WHERE id=r.id;
  INSERT INTO public.community_moderation_log(scope,scope_id,season_id,actor_id,action,reason)
  VALUES(CASE WHEN r.crew_id IS NULL THEN 'event' ELSE 'crew' END,coalesce(r.crew_id,r.season_id),r.season_id,auth.uid(),'resolve_member_report',why);
END $$;

CREATE TABLE IF NOT EXISTS public.community_appeals (
  notice_id uuid PRIMARY KEY REFERENCES public.community_moderation_log(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 280),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  response text CHECK (char_length(response) BETWEEN 3 AND 280)
);
ALTER TABLE public.community_appeals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_appeals FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.community_appeals TO service_role;
ALTER TABLE public.community_moderation_log ADD COLUMN IF NOT EXISTS notice_seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.submit_moderation_appeal(_notice uuid,_body text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._guest_guard();
  IF NOT EXISTS(SELECT 1 FROM public.community_moderation_log l
    WHERE l.id=_notice AND l.target_id=auth.uid() AND l.action IN ('hide','mute','ban','remove'))
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.community_appeals(notice_id,body) VALUES(_notice,trim(_body))
  ON CONFLICT(notice_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.mark_moderation_notice_read(_notice uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.community_moderation_log SET notice_seen_at=coalesce(notice_seen_at,now())
  WHERE id=_notice AND target_id=auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_moderation_notices() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(row),'[]'::jsonb) FROM (
    SELECT jsonb_build_object('id',l.id,'scope',l.scope,'name',coalesce(c.name,s.name->>'en'),
      'action',l.action,'reason',l.reason,'at',l.created_at,'seen',l.notice_seen_at IS NOT NULL,
      'appeal',a.body,'response',a.response) row
    FROM public.community_moderation_log l JOIN public.seasons s ON s.id=l.season_id
    LEFT JOIN public.crews c ON l.scope='crew' AND c.id=l.scope_id
    LEFT JOIN public.community_appeals a ON a.notice_id=l.id
    WHERE l.target_id=auth.uid() ORDER BY l.created_at DESC LIMIT 20
  ) messages
$$;

CREATE OR REPLACE FUNCTION public.admin_moderation_appeals() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN coalesce((SELECT jsonb_agg(row) FROM (
    SELECT jsonb_build_object('id',l.id,'season',l.season_id,'crew',c.id,'name',coalesce(c.name,s.name->>'en'),
      'action',l.action,'reason',l.reason,'body',a.body,'handle',p.handle) row
    FROM public.community_appeals a JOIN public.community_moderation_log l ON l.id=a.notice_id
    JOIN public.seasons s ON s.id=l.season_id JOIN public.profiles p ON p.id=l.target_id
    LEFT JOIN public.crews c ON l.scope='crew' AND c.id=l.scope_id
    WHERE a.reviewed_at IS NULL ORDER BY a.created_at LIMIT 50
  ) x),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_moderation_appeal(_notice uuid,_response text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE admin uuid; response_text text:=trim(coalesce(_response,''));
BEGIN
  PERFORM public._guest_guard();
  admin:=public._require_admin();
  IF length(response_text) NOT BETWEEN 3 AND 280 THEN RAISE EXCEPTION 'invalid_reason'; END IF;
  UPDATE public.community_appeals SET reviewed_at=now(),reviewer_id=admin,response=response_text
  WHERE notice_id=_notice AND reviewed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.community_moderation_log SET notice_seen_at=NULL WHERE id=_notice;
  PERFORM public._admin_audit('review_moderation_appeal',_notice::text,'{}');
END $$;

CREATE OR REPLACE FUNCTION public.rotate_crew_invite(_season uuid,_crew uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE next_code text;
BEGIN
  PERFORM public._guest_guard();
  PERFORM 1 FROM public.crews WHERE id=_crew AND season_id=_season AND NOT archived FOR UPDATE;
  IF NOT FOUND OR NOT public._can_moderate_community(_season,_crew) THEN RAISE EXCEPTION 'forbidden'; END IF;
  LOOP
    next_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    EXIT WHEN NOT EXISTS(SELECT FROM public.crews WHERE code=next_code) AND NOT EXISTS(SELECT FROM public.challenges WHERE code=next_code);
  END LOOP;
  UPDATE public.crews SET code=next_code WHERE id=_crew;
  INSERT INTO public.community_moderation_log(scope,scope_id,season_id,actor_id,action,reason)
  VALUES('crew',_crew,_season,auth.uid(),'rotate_invite','');
  RETURN next_code;
END $$;

REVOKE ALL ON FUNCTION public.report_community_member(uuid,uuid,text,uuid),public.community_member_reports_queue(uuid,uuid),
  public.resolve_community_member_report(uuid,text),public.submit_moderation_appeal(uuid,text),
  public.mark_moderation_notice_read(uuid),public.admin_moderation_appeals(),public.admin_resolve_moderation_appeal(uuid,text),
  public.rotate_crew_invite(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.report_community_member(uuid,uuid,text,uuid),public.community_member_reports_queue(uuid,uuid),
  public.resolve_community_member_report(uuid,text),public.submit_moderation_appeal(uuid,text),
  public.mark_moderation_notice_read(uuid),public.admin_moderation_appeals(),public.admin_resolve_moderation_appeal(uuid,text),
  public.rotate_crew_invite(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_active_participation_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sid uuid;
BEGIN
  IF uid IS NULL OR coalesce(current_setting('lezgo.final_override',true),'')='on' THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_TABLE_NAME='checkins' THEN
    PERFORM public._require_active_participation(NEW.user_id,(SELECT season_id FROM public.user_habits WHERE id=NEW.user_habit_id));
  ELSIF TG_TABLE_NAME='user_habits' THEN
    PERFORM public._require_active_participation(NEW.user_id,NEW.season_id);
  ELSIF TG_TABLE_NAME='bonus_points' THEN
    PERFORM public._require_active_participation(NEW.user_id,NEW.season_id);
  ELSIF TG_TABLE_NAME='posts' THEN
    IF TG_OP='INSERT' THEN
      IF NEW.is_pinned AND NEW.user_id=uid AND NEW.visibility='everyone' AND NEW.type='thought'
        AND coalesce(current_setting('lezgo.event_announcement',true),'')='on'
        AND public._can_moderate_community(NEW.season_id,NULL)
      THEN RETURN NEW; END IF;
      PERFORM public._require_active_participation(NEW.user_id,NEW.season_id);
    ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.season_id IS DISTINCT FROM OLD.season_id OR NEW.body IS DISTINCT FROM OLD.body OR NEW.image_url IS DISTINCT FROM OLD.image_url THEN
      PERFORM public._require_active_participation(NEW.user_id,NEW.season_id);
    END IF;
  ELSIF TG_TABLE_NAME='day_extras' THEN
    IF NOT EXISTS(SELECT 1 FROM public.season_entries e JOIN public.seasons s ON s.id=e.season_id WHERE e.user_id=NEW.user_id AND e.status='active' AND NEW.day BETWEEN s.starts_on AND s.ends_on) THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.publish_event_announcement(_season uuid,_body text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.seasons; post uuid; body_text text:=trim(coalesce(_body,''));
BEGIN
  PERFORM public._guest_guard();
  IF NOT public._can_moderate_community(_season,NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(body_text) NOT BETWEEN 3 AND 280 THEN RAISE EXCEPTION 'invalid_post'; END IF;
  SELECT * INTO s FROM public.seasons WHERE id=_season AND published AND NOT archived AND NOT is_demo
    AND status<>'ended' AND frozen_at IS NULL AND public._event_today() BETWEEN starts_on AND ends_on FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  UPDATE public.posts SET is_pinned=false WHERE season_id=_season AND is_pinned;
  PERFORM set_config('lezgo.event_announcement','on',true);
  INSERT INTO public.posts(user_id,season_id,type,body,visibility,day,is_pinned)
  VALUES(auth.uid(),_season,'thought',body_text,'everyone',public._event_today(),true)
  RETURNING id INTO post;
  PERFORM set_config('lezgo.event_announcement','off',true);
  IF EXISTS(SELECT 1 FROM public.posts p WHERE p.id=post AND p.hidden) THEN RAISE EXCEPTION 'post_requires_review'; END IF;
  INSERT INTO public.community_moderation_log(scope,scope_id,season_id,actor_id,post_id,action,reason)
  VALUES('event',_season,_season,auth.uid(),post,'pin_announcement','');
END $$;
REVOKE ALL ON FUNCTION public.publish_event_announcement(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_event_announcement(uuid,text) TO authenticated;
