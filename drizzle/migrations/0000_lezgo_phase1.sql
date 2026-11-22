
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  avatar_url text,
  country_code text not null default 'TN',
  city text,
  timezone text not null default 'Africa/Tunis',
  language text not null default 'en' check (language in ('en','fr','ar','aeb')),
  units text not null default 'kg' check (units in ('kg','lb')),
  show_on_public_board boolean not null default true,
  faith_public boolean not null default false,
  is_admin boolean not null default false,
  onboarded boolean not null default false,
  notif_daily boolean not null default true,
  notif_crew boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (handle, display_name, avatar_url, country_code, city, timezone, language, units, show_on_public_board, faith_public, onboarded, notif_daily, notif_crew) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by signed in" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; h text;
begin
  base := regexp_replace(lower(coalesce(split_part(new.email,'@',1),'user')), '[^a-z0-9_]', '', 'g');
  if length(base) < 3 then base := 'user' || base; end if;
  base := left(base, 14);
  h := base;
  while exists (select 1 from public.profiles where handle = h) loop
    h := base || (floor(random()*9000)+1000)::int::text;
  end loop;
  insert into public.profiles (id, handle, display_name, avatar_url)
  values (new.id, h,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1), ''),
    new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- SEASONS
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name jsonb not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'upcoming' check (status in ('upcoming','live','ended')),
  theme_color text not null default '#C8F560'
);
grant select on public.seasons to anon, authenticated;
grant all on public.seasons to service_role;
alter table public.seasons enable row level security;
create policy "seasons public" on public.seasons for select to anon, authenticated using (true);

-- HABIT TEMPLATES
create table public.habit_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  category text not null,
  name jsonb not null,
  description jsonb not null,
  icon text not null,
  kind text not null check (kind in ('check','count','salat','lift','detox')),
  default_target numeric not null default 1,
  unit text,
  is_faith boolean not null default false,
  sort int not null default 0
);
grant select on public.habit_templates to anon, authenticated;
grant all on public.habit_templates to service_role;
alter table public.habit_templates enable row level security;
create policy "templates public" on public.habit_templates for select to anon, authenticated using (true);

-- USER HABITS
create table public.user_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  template_id uuid references public.habit_templates(id),
  custom_name text,
  kind text not null check (kind in ('check','count','salat','lift','detox')),
  target numeric not null default 1 check (target > 0),
  unit text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.user_habits(user_id, season_id);
grant select, insert, update, delete on public.user_habits to authenticated;
grant all on public.user_habits to service_role;
alter table public.user_habits enable row level security;
create policy "own habits select" on public.user_habits for select to authenticated using (user_id = auth.uid());
create policy "own habits insert" on public.user_habits for insert to authenticated with check (user_id = auth.uid());
create policy "own habits update" on public.user_habits for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own habits delete" on public.user_habits for delete to authenticated using (user_id = auth.uid());

create or replace function public.validate_user_habit() returns trigger language plpgsql set search_path = public as $$
begin
  if new.active and (select count(*) from public.user_habits
      where user_id = new.user_id and season_id = new.season_id and active and id <> new.id) >= 3 then
    raise exception 'max_habits';
  end if;
  if new.custom_name is not null and length(new.custom_name) > 40 then raise exception 'name_too_long'; end if;
  return new;
end $$;
create trigger user_habits_validate before insert or update on public.user_habits for each row execute function public.validate_user_habit();

-- CHECKINS
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_habit_id uuid not null references public.user_habits(id) on delete cascade,
  day date not null,
  value numeric not null default 0,
  detail jsonb,
  created_at timestamptz not null default now(),
  unique (user_habit_id, day)
);
create index on public.checkins(user_id, day);
grant select on public.checkins to authenticated;
grant all on public.checkins to service_role;
alter table public.checkins enable row level security;
create policy "own checkins" on public.checkins for select to authenticated using (user_id = auth.uid());

