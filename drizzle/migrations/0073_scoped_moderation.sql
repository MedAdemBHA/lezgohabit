-- Shared moderation storage is private. Callers can only act through scoped RPCs.
CREATE TABLE IF NOT EXISTS public.community_restrictions (
  scope text NOT NULL CHECK (scope IN ('event','crew')),
  scope_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restriction text NOT NULL CHECK (restriction IN ('mute','ban')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 280),
  PRIMARY KEY (scope,scope_id,user_id,restriction)
);
CREATE TABLE IF NOT EXISTS public.community_post_moderation (
  scope text NOT NULL CHECK (scope IN ('event','crew')),
  scope_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hidden boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope,scope_id,post_id)
);
CREATE TABLE IF NOT EXISTS public.community_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('event','crew')),
  scope_id uuid NOT NULL,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_moderation_scope_recent ON public.community_moderation_log(scope,scope_id,created_at DESC);
CREATE INDEX IF NOT EXISTS community_moderation_target_recent ON public.community_moderation_log(target_id,created_at DESC);
ALTER TABLE public.community_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_moderation_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_restrictions,public.community_post_moderation,public.community_moderation_log FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.community_restrictions,public.community_post_moderation,public.community_moderation_log TO service_role;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS moderation_crew_id uuid REFERENCES public.crews(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public._community_restricted(_scope text,_id uuid,_user uuid,_restriction text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.community_restrictions
    WHERE scope=_scope AND scope_id=_id AND user_id=_user AND restriction=_restriction)
$$;

CREATE OR REPLACE FUNCTION public._can_moderate_community(_season uuid,_crew uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p JOIN public.seasons s ON s.id=_season
    WHERE p.id=auth.uid() AND p.account_status='active' AND NOT p.is_demo AND NOT s.is_demo
      AND (NOT s.challenge_owned OR EXISTS(SELECT 1 FROM public.challenges ch
        WHERE ch.season_id=s.id AND ch.audience<>'solo'))
      AND (_crew IS NULL OR EXISTS(SELECT 1 FROM public.crews cr WHERE cr.id=_crew AND cr.season_id=s.id AND NOT cr.is_demo))
      AND (p.is_admin OR CASE WHEN _crew IS NULL THEN EXISTS(
        SELECT 1 FROM public.challenges c WHERE c.season_id=s.id AND c.owner_id=p.id AND c.audience='creator'
          AND NOT c.archived AND c.approved AND public.has_role(p.id,'creator')
      ) ELSE EXISTS(
        SELECT 1 FROM public.crews cr JOIN public.crew_members m ON m.crew_id=cr.id AND m.user_id=p.id
        WHERE cr.id=_crew AND cr.owner_id=p.id AND cr.season_id=s.id AND NOT cr.archived
      ) END)
  )
$$;

CREATE OR REPLACE FUNCTION public._community_post_in_scope(_post public.posts,_season uuid,_crew uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _post.season_id=_season AND NOT _post.is_demo
    AND (CASE WHEN _crew IS NULL THEN _post.visibility='everyone' ELSE _post.crew_id=_crew END)
    AND (NOT EXISTS(SELECT 1 FROM public.habit_templates h WHERE h.key=_post.habit_key AND h.is_faith)
      OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=_post.user_id AND p.faith_public) OR _post.user_id=auth.uid())
$$;

CREATE OR REPLACE FUNCTION public._guard_event_restriction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='active' THEN
    IF NEW.kind='creator' AND EXISTS(SELECT 1 FROM public.seasons s WHERE s.id=NEW.season_id
      AND NOT s.is_demo AND s.starts_on>public._event_today()) THEN RAISE EXCEPTION 'challenge_not_started'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.season_id::text||NEW.user_id::text,73));
    IF public._community_restricted('event',NEW.season_id,NEW.user_id,'ban') THEN
      RAISE EXCEPTION 'event_moderation_ban';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS event_moderation_enrollment_guard ON public.season_entries;
CREATE TRIGGER event_moderation_enrollment_guard BEFORE INSERT OR UPDATE OF status ON public.season_entries
FOR EACH ROW EXECUTE FUNCTION public._guard_event_restriction();

