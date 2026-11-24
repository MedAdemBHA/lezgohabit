-- Freeze consistency against each participant's local elapsed days, including
-- missed days, from max(challenge start, local join date) through challenge end.
CREATE OR REPLACE FUNCTION public._freeze_season(_sid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.seasons; r record;
BEGIN
  SELECT * INTO s FROM public.seasons WHERE id=_sid FOR UPDATE;
  IF NOT FOUND OR s.frozen_at IS NOT NULL THEN RETURN; END IF;
  FOR r IN SELECT e.user_id FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.season_id=_sid LOOP
    PERFORM public._finalize_user_day(r.user_id,_sid,s.ends_on);
  END LOOP;
  UPDATE public.season_entries SET status='completed',ended_at=coalesce(ended_at,now()),end_reason='challenge_ended' WHERE season_id=_sid AND status='active';
  INSERT INTO public.season_results(user_id,season_id,score,daily_points,boss_points,rank_country,rank_world,rank_crew,rank_challenge,crew_id,perfect_days,best_streak,active_days,completed_days,consistency_percent,trophy,trophy_private,participation_kind,participation_status,is_demo)
  WITH base AS (
    SELECT e.user_id,e.kind,e.status,p.country_code,p.is_demo,e.joined_at,coalesce(p.timezone,'Africa/Tunis') timezone,
      coalesce((SELECT sum(total) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid AND ds.day BETWEEN s.starts_on AND s.ends_on),0)::int daily,
      coalesce((SELECT sum(points) FROM public.bonus_points bp WHERE bp.user_id=e.user_id AND bp.season_id=_sid),0)::int boss,
      (SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid AND ds.perfect AND ds.day BETWEEN greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND s.ends_on)::int perfect,
      coalesce((SELECT max(streak) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid),0)::int best,
      (SELECT count(*) FROM public.daily_scores ds WHERE ds.user_id=e.user_id AND ds.season_id=_sid AND ds.completion>=0.6 AND ds.day BETWEEN greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date) AND s.ends_on)::int active,
      (SELECT cm.crew_id FROM public.crew_members cm JOIN public.crews c ON c.id=cm.crew_id WHERE cm.user_id=e.user_id AND c.season_id=_sid LIMIT 1) crew,
      greatest(1,s.ends_on-greatest(s.starts_on,(e.joined_at AT TIME ZONE coalesce(p.timezone,'Africa/Tunis'))::date)+1)::int elapsed
    FROM public.season_entries e JOIN public.profiles p ON p.id=e.user_id WHERE e.season_id=_sid AND p.account_status='active'
  ), ranked AS (
    SELECT b.*,row_number() OVER(PARTITION BY is_demo,country_code ORDER BY CASE WHEN kind='official' THEN 0 ELSE 1 END,daily+boss DESC,best DESC,joined_at,user_id) country_rank,
      row_number() OVER(PARTITION BY is_demo ORDER BY CASE WHEN kind='official' THEN 0 ELSE 1 END,daily+boss DESC,best DESC,joined_at,user_id) world_rank,
      row_number() OVER(PARTITION BY is_demo,kind ORDER BY daily+boss DESC,best DESC,joined_at,user_id) challenge_rank,
      CASE WHEN crew IS NOT NULL THEN row_number() OVER(PARTITION BY crew ORDER BY daily+boss DESC,best DESC,joined_at,user_id) END crew_rank
    FROM base b WHERE status<>'surrendered' AND kind<>'personal'
  )
  SELECT b.user_id,_sid,b.daily+b.boss,b.daily,b.boss,
    CASE WHEN b.kind='official' AND b.status<>'surrendered' THEN r.country_rank END,
    CASE WHEN b.kind='official' AND b.status<>'surrendered' THEN r.world_rank END,
    CASE WHEN b.kind<>'personal' AND b.status<>'surrendered' THEN r.crew_rank END,
    CASE WHEN b.kind<>'personal' AND b.status<>'surrendered' THEN r.challenge_rank END,
    b.crew,b.perfect,b.best,b.active,b.active,round(100.0*b.active/b.elapsed,1),
    b.active>=ceil((s.ends_on-s.starts_on+1)*0.75),b.kind='personal',b.kind,b.status,b.is_demo
  FROM base b LEFT JOIN ranked r ON r.user_id=b.user_id
  ON CONFLICT(user_id,season_id) DO NOTHING;
  INSERT INTO public.crew_results(crew_id,season_id,name,score,rank,members,is_demo)
  SELECT c.id,_sid,c.name,coalesce(sum(r.score),0)::int,row_number() OVER(PARTITION BY c.is_demo ORDER BY coalesce(sum(r.score),0) DESC,c.created_at,c.id),count(r.user_id)::int,c.is_demo
  FROM public.crews c LEFT JOIN public.season_results r ON r.crew_id=c.id AND r.season_id=_sid AND r.participation_status<>'surrendered'
  WHERE c.season_id=_sid AND c.kind<>'duo' GROUP BY c.id,c.name,c.is_demo,c.created_at ON CONFLICT DO NOTHING;
  INSERT INTO public.season_trophies(user_id,season_id,is_demo,is_private)
  SELECT user_id,_sid,is_demo,trophy_private FROM public.season_results WHERE season_id=_sid AND trophy ON CONFLICT DO NOTHING;
  INSERT INTO public.challenge_events(season_id,event_type,event_key,day,is_demo,payload)
  SELECT _sid,'challenge_complete','challenge-complete:'||_sid::text,s.ends_on,s.is_demo,jsonb_build_object('name',s.name)
  WHERE EXISTS(SELECT 1 FROM public.season_entries WHERE season_id=_sid) ON CONFLICT DO NOTHING;
  UPDATE public.seasons SET frozen_at=now() WHERE id=_sid;
END $$;

REVOKE ALL ON FUNCTION public._freeze_season(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._freeze_season(uuid) TO service_role;