-- DAY EXTRAS (chaos, proof, lift PRs)
create table public.day_extras (
  user_id uuid not null,
  day date not null,
  chaos_done boolean not null default false,
  proof_posted boolean not null default false,
  lift_prs int not null default 0,
  primary key (user_id, day)
);
grant select on public.day_extras to authenticated;
grant all on public.day_extras to service_role;
alter table public.day_extras enable row level security;
create policy "own extras" on public.day_extras for select to authenticated using (user_id = auth.uid());

-- DAILY SCORES
create table public.daily_scores (
  user_id uuid not null,
  season_id uuid not null references public.seasons(id) on delete cascade,
  day date not null,
  habit_points numeric not null default 0,
  stack_points numeric not null default 0,
  multiplier numeric not null default 1,
  total int not null default 0,
  completion numeric not null default 0,
  perfect boolean not null default false,
  streak int not null default 0,
  shield_used boolean not null default false,
  comeback boolean not null default false,
  crew_sync boolean not null default false,
  unique (user_id, season_id, day)
);
create index on public.daily_scores(season_id, day);
grant select on public.daily_scores to authenticated;
grant all on public.daily_scores to service_role;
alter table public.daily_scores enable row level security;
create policy "scores readable" on public.daily_scores for select to authenticated using (true);

-- SEASON ENTRIES
create table public.season_entries (
  user_id uuid not null,
  season_id uuid not null references public.seasons(id) on delete cascade,
  mode text not null default 'solo' check (mode in ('solo','crew','creator')),
  joined_at timestamptz not null default now(),
  comeback_used boolean not null default false,
  primary key (user_id, season_id)
);
grant select on public.season_entries to authenticated;
grant all on public.season_entries to service_role;
alter table public.season_entries enable row level security;
create policy "entries readable" on public.season_entries for select to authenticated using (true);

-- CREWS
create table public.crews (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  code text unique not null check (code ~ '^[A-Z0-9]{6}$'),
  owner_id uuid not null,
  kind text not null default 'squad' check (kind in ('duo','squad','club','company','creator')),
  max_members int not null default 8 check (max_members between 2 and 50),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.crews to authenticated;
grant all on public.crews to service_role;
alter table public.crews enable row level security;
create policy "crews readable" on public.crews for select to authenticated using (true);

create table public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index on public.crew_members(user_id);
grant select on public.crew_members to authenticated;
grant all on public.crew_members to service_role;
alter table public.crew_members enable row level security;
create policy "members readable" on public.crew_members for select to authenticated using (true);

create table public.nudges (
  from_user uuid not null,
  to_user uuid not null,
  crew_id uuid not null references public.crews(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  unique (from_user, to_user, day)
);
grant select on public.nudges to authenticated;
grant all on public.nudges to service_role;
alter table public.nudges enable row level security;
create policy "own nudges" on public.nudges for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());

create table public.respects (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id)
);
grant select on public.respects to authenticated;
grant all on public.respects to service_role;
alter table public.respects enable row level security;
create policy "own respects" on public.respects for select to authenticated using (user_id = auth.uid());

-- HELPERS
create or replace function public._habit_completion(_kind text, _target numeric, _value numeric, _detail jsonb)
returns numeric language sql immutable set search_path = public as $$
  select case
    when _kind = 'salat' then least(1, coalesce((
        select sum(case e.v when 'on_time' then 1 when 'late' then 0.5 else 0 end)
        from jsonb_each_text(coalesce(_detail->'prayers', '{}'::jsonb)) as e(k, v)), 0) / 5.0)
    when _kind = 'count' then least(1, greatest(0, coalesce(_value, 0) / nullif(_target, 0)))
    else case when coalesce(_value, 0) > 0 then 1 else 0 end
  end
$$;

create or replace function public._local_today(_user_id uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = _user_id), 'Africa/Tunis'))::date
$$;

create or replace function public._check_day_window(_user_id uuid, _day date) returns void
language plpgsql stable security definer set search_path = public as $$
declare tz text; local_ts timestamp;
begin
  select coalesce(timezone, 'Africa/Tunis') into tz from public.profiles where id = _user_id;
  local_ts := now() at time zone coalesce(tz, 'Africa/Tunis');
  if _day = local_ts::date then return; end if;
  if _day = local_ts::date - 1 and local_ts::time < time '03:00' then return; end if;
  raise exception 'day_closed';