CREATE OR REPLACE FUNCTION public._guard_crew_restriction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM public.crews WHERE id=NEW.crew_id FOR UPDATE;
  IF public._community_restricted('crew',NEW.crew_id,NEW.user_id,'ban') THEN RAISE EXCEPTION 'crew_moderation_ban'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crew_moderation_enrollment_guard ON public.crew_members;
CREATE TRIGGER crew_moderation_enrollment_guard BEFORE INSERT ON public.crew_members
FOR EACH ROW EXECUTE FUNCTION public._guard_crew_restriction();

CREATE OR REPLACE FUNCTION public._replace_departed_crew_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE successor uuid;
BEGIN
  PERFORM 1 FROM public.crews WHERE id=OLD.crew_id AND owner_id=OLD.user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN OLD; END IF;
  SELECT user_id INTO successor FROM public.crew_members WHERE crew_id=OLD.crew_id ORDER BY joined_at,user_id LIMIT 1;
  IF successor IS NULL THEN
    UPDATE public.crews SET archived=true WHERE id=OLD.crew_id;
  ELSE
    UPDATE public.crews SET owner_id=successor WHERE id=OLD.crew_id;
    UPDATE public.crew_members SET role='owner' WHERE crew_id=OLD.crew_id AND user_id=successor;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS crew_owner_succession ON public.crew_members;
CREATE TRIGGER crew_owner_succession AFTER DELETE ON public.crew_members
FOR EACH ROW EXECUTE FUNCTION public._replace_departed_crew_owner();

CREATE OR REPLACE FUNCTION public._guard_scoped_post_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF public._community_restricted('event',NEW.season_id,NEW.user_id,'mute') THEN RAISE EXCEPTION 'event_moderation_mute'; END IF;
  IF NEW.visibility='crew' AND public._community_restricted('crew',NEW.crew_id,NEW.user_id,'mute') THEN
    RAISE EXCEPTION 'crew_moderation_mute';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS scoped_moderation_post_guard ON public.posts;
CREATE TRIGGER scoped_moderation_post_guard BEFORE INSERT OR UPDATE OF body,image_url,visibility ON public.posts
FOR EACH ROW EXECUTE FUNCTION public._guard_scoped_post_write();

