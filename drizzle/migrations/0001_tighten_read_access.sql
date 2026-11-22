drop policy "scores readable" on public.daily_scores;
create policy "own scores" on public.daily_scores for select to authenticated using (user_id = auth.uid());
drop policy "entries readable" on public.season_entries;
create policy "own entries" on public.season_entries for select to authenticated using (user_id = auth.uid());
drop policy "members readable" on public.crew_members;
create policy "own memberships" on public.crew_members for select to authenticated using (user_id = auth.uid());
drop policy "profiles readable by signed in" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());

create or replace function public.handle_available(_handle text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and not exists (select 1 from public.profiles where handle = lower(_handle) and id <> auth.uid())
$$;
revoke execute on function public.handle_available(text) from public, anon;
grant execute on function public.handle_available(text) to authenticated;