end $$;

-- SCORING
create or replace function public.recompute_day(_user_id uuid, _season_id uuid, _day date)
returns void language plpgsql security definer set search_path = public as $$
declare
  s record; tz text; today date; start_d date; end_d date; d date;
  n int; comp numeric; allfull boolean; hp numeric; st numeric; mult numeric; tot int;
  v_streak int := 0; prev_missed boolean := false; v_cb_used boolean := false;
  shield_weeks date[] := '{}'; wk date; v_shield boolean; v_cb boolean; v_perfect boolean;
  v_crew uuid; v_sync boolean; ex record; joined timestamptz;
begin
  select * into s from public.seasons where id = _season_id;
  if not found then return; end if;
  select joined_at into joined from public.season_entries where user_id = _user_id and season_id = _season_id;
  if joined is null then return; end if;
  select coalesce(timezone, 'Africa/Tunis') into tz from public.profiles where id = _user_id;
  tz := coalesce(tz, 'Africa/Tunis');
  today := (now() at time zone tz)::date;
  start_d := greatest(s.starts_on, (joined at time zone tz)::date);
  end_d := least(s.ends_on, today);
  select count(*) into n from public.user_habits where user_id = _user_id and season_id = _season_id and active;
  select cm.crew_id into v_crew from public.crew_members cm join public.crews c on c.id = cm.crew_id
    where cm.user_id = _user_id and c.season_id = _season_id limit 1;

  d := start_d;
  while d <= end_d loop
    if n = 0 then comp := 0; allfull := false;
    else
      select coalesce(avg(x.c), 0), coalesce(bool_and(x.c >= 1), false) into comp, allfull from (
        select public._habit_completion(h.kind, h.target, ci.value, ci.detail) as c
        from public.user_habits h
        left join public.checkins ci on ci.user_habit_id = h.id and ci.day = d
        where h.user_id = _user_id and h.season_id = _season_id and h.active) x;
    end if;
    v_perfect := n > 0 and allfull;
    v_shield := false; v_cb := false;

    if comp >= 0.6 then
      v_streak := v_streak + 1;
    elsif d <> today then
      wk := date_trunc('week', d)::date;
      if v_streak > 0 and not (wk = any(shield_weeks)) then
        v_shield := true; shield_weeks := shield_weeks || wk;
      else
        v_streak := 0;
      end if;
    end if;

    hp := 100 * comp;
    if prev_missed and not v_cb_used and comp > 0 then
      v_cb := true; v_cb_used := true; hp := least(200, hp * 2);
    end if;

    st := 0;
    if v_perfect then st := st + 20; end if;
    select * into ex from public.day_extras where user_id = _user_id and day = d;
    if coalesce(ex.proof_posted, false) then st := st + 10; end if;
    if coalesce(ex.chaos_done, false) then st := st + 10; end if;
    st := st + least(coalesce(ex.lift_prs, 0) * 5, 15);
    v_sync := false;
    if v_crew is not null and v_perfect
       and (select count(*) from public.crew_members where crew_id = v_crew) >= 2
       and not exists (
         select 1 from public.crew_members m where m.crew_id = v_crew and m.user_id <> _user_id
         and not exists (select 1 from public.daily_scores ds where ds.user_id = m.user_id
                         and ds.season_id = _season_id and ds.day = d and ds.perfect)) then
      v_sync := true; st := st + 10;
    end if;

    mult := least(1 + 0.05 * v_streak, 1.5);
    tot := floor((hp + st) * mult);

    insert into public.daily_scores (user_id, season_id, day, habit_points, stack_points, multiplier, total,
      completion, perfect, streak, shield_used, comeback, crew_sync)
    values (_user_id, _season_id, d, round(hp, 2), st, mult, tot, round(comp, 4), v_perfect, v_streak, v_shield, v_cb, v_sync)
    on conflict (user_id, season_id, day) do update set habit_points = excluded.habit_points,
      stack_points = excluded.stack_points, multiplier = excluded.multiplier, total = excluded.total,
      completion = excluded.completion, perfect = excluded.perfect, streak = excluded.streak,
      shield_used = excluded.shield_used, comeback = excluded.comeback, crew_sync = excluded.crew_sync;

    prev_missed := comp < 0.6 and not v_shield and d <> today;
    d := d + 1;
  end loop;
  update public.season_entries set comeback_used = v_cb_used where user_id = _user_id and season_id = _season_id;