CREATE OR REPLACE FUNCTION public.community_moderation_access(_season uuid,_crew uuid DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public._can_moderate_community(_season,_crew)
$$;

CREATE OR REPLACE FUNCTION public.report_community_post(_post uuid,_reason text,_crew uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._guest_guard();
  IF _crew IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.posts p JOIN public.crew_members m ON m.crew_id=p.crew_id
    WHERE p.id=_post AND p.crew_id=_crew AND m.user_id=auth.uid()
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public.post_action(_post,'report',_reason);
  IF _crew IS NOT NULL THEN UPDATE public.reports SET moderation_crew_id=_crew
    WHERE post_id=_post AND reporter=auth.uid() AND moderation_crew_id IS NULL; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.community_moderation_queue(_season uuid,_crew uuid DEFAULT NULL,_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE context_scope text:=CASE WHEN _crew IS NULL THEN 'event' ELSE 'crew' END;
  context_id uuid:=coalesce(_crew,_season);
BEGIN
  IF NOT public._can_moderate_community(_season,_crew) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'me',auth.uid(),
    'members',coalesce((SELECT jsonb_agg(row) FROM (
      SELECT jsonb_build_object('id',p.id,'handle',p.handle,'name',p.display_name) row
      FROM public.profiles p WHERE p.account_status='active' AND NOT p.is_demo
        AND (strpos(lower(p.handle),lower(left(coalesce(_search,''),60)))>0
          OR strpos(lower(p.display_name),lower(left(coalesce(_search,''),60)))>0) AND
        (CASE WHEN _crew IS NULL THEN EXISTS(SELECT 1 FROM public.season_entries e WHERE e.season_id=_season AND e.user_id=p.id AND e.status='active')
         ELSE EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=_crew AND m.user_id=p.id) END)
      ORDER BY p.handle LIMIT 100
    ) visible),'[]'::jsonb),
    'restrictions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.user_id,'handle',p.handle,'restriction',r.restriction,'reason',r.reason) ORDER BY p.handle)
      FROM public.community_restrictions r JOIN public.profiles p ON p.id=r.user_id WHERE r.scope=context_scope AND r.scope_id=context_id),'[]'::jsonb),
    'reports',coalesce((SELECT jsonb_agg(row) FROM (
      SELECT jsonb_build_object('id',p.id,'author',pr.handle,'body',p.body,'hidden',coalesce(m.hidden,false),
        'reports',coalesce(q.reasons,'[]'::jsonb)) row
      FROM public.posts p JOIN public.profiles pr ON pr.id=p.user_id
      LEFT JOIN public.community_post_moderation m ON m.post_id=p.id AND m.scope=context_scope AND m.scope_id=context_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(r.reason ORDER BY r.created_at DESC) reasons FROM public.reports r
        WHERE r.post_id=p.id AND (r.moderation_crew_id IS NOT DISTINCT FROM _crew
          OR (_crew IS NOT NULL AND p.visibility='crew' AND r.moderation_crew_id IS NULL))
          AND (m.reviewed_at IS NULL OR r.created_at>m.reviewed_at)
      ) q ON true
      WHERE p.season_id=_season AND public._community_post_in_scope(p,_season,_crew)
        AND (q.reasons IS NOT NULL OR coalesce(m.hidden,false))
      ORDER BY p.created_at DESC LIMIT 50
    ) visible),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public._snapshot_moderated_entry(_user uuid,_season uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.seasons; e public.season_entries; tz text; through date; first_day date; cid uuid;
BEGIN
  SELECT * INTO e FROM public.season_entries WHERE user_id=_user AND season_id=_season AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO s FROM public.seasons WHERE id=_season;
  tz:=coalesce(public._effective_tz(_user),'Africa/Tunis');
  through:=least(s.ends_on,public._local_today(_user));
  first_day:=greatest(s.starts_on,(e.joined_at AT TIME ZONE tz)::date);
  SELECT m.crew_id INTO cid FROM public.crew_members m JOIN public.crews c ON c.id=m.crew_id
    WHERE m.user_id=_user AND c.season_id=_season AND c.kind<>'duo' LIMIT 1;
  PERFORM public._finalize_user_day(_user,_season,through);
  INSERT INTO public.season_results(user_id,season_id,score,daily_points,boss_points,crew_id,perfect_days,best_streak,
    active_days,completed_days,consistency_percent,trophy,trophy_private,participation_kind,participation_status,is_demo)
  SELECT _user,_season,(d.points+b.points)::int,d.points::int,b.points::int,cid,d.perfect,d.streak,d.done,d.done,
    round(100.0*d.done/greatest(1,through-first_day+1),1),d.done>=ceil((s.ends_on-s.starts_on+1)*0.75),
    e.kind='personal',e.kind,'surrendered',e.is_demo
  FROM (SELECT coalesce(sum(total),0) points,count(*) FILTER(WHERE completion=1)::int perfect,coalesce(max(streak),0) streak,
      count(*) FILTER(WHERE completion>=0.6)::int done FROM public.daily_scores WHERE user_id=_user AND season_id=_season
      AND day BETWEEN first_day AND through) d
  CROSS JOIN (SELECT coalesce(sum(points),0) points FROM public.bonus_points WHERE user_id=_user AND season_id=_season) b
  ON CONFLICT(user_id,season_id) DO NOTHING;
  UPDATE public.season_entries SET status='surrendered',ended_at=now(),end_reason='moderation' WHERE user_id=_user AND season_id=_season;
  UPDATE public.user_preferences SET active_challenge_id=NULL WHERE user_id=_user;
  DELETE FROM public.crew_members m USING public.crews c WHERE c.id=m.crew_id AND m.user_id=_user AND c.season_id=_season;
  DELETE FROM public.challenge_squad_members m USING public.challenge_squads q JOIN public.challenges c ON c.id=q.challenge_id
    WHERE m.squad_id=q.id AND m.user_id=_user AND c.season_id=_season;
END $$;

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
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_moderation_action';
  END IF;

  INSERT INTO public.community_moderation_log(scope,scope_id,season_id,actor_id,target_id,post_id,action,reason)
  VALUES(context_scope,context_id,_season,uid,target_user,p.id,_action,why);
END $$;

CREATE OR REPLACE FUNCTION public.my_moderation_notices() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(row),'[]'::jsonb) FROM (
    SELECT jsonb_build_object('id',l.id,'scope',l.scope,'name',coalesce(c.name,s.name->>'en'),
      'action',l.action,'reason',l.reason,'at',l.created_at) row
    FROM public.community_moderation_log l JOIN public.seasons s ON s.id=l.season_id
    LEFT JOIN public.crews c ON l.scope='crew' AND c.id=l.scope_id
    WHERE l.target_id=auth.uid() ORDER BY l.created_at DESC LIMIT 20
  ) messages