end $$;
revoke execute on function public.recompute_day(uuid, uuid, date) from public, anon, authenticated;

create or replace function public._recompute_with_crew(_user_id uuid, _season_id uuid, _day date)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  perform public.recompute_day(_user_id, _season_id, _day);
  for m in select cm.user_id from public.crew_members cm join public.crews c on c.id = cm.crew_id
           where c.season_id = _season_id and cm.user_id <> _user_id
             and cm.crew_id in (select crew_id from public.crew_members where user_id = _user_id) loop
    perform public.recompute_day(m.user_id, _season_id, _day);
  end loop;
end $$;
revoke execute on function public._recompute_with_crew(uuid, uuid, date) from public, anon, authenticated;

-- RPCs
create or replace function public.checkin_upsert(_user_habit_id uuid, _value numeric, _detail jsonb default null, _day date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); h record; d date; r jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into h from public.user_habits where id = _user_habit_id and user_id = uid;
  if not found then raise exception 'habit_not_found'; end if;
  d := coalesce(_day, public._local_today(uid));
  perform public._check_day_window(uid, d);
  if _value is null or _value < 0 or _value > 1000000 then raise exception 'bad_value'; end if;
  insert into public.checkins (user_id, user_habit_id, day, value, detail)
  values (uid, _user_habit_id, d, _value, _detail)
  on conflict (user_habit_id, day) do update set value = excluded.value, detail = excluded.detail, created_at = now();
  perform public._recompute_with_crew(uid, h.season_id, d);
  select to_jsonb(ds) into r from public.daily_scores ds where user_id = uid and season_id = h.season_id and day = d;
  return r;
end $$;

create or replace function public.set_chaos_done(_season_id uuid, _done boolean, _day date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date; r jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  d := coalesce(_day, public._local_today(uid));
  perform public._check_day_window(uid, d);
  insert into public.day_extras (user_id, day, chaos_done) values (uid, d, _done)
  on conflict (user_id, day) do update set chaos_done = excluded.chaos_done;
  perform public.recompute_day(uid, _season_id, d);
  select to_jsonb(ds) into r from public.daily_scores ds where user_id = uid and season_id = _season_id and day = d;
  return r;
end $$;

create or replace function public.join_season(_season_id uuid, _mode text default 'solo')
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if _mode not in ('solo','crew','creator') then raise exception 'bad_mode'; end if;
  insert into public.season_entries (user_id, season_id, mode) values (uid, _season_id, _mode)
  on conflict (user_id, season_id) do update set mode = excluded.mode;
end $$;

create or replace function public.create_crew(_name text, _kind text, _max_members int)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sid uuid; v_code text; cid uuid;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select id into sid from public.seasons where status = 'live' order by starts_on limit 1;
  if sid is null then raise exception 'no_live_season'; end if;
  if exists (select 1 from public.crew_members cm join public.crews c on c.id = cm.crew_id where cm.user_id = uid and c.season_id = sid) then
    raise exception 'already_in_crew';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from public.crews where code = v_code);
  end loop;
  insert into public.crews (season_id, name, code, owner_id, kind, max_members)
  values (sid, trim(_name), v_code, uid, _kind, greatest(2, least(50, _max_members))) returning id into cid;
  insert into public.crew_members (crew_id, user_id, role) values (cid, uid, 'owner');
  insert into public.season_entries (user_id, season_id, mode) values (uid, sid, 'crew')
  on conflict (user_id, season_id) do update set mode = 'crew';
  return v_code;
end $$;

create or replace function public.join_crew(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into c from public.crews where code = upper(trim(_code));
  if not found then raise exception 'crew_not_found'; end if;
  if exists (select 1 from public.crew_members where crew_id = c.id and user_id = uid) then return c.id; end if;
  if exists (select 1 from public.crew_members cm join public.crews x on x.id = cm.crew_id where cm.user_id = uid and x.season_id = c.season_id) then
    raise exception 'already_in_crew';
  end if;
  if (select count(*) from public.crew_members where crew_id = c.id) >= c.max_members then raise exception 'crew_full'; end if;
  insert into public.crew_members (crew_id, user_id) values (c.id, uid);
  insert into public.season_entries (user_id, season_id, mode) values (uid, c.season_id, 'crew')
  on conflict (user_id, season_id) do update set mode = 'crew';
  return c.id;
end $$;

create or replace function public.send_nudge(_to_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; n int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select a.crew_id into cid from public.crew_members a join public.crew_members b on a.crew_id = b.crew_id
    where a.user_id = uid and b.user_id = _to_user limit 1;
  if cid is null or _to_user = uid then raise exception 'not_crewmate'; end if;
  insert into public.nudges (from_user, to_user, crew_id, day) values (uid, _to_user, cid, public._local_today(uid))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.leaderboard(_season_id uuid, _scope text, _period text, _country_code text default 'TN')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'Africa/Tunis')::date; from_d date; res jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  from_d := case _period when 'today' then today when 'week' then date_trunc('week', today)::date else date '1900-01-01' end;
  if _scope = 'crews' then
    with cp as (
      select c.id, c.name, c.kind, c.created_at,
        (select count(*) from public.crew_members m where m.crew_id = c.id) as members,
        coalesce((select sum(ds.total) from public.crew_members m join public.daily_scores ds
          on ds.user_id = m.user_id and ds.season_id = _season_id and ds.day >= from_d where m.crew_id = c.id), 0) as pts,
        exists (select 1 from public.crew_members m where m.crew_id = c.id and m.user_id = uid) as mine
      from public.crews c where c.season_id = _season_id
    ), ranked as (select *, row_number() over (order by pts desc, created_at asc) as rnk from cp)
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(jsonb_build_object('rank', rnk, 'crew_id', id, 'display_name', name, 'kind', kind,
          'members', members, 'points', pts, 'streak', 0, 'is_me', mine) order by rnk) from ranked where rnk <= 100), '[]'::jsonb),
      'me', (select jsonb_build_object('rank', rnk, 'crew_id', id, 'display_name', name, 'kind', kind, 'members', members,
          'points', pts, 'streak', 0, 'is_me', true) from ranked where mine limit 1)) into res;
  else
    with base as (
      select se.user_id, se.joined_at, p.display_name, p.handle, p.avatar_url, p.country_code,
        coalesce((select sum(total) from public.daily_scores ds where ds.user_id = se.user_id and ds.season_id = _season_id and ds.day >= from_d), 0) as pts,
        coalesce((select streak from public.daily_scores ds where ds.user_id = se.user_id and ds.season_id = _season_id order by day desc limit 1), 0) as streak
      from public.season_entries se join public.profiles p on p.id = se.user_id
      where se.season_id = _season_id
        and (_scope <> 'country' or p.country_code = _country_code)
        and (p.show_on_public_board or se.user_id = uid)
    ), ranked as (select *, row_number() over (order by pts desc, streak desc, joined_at asc) as rnk from base)
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(jsonb_build_object('rank', rnk, 'user_id', user_id, 'display_name', display_name,
          'handle', handle, 'avatar_url', avatar_url, 'country_code', country_code, 'streak', streak, 'points', pts,
          'is_me', user_id = uid) order by rnk) from ranked where rnk <= 100), '[]'::jsonb),
      'me', (select jsonb_build_object('rank', rnk, 'user_id', user_id, 'display_name', display_name, 'handle', handle,
          'avatar_url', avatar_url, 'country_code', country_code, 'streak', streak, 'points', pts, 'is_me', true)
          from ranked where user_id = uid)) into res;
  end if;
  return res;