$$;

REVOKE ALL ON FUNCTION public._community_restricted(text,uuid,uuid,text),public._can_moderate_community(uuid,uuid),
  public._community_post_in_scope(public.posts,uuid,uuid),public._guard_event_restriction(),public._guard_crew_restriction(),
  public._replace_departed_crew_owner(),public._guard_scoped_post_write(),public._snapshot_moderated_entry(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.community_moderation_access(uuid,uuid),public.report_community_post(uuid,text,uuid),
  public.community_moderation_queue(uuid,uuid,text),public.moderate_community(uuid,uuid,text,uuid,text),public.my_moderation_notices()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_moderation_access(uuid,uuid),public.report_community_post(uuid,text,uuid),
  public.community_moderation_queue(uuid,uuid,text),public.moderate_community(uuid,uuid,text,uuid,text),public.my_moderation_notices()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_post(_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.posts p JOIN public.profiles author ON author.id=p.user_id
    WHERE p.id=_id AND (
      p.user_id=auth.uid() OR (
        (author.is_demo=public._viewer_demo() OR public._caller_is_admin())
        AND author.account_status='active' AND NOT p.hidden
        AND NOT public._community_restricted('event',p.season_id,auth.uid(),'ban')
        AND NOT EXISTS(SELECT 1 FROM public.community_post_moderation m WHERE m.post_id=p.id AND m.hidden
          AND ((m.scope='event' AND m.scope_id=p.season_id) OR (m.scope='crew' AND m.scope_id=p.crew_id AND p.visibility='crew')))
        AND (
          (NOT EXISTS(SELECT 1 FROM public.seasons s WHERE s.id=p.season_id AND s.challenge_owned)
            AND NOT EXISTS(SELECT 1 FROM public.challenges c WHERE c.season_id=p.season_id AND NOT c.public_board))
          OR EXISTS(SELECT 1 FROM public.season_entries e WHERE e.season_id=p.season_id AND e.user_id=auth.uid() AND e.status IN ('active','completed'))
        )
        AND (p.visibility='everyone' OR EXISTS(SELECT 1 FROM public.crew_members m WHERE m.crew_id=p.crew_id AND m.user_id=auth.uid()))
      )
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.proof_feed(_season_id uuid,_scope text DEFAULT 'challenge',_filter text DEFAULT 'all',_before timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); result jsonb; my_crew uuid; demo boolean;
BEGIN
  IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=_season_id AND status='active') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _scope NOT IN ('challenge','crew') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  SELECT p.is_demo INTO demo FROM public.profiles p WHERE p.id=uid;
  SELECT cm.crew_id INTO my_crew FROM public.crew_members cm JOIN public.crews c ON c.id=cm.crew_id WHERE cm.user_id=uid AND c.season_id=_season_id AND NOT c.archived LIMIT 1;
  SELECT coalesce(jsonb_agg(row ORDER BY pinned DESC,created_at DESC),'[]'::jsonb) INTO result FROM (
    SELECT p.created_at,p.is_pinned pinned,jsonb_build_object('id',p.id,'user_id',p.user_id,'type',p.type,'body',p.body,'image_path',p.image_url,'day',p.day,'created_at',p.created_at,'hidden',p.hidden,'visibility',p.visibility,'is_pinned',p.is_pinned,'display_name',pr.display_name,'handle',pr.handle,'avatar_url',pr.avatar_url,'habit_key',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN p.habit_key END,'habit_name',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN h.name END,'category',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN h.category END,'stats',CASE WHEN NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid THEN p.stats ELSE '{}'::jsonb END,'reactions',(SELECT count(*) FROM public.post_reactions r WHERE r.post_id=p.id),'my_reaction',(SELECT kind FROM public.post_reactions r WHERE r.post_id=p.id AND r.user_id=uid)) row
    FROM public.posts p JOIN public.profiles pr ON pr.id=p.user_id LEFT JOIN public.habit_templates h ON h.key=p.habit_key
    WHERE p.season_id=_season_id AND p.is_demo=demo AND public.can_read_post(p.id)
      AND NOT EXISTS(SELECT 1 FROM public.community_post_moderation m WHERE m.scope='event'
        AND m.scope_id=_season_id AND m.post_id=p.id AND m.hidden)
      AND (p.is_pinned OR EXISTS(SELECT 1 FROM public.season_entries e
        WHERE e.user_id=p.user_id AND e.season_id=_season_id AND e.status IN ('active','completed')))
      AND (NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid)
      AND (NOT p.hidden OR p.user_id=uid)
      AND NOT EXISTS(SELECT 1 FROM public.post_hides x WHERE x.post_id=p.id AND x.user_id=uid)
      AND (_before IS NULL OR p.created_at<_before)
      AND ((_scope='challenge' AND p.visibility='everyone') OR (_scope='crew' AND p.crew_id=my_crew
        AND NOT public._community_restricted('crew',my_crew,uid,'ban')
        AND NOT public._community_restricted('crew',my_crew,p.user_id,'mute')
        AND NOT EXISTS(SELECT 1 FROM public.community_post_moderation m
          WHERE m.scope='crew' AND m.scope_id=my_crew AND m.post_id=p.id AND m.hidden)))
      AND (_filter='all' OR (_filter='thought' AND p.type='thought') OR (p.habit_key=_filter AND (NOT coalesce(h.is_faith,false) OR pr.faith_public OR p.user_id=uid)))
    ORDER BY p.is_pinned DESC,p.created_at DESC LIMIT 20
  ) q;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.find_challenge_crew() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sid uuid; c public.crews; cid uuid; v_code text; created boolean:=false; n integer;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT season_id INTO sid FROM public.season_entries WHERE user_id=uid AND status='active' LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(sid::text||uid::text,73));
  IF NOT EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=sid AND status='active' AND kind<>'personal')
  THEN RAISE EXCEPTION 'challenge_not_active'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text||sid::text));
  SELECT cr.* INTO c FROM public.crews cr JOIN public.crew_members mine ON mine.crew_id=cr.id AND mine.user_id=uid WHERE cr.season_id=sid LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('crew_id',c.id,'code',c.code,'name',c.name,'members',(SELECT count(*) FROM public.crew_members WHERE crew_id=c.id),'created',false); END IF;
  SELECT cr.* INTO c FROM public.crews cr WHERE cr.season_id=sid AND cr.is_public AND NOT cr.archived AND cr.max_members=6
    AND NOT public._community_restricted('crew',cr.id,uid,'ban')
    AND (SELECT count(*) FROM public.crew_members m WHERE m.crew_id=cr.id)<6
    ORDER BY (SELECT count(*) FROM public.crew_members m WHERE m.crew_id=cr.id),cr.created_at
    LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF FOUND THEN
    INSERT INTO public.crew_members(crew_id,user_id,role) VALUES(c.id,uid,'member');
    cid:=c.id; v_code:=c.code;
  ELSE
    LOOP v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)); EXIT WHEN NOT EXISTS(SELECT 1 FROM public.crews cr WHERE cr.code=v_code) AND NOT EXISTS(SELECT 1 FROM public.challenges ch WHERE ch.code=v_code); END LOOP;
    INSERT INTO public.crews(season_id,name,code,owner_id,kind,max_members,is_public,is_demo)
      VALUES(sid,'Crew '||substr(v_code,1,3),v_code,uid,'squad',6,true,(SELECT is_demo FROM public.profiles WHERE id=uid)) RETURNING id INTO cid;
    INSERT INTO public.crew_members(crew_id,user_id,role) VALUES(cid,uid,'owner');
    created:=true;
  END IF;
  UPDATE public.season_entries e SET mode='crew' WHERE e.season_id=sid AND e.user_id=uid AND e.status='active';
  SELECT count(*) INTO n FROM public.crew_members WHERE crew_id=cid;
  RETURN jsonb_build_object('crew_id',cid,'code',v_code,'name',(SELECT name FROM public.crews WHERE id=cid),'members',n,'created',created);