end $$;

create or replace function public.crew_today(_crew_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); cr record; members jsonb; week jsonb; rnk int; today date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.crew_members where crew_id = _crew_id and user_id = uid) then raise exception 'not_member'; end if;
  select * into cr from public.crews where id = _crew_id;
  today := public._local_today(uid);

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', p.id, 'display_name', p.display_name, 'handle', p.handle, 'avatar_url', p.avatar_url,
    'total', hc.total, 'done', hc.done, 'missing', hc.missing,
    'points', coalesce(ds.total, 0), 'perfect', coalesce(ds.perfect, false),
    'nudged', exists (select 1 from public.nudges nu where nu.from_user = uid and nu.to_user = p.id and nu.day = today)
  ) order by m.joined_at), '[]'::jsonb) into members
  from public.crew_members m
  join public.profiles p on p.id = m.user_id
  left join lateral (
    select count(*) as total, count(*) filter (where h.c >= 1) as done,
      coalesce(jsonb_agg(case when h.is_faith and not p.faith_public and p.id <> uid
        then jsonb_build_object('private', true) else jsonb_build_object('name', h.nm) end) filter (where h.c < 1), '[]'::jsonb) as missing
    from (
      select coalesce(ht.is_faith, false) as is_faith,
        case when uh.custom_name is not null then jsonb_build_object('en', uh.custom_name) else ht.name end as nm,
        public._habit_completion(uh.kind, uh.target, ci.value, ci.detail) as c
      from public.user_habits uh
      left join public.habit_templates ht on ht.id = uh.template_id
      left join public.checkins ci on ci.user_habit_id = uh.id and ci.day = (now() at time zone p.timezone)::date
      where uh.user_id = p.id and uh.season_id = cr.season_id and uh.active
    ) h
  ) hc on true
  left join public.daily_scores ds on ds.user_id = p.id and ds.season_id = cr.season_id and ds.day = (now() at time zone p.timezone)::date
  where m.crew_id = _crew_id;

  select jsonb_agg(
    not exists (select 1 from public.crew_members m where m.crew_id = _crew_id and not exists (
      select 1 from public.daily_scores ds where ds.user_id = m.user_id and ds.season_id = cr.season_id and ds.day = g::date and ds.perfect))
    order by g) into week
  from generate_series(date_trunc('week', today), date_trunc('week', today) + interval '6 days', interval '1 day') g;

  select x.rnk into rnk from (
    select c.id, row_number() over (order by coalesce((select sum(ds.total) from public.crew_members m join public.daily_scores ds
      on ds.user_id = m.user_id and ds.season_id = c.season_id where m.crew_id = c.id), 0) desc, c.created_at) as rnk
    from public.crews c where c.season_id = cr.season_id) x where x.id = _crew_id;

  return jsonb_build_object('crew', jsonb_build_object('id', cr.id, 'name', cr.name, 'code', cr.code, 'kind', cr.kind,
    'max_members', cr.max_members, 'rank', rnk, 'season_id', cr.season_id), 'members', members, 'week', week, 'today', today);
end $$;

create or replace function public.crew_activity(_crew_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); res jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.crew_members where crew_id = _crew_id and user_id = uid) then raise exception 'not_member'; end if;
  select coalesce(jsonb_agg(row_to_json(a) order by a.created_at desc), '[]'::jsonb) into res from (
    select ci.id, ci.created_at, p.id as user_id, p.display_name, p.avatar_url,
      case when coalesce(ht.is_faith, false) and not p.faith_public and p.id <> uid then null
           when uh.custom_name is not null then jsonb_build_object('en', uh.custom_name) else ht.name end as habit,
      (select count(*) from public.respects r where r.checkin_id = ci.id) as respects,
      exists (select 1 from public.respects r where r.checkin_id = ci.id and r.user_id = uid) as respected
    from public.checkins ci
    join public.crew_members m on m.user_id = ci.user_id and m.crew_id = _crew_id
    join public.profiles p on p.id = ci.user_id
    join public.user_habits uh on uh.id = ci.user_habit_id
    left join public.habit_templates ht on ht.id = uh.template_id
    where ci.value > 0 and ci.created_at > now() - interval '3 days'
    order by ci.created_at desc limit 30) a;
  return res;
end $$;

create or replace function public.toggle_respect(_checkin_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); owner uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select user_id into owner from public.checkins where id = _checkin_id;
  if owner is null or not exists (select 1 from public.crew_members a join public.crew_members b on a.crew_id = b.crew_id
    where a.user_id = uid and b.user_id = owner) then raise exception 'not_crewmate'; end if;
  if exists (select 1 from public.respects where checkin_id = _checkin_id and user_id = uid) then
    delete from public.respects where checkin_id = _checkin_id and user_id = uid; return false;
  end if;
  insert into public.respects (checkin_id, user_id) values (_checkin_id, uid); return true;
end $$;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Africa/Tunis')::date;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'active_today', (select count(distinct user_id) from public.checkins where day = today),
    'checkins_today', (select count(*) from public.checkins where day = today and value > 0),
    'crews', (select count(*) from public.crews),
    'seasons', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'starts_on', s.starts_on,
       'ends_on', s.ends_on, 'status', s.status,
       'entries', (select count(*) from public.season_entries e where e.season_id = s.id)) order by s.starts_on), '[]'::jsonb) from public.seasons s));
end $$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  delete from public.respects where user_id = uid;
  delete from public.nudges where from_user = uid or to_user = uid;
  delete from public.crew_members where user_id = uid;
  delete from public.daily_scores where user_id = uid;
  delete from public.day_extras where user_id = uid;
  delete from public.checkins where user_id = uid;
  delete from public.user_habits where user_id = uid;
  delete from public.season_entries where user_id = uid;
  delete from auth.users where id = uid;
end $$;

revoke execute on function public.checkin_upsert(uuid, numeric, jsonb, date) from public, anon;
revoke execute on function public.set_chaos_done(uuid, boolean, date) from public, anon;
revoke execute on function public.join_season(uuid, text) from public, anon;
revoke execute on function public.create_crew(text, text, int) from public, anon;
revoke execute on function public.join_crew(text) from public, anon;
revoke execute on function public.send_nudge(uuid) from public, anon;
revoke execute on function public.leaderboard(uuid, text, text, text) from public, anon;
revoke execute on function public.crew_today(uuid) from public, anon;
revoke execute on function public.crew_activity(uuid) from public, anon;
revoke execute on function public.toggle_respect(uuid) from public, anon;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.checkin_upsert(uuid, numeric, jsonb, date), public.set_chaos_done(uuid, boolean, date),
  public.join_season(uuid, text), public.create_crew(text, text, int), public.join_crew(text), public.send_nudge(uuid),
  public.leaderboard(uuid, text, text, text), public.crew_today(uuid), public.crew_activity(uuid), public.toggle_respect(uuid),
  public.admin_overview(), public.delete_my_account() to authenticated;

-- SEED
insert into public.seasons (slug, name, starts_on, ends_on, status, theme_color) values
('winter-arc-2026', '{"en":"Winter Arc","fr":"Winter Arc","ar":"قوس الشتاء","aeb":"وينتر آرك"}', '2026-11-22', '2026-12-31', 'live', '#7FB2FF');