END $$;

CREATE OR REPLACE FUNCTION public.set_challenge_pin(_post_id uuid,_pin boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); p public.posts; ch public.challenges; admin boolean;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO p FROM public.posts WHERE id=_post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p.hidden OR p.visibility<>'everyone' OR NOT public.can_read_post(p.id)
    OR EXISTS(SELECT 1 FROM public.community_post_moderation m WHERE m.post_id=p.id AND m.scope='event' AND m.hidden)
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO ch FROM public.challenges WHERE season_id=p.season_id;
  admin:=public.has_role(uid,'admin');
  IF NOT admin AND (ch.id IS NULL OR ch.audience<>'creator' OR ch.owner_id<>uid OR p.user_id<>uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF admin AND ((ch.id IS NOT NULL AND ch.audience<>'creator') OR (ch.id IS NULL AND NOT EXISTS(SELECT 1 FROM public.season_entries e WHERE e.season_id=p.season_id AND e.kind='official'))) THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM 1 FROM public.seasons WHERE id=p.season_id FOR UPDATE;
  UPDATE public.posts SET is_pinned=false WHERE season_id=p.season_id AND is_pinned;
  IF _pin THEN UPDATE public.posts SET is_pinned=true WHERE id=_post_id; END IF;
END $$;


CREATE OR REPLACE FUNCTION public.guard_challenge_post() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.challenges c WHERE c.season_id=NEW.season_id AND NOT c.public_board AND c.audience<>'solo') THEN
    IF NEW.crew_id IS NULL THEN RAISE EXCEPTION 'no_crew'; END IF;
    NEW.visibility:='crew';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.join_challenge(_code text,_mode text DEFAULT 'crew') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); c public.challenges; s public.seasons; cap integer;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _mode NOT IN ('solo','crew') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  SELECT * INTO c FROM public.challenges WHERE code=upper(trim(_code)) AND NOT archived AND is_demo=(SELECT is_demo FROM public.profiles WHERE id=uid);
  IF NOT FOUND OR c.audience='solo' OR NOT c.approved AND c.audience='creator' THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(c.season_id::text||uid::text,73));
  SELECT * INTO c FROM public.challenges WHERE id=c.id AND NOT archived FOR UPDATE;
  IF NOT FOUND OR (NOT c.approved AND c.audience='creator') THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF public._community_restricted('event',c.season_id,uid,'ban') THEN RAISE EXCEPTION 'event_moderation_ban'; END IF;
  SELECT * INTO s FROM public.seasons WHERE id=c.season_id;
  IF s.archived OR NOT s.published THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF s.frozen_at IS NOT NULL OR s.status='ended' OR s.ends_on<public._event_today() THEN RAISE EXCEPTION 'challenge_ended'; END IF;
  IF s.starts_on>public._event_today() THEN RAISE EXCEPTION 'challenge_not_started'; END IF;
  IF (SELECT count(*) FROM public.challenge_habits WHERE season_id=c.season_id) NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'challenge_not_ready'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=c.season_id AND status='surrendered') THEN RAISE EXCEPTION 'challenge_surrendered'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND status='active' AND season_id<>c.season_id) THEN RAISE EXCEPTION 'active_challenge_exists'; END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=c.season_id AND status='active') THEN
    UPDATE public.season_entries SET mode=_mode WHERE user_id=uid AND season_id=c.season_id;
    IF _mode='solo' THEN DELETE FROM public.crew_members cm USING public.crews cr WHERE cm.crew_id=cr.id AND cm.user_id=uid AND cr.season_id=c.season_id; END IF;
    RETURN c.id;
  END IF;
  IF EXISTS(SELECT 1 FROM public.season_entries WHERE user_id=uid AND season_id=c.season_id AND status='completed') THEN RAISE EXCEPTION 'challenge_complete'; END IF;
  SELECT coalesce(max_members,500) INTO cap FROM public.crews WHERE id=c.crew_id;
  IF (SELECT count(*) FROM public.season_entries WHERE season_id=c.season_id AND status IN ('active','completed'))>=coalesce(cap,500) THEN RAISE EXCEPTION 'challenge_full'; END IF;
  INSERT INTO public.season_entries(user_id,season_id,mode,kind,status) VALUES(uid,c.season_id,_mode,CASE WHEN c.audience='creator' THEN 'creator' ELSE 'personal' END,'active');
  IF c.crew_id IS NOT NULL AND _mode='crew' THEN INSERT INTO public.crew_members(crew_id,user_id) VALUES(c.crew_id,uid) ON CONFLICT DO NOTHING; END IF;
  INSERT INTO public.user_habits(user_id,season_id,template_id,custom_name,kind,target,unit,position,what_counts,rule)
  SELECT uid,c.season_id,ch.template_id,CASE WHEN ch.template_id IS NULL THEN ch.name->>'en' END,ch.kind,ch.target,ch.unit,ch.position,ch.what_counts,ch.rule
  FROM public.challenge_habits ch WHERE ch.season_id=c.season_id;
  PERFORM public.activate_challenge(c.id);
  RETURN c.id;