insert into public.habit_templates (key, category, name, description, icon, kind, default_target, unit, is_faith, sort) values
('train','body','{"en":"Train","fr":"Entraînement","ar":"تمرين","aeb":"تمرين"}','{"en":"Any workout counts","fr":"Toute séance compte","ar":"أي تمرين يُحسب","aeb":"أي تمرين يتحسب"}','dumbbell','check',1,null,false,1),
('steps','body','{"en":"Steps 8k","fr":"8k pas","ar":"8 آلاف خطوة","aeb":"8 آلاف خطوة"}','{"en":"Walk 8,000 steps","fr":"Marche 8 000 pas","ar":"امشِ 8000 خطوة","aeb":"امشي 8000 خطوة"}','footprints','count',8000,'steps',false,2),
('read','mind','{"en":"Read 10 pages","fr":"Lire 10 pages","ar":"قراءة 10 صفحات","aeb":"اقرا 10 صفحات"}','{"en":"Any book, 10 pages","fr":"N''importe quel livre","ar":"أي كتاب، 10 صفحات","aeb":"أي كتاب، 10 صفحات برك"}','book','count',10,'pages',false,3),
('sleep','body','{"en":"Sleep before midnight","fr":"Dormir avant minuit","ar":"النوم قبل منتصف الليل","aeb":"ارقد قبل نص الليل"}','{"en":"Lights out before 00:00","fr":"Au lit avant 00:00","ar":"في السرير قبل 00:00","aeb":"في الفرش قبل 00:00"}','moon','check',1,null,false,4),
('water','body','{"en":"Water 2L","fr":"Eau 2L","ar":"ماء 2 لتر","aeb":"ماء 2 لتر"}','{"en":"Drink 2 liters","fr":"Bois 2 litres","ar":"اشرب لترين","aeb":"اشرب زوز لترات"}','droplet','count',2,'L',false,5),
('coffee','body','{"en":"No-sugar coffee","fr":"Café sans sucre","ar":"قهوة بلا سكر","aeb":"قهوة بلاش سكر"}','{"en":"Skip the sugar today","fr":"Pas de sucre aujourd''hui","ar":"بدون سكر اليوم","aeb":"اليوم بلاش سكر"}','coffee','check',1,null,false,6),
('detox','mind','{"en":"Scroll detox","fr":"Détox écran","ar":"ديتوكس التصفح","aeb":"ديتوكس سكرول"}','{"en":"Under 1h of social media","fr":"Moins d''1h de réseaux","ar":"أقل من ساعة تواصل اجتماعي","aeb":"أقل من ساعة سوشيال"}','phone-off','detox',1,null,false,7),
('learn','mind','{"en":"Learn 20 min","fr":"Apprendre 20 min","ar":"تعلّم 20 دقيقة","aeb":"اتعلم 20 دقيقة"}','{"en":"Learn something new","fr":"Apprends un truc","ar":"تعلّم شيئاً جديداً","aeb":"اتعلم حاجة جديدة"}','lightbulb','count',20,'min',false,8),
('salat','faith','{"en":"Salat on time","fr":"Salat à l''heure","ar":"الصلاة في وقتها","aeb":"الصلاة في وقتها"}','{"en":"5 prayers on time","fr":"5 prières à l''heure","ar":"الصلوات الخمس في وقتها","aeb":"الخمسة صلوات في وقتهم"}','moon-star','salat',5,'prayers',true,20),
('quran','faith','{"en":"Quran 1 page","fr":"Coran 1 page","ar":"صفحة من القرآن","aeb":"صفحة قرآن"}','{"en":"Read at least one page","fr":"Lis au moins une page","ar":"اقرأ صفحة على الأقل","aeb":"اقرا صفحة على الأقل"}','book-open','check',1,null,true,21),
('dhikr','faith','{"en":"Morning/evening dhikr","fr":"Dhikr matin/soir","ar":"أذكار الصباح والمساء","aeb":"أذكار الصباح والعشية"}','{"en":"Morning or evening adhkar","fr":"Adhkar du matin ou du soir","ar":"أذكار الصباح أو المساء","aeb":"أذكار الصباح ولا العشية"}','sparkles','check',1,null,true,22),
('custom','custom','{"en":"Custom","fr":"Perso","ar":"عادة خاصة","aeb":"عادة متاعك"}','{"en":"Make your own","fr":"Crée la tienne","ar":"أنشئ عادتك","aeb":"اعمل عادتك"}','plus','check',1,null,false,99);