END $$;

CREATE OR REPLACE FUNCTION public.join_crew(_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); cr public.crews; s public.seasons; sid uuid; ch_code text;
BEGIN
  PERFORM public._guest_guard();
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO cr FROM public.crews c WHERE c.code=upper(trim(_code)) AND NOT c.archived AND NOT c.is_demo AND c.kind<>'duo';
  IF NOT FOUND THEN RAISE EXCEPTION 'crew_not_found'; END IF;
  SELECT * INTO s FROM public.seasons WHERE id=cr.season_id;
  IF s.archived OR NOT s.published THEN RAISE EXCEPTION 'crew_not_found'; END IF;
  IF s.frozen_at IS NOT NULL OR s.status='ended' OR s.ends_on<public._event_today() THEN RAISE EXCEPTION 'challenge_ended'; END IF;
  IF s.starts_on>public._event_today() THEN RAISE EXCEPTION 'challenge_not_started'; END IF;
  -- Lock the player first, then the crew, in the same order as event bans.
  PERFORM pg_advisory_xact_lock(hashtextextended(cr.season_id::text||uid::text,73));
  SELECT season_id INTO sid FROM public.season_entries WHERE user_id=uid AND status='active';
  IF sid IS NOT NULL AND sid<>cr.season_id THEN RAISE EXCEPTION 'active_challenge_exists'; END IF;
  IF sid IS NULL THEN
    IF s.challenge_owned THEN
      SELECT c.code INTO ch_code FROM public.challenges c WHERE c.season_id=s.id AND c.audience<>'solo' AND c.approved AND NOT c.archived;
      IF ch_code IS NULL THEN RAISE EXCEPTION 'crew_not_found'; END IF;
      PERFORM public.join_challenge(ch_code,'solo');
    ELSE
      PERFORM public.join_season(s.id,'crew');
    END IF;
  END IF;
  SELECT * INTO cr FROM public.crews c WHERE c.id=cr.id AND c.code=upper(trim(_code)) AND NOT c.archived FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'crew_not_found'; END IF;
  IF public._community_restricted('crew',cr.id,uid,'ban') THEN RAISE EXCEPTION 'crew_moderation_ban'; END IF;
  IF public._community_restricted('event',cr.season_id,uid,'ban') THEN RAISE EXCEPTION 'event_moderation_ban'; END IF;
  IF EXISTS(SELECT 1 FROM public.crew_members WHERE crew_id=cr.id AND user_id=uid) THEN RETURN cr.id; END IF;
  IF EXISTS(SELECT 1 FROM public.crew_members m JOIN public.crews c ON c.id=m.crew_id
    WHERE m.user_id=uid AND c.season_id=cr.season_id AND c.kind<>'duo') THEN RAISE EXCEPTION 'already_in_crew'; END IF;
  IF (SELECT count(*) FROM public.crew_members WHERE crew_id=cr.id)>=cr.max_members THEN RAISE EXCEPTION 'crew_full'; END IF;
  INSERT INTO public.crew_members(crew_id,user_id,role) VALUES(cr.id,uid,'member');
  UPDATE public.season_entries e SET mode='crew' WHERE e.season_id=s.id AND e.user_id=uid AND e.status='active';
  RETURN cr.id;
END $$;

-- Keep removed players in history with the statistics captured at removal.
CREATE OR REPLACE FUNCTION public.active_season() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN (SELECT to_jsonb(s) FROM public.season_entries e JOIN public.seasons s ON s.id=e.season_id
    WHERE e.user_id=auth.uid() AND e.status='active' ORDER BY e.joined_at DESC LIMIT 1);
END $$;

CREATE OR REPLACE FUNCTION public.my_challenge_history() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); res jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT coalesce(jsonb_agg(row ORDER BY active DESC,started DESC),'[]'::jsonb) INTO res FROM (
    SELECT jsonb_build_object('season_id',s.id,'challenge_id',c.id,'name',coalesce(c.name,s.name->>'en'),'kind',e.kind,'status',e.status,'creator',cp.handle,
      'start_date',s.starts_on,'end_date',s.ends_on,'length',s.ends_on-s.starts_on+1,'joined_at',e.joined_at,'ended_at',e.ended_at,'end_reason',e.end_reason,
      'completed_days',coalesce(sr.completed_days,(SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=s.id AND ds.completion>=0.6 AND ds.day>=greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND ds.day<=least(s.ends_on,public._local_today(uid)))),
      'perfect_days',coalesce(sr.perfect_days,(SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=s.id AND ds.completion=1 AND ds.day>=greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND ds.day<=least(s.ends_on,public._local_today(uid)))),
      'consistency',coalesce(sr.consistency_percent,round(100.0*(SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=s.id AND ds.completion>=0.6 AND ds.day>=greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND ds.day<=least(s.ends_on,public._local_today(uid)))/greatest(1,least(s.ends_on,public._local_today(uid))-greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date)+1),1)),
      'points',coalesce((SELECT score FROM public.season_results sr WHERE sr.user_id=uid AND sr.season_id=s.id),(SELECT sum(ds.total) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=s.id),0),
      'rank',coalesce((SELECT rank_challenge FROM public.season_results sr WHERE sr.user_id=uid AND sr.season_id=s.id),(SELECT rank_country FROM public.season_results sr WHERE sr.user_id=uid AND sr.season_id=s.id)),
      'crew',(SELECT jsonb_build_object('id',cr.id,'name',cr.name,'code',cr.code) FROM public.crew_members cm JOIN public.crews cr ON cr.id=cm.crew_id WHERE cm.user_id=uid AND cr.season_id=s.id LIMIT 1),
      'habits',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',ch.habit_key,'name',ch.name,'what_counts',ch.what_counts,'kind',ch.kind,'target',ch.target,'unit',ch.unit,'is_faith',ch.is_faith) ORDER BY ch.position),'[]'::jsonb) FROM public.challenge_habits ch WHERE ch.season_id=s.id),
      'trail',(SELECT coalesce(jsonb_agg(jsonb_build_object('day',ds.day,'completion',ds.completion,'points',ds.total,'perfect',ds.perfect,'finalized',ds.finalized_at IS NOT NULL) ORDER BY ds.day),'[]'::jsonb) FROM public.daily_scores ds WHERE ds.user_id=uid AND ds.season_id=s.id),
      'active',e.status='active','started',e.joined_at) row,e.status='active' active,e.joined_at started
    FROM public.season_entries e LEFT JOIN public.season_results sr ON sr.user_id=e.user_id AND sr.season_id=e.season_id JOIN public.seasons s ON s.id=e.season_id JOIN public.profiles p ON p.id=uid LEFT JOIN public.challenges c ON c.season_id=s.id LEFT JOIN public.profiles cp ON cp.id=c.owner_id
    WHERE e.user_id=uid
  ) history;
  RETURN res;
END $$;
