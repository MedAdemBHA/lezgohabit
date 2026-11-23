import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { localDate } from "./time";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Season = Database["public"]["Tables"]["seasons"]["Row"];
export type Template = Database["public"]["Tables"]["habit_templates"]["Row"];
export type UserHabit = Database["public"]["Tables"]["user_habits"]["Row"] & { template: Template | null };
export type Checkin = Database["public"]["Tables"]["checkins"]["Row"];
export type DayExtras = Database["public"]["Tables"]["day_extras"]["Row"];
export type HabitPoints = { id: string; share: number; earned: number };
export type DailyScore = Database["public"]["Tables"]["daily_scores"]["Row"];
export type { Json };

export function useUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return user;
}

export const profileQuery = (uid: string) => queryOptions({
  queryKey: ["profile", uid],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (error) throw error;
    return data;
  },
});

export const seasonQuery = queryOptions({
  queryKey: ["season", "live"],
  queryFn: async () => {
    const { data, error } = await supabase.from("seasons").select("*").eq("status", "live").eq("challenge_owned", false).order("starts_on").limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60_000,
});

export const activeSeasonQuery = (uid:string) => queryOptions({queryKey:['activeSeason',uid],queryFn:async()=>{const {data,error}=await supabase.rpc('active_season');if(error)throw error;return data as unknown as Season|null;}});

export const templatesQuery = queryOptions({
  queryKey: ["templates"],
  queryFn: async () => {
    const { data, error } = await supabase.from("habit_templates").select("*").order("sort");
    if (error) throw error;
    return data;
  },
  staleTime: 30 * 60_000,
});

export const habitsQuery = (uid: string, seasonId: string) => queryOptions({
  queryKey: ["habits", uid, seasonId],
  queryFn: async () => {
    const { data, error } = await supabase.from("user_habits").select("*, template:habit_templates(*)")
      .eq("user_id", uid).eq("season_id", seasonId).eq("active", true).order("position");
    if (error) throw error;
    return data as unknown as UserHabit[];
  },
});

export const dayQuery = (uid: string, seasonId: string, day: string) => queryOptions({
  queryKey: ["day", uid, seasonId, day],
  queryFn: async () => {
    const [c, s, e, points] = await Promise.all([
      supabase.from("checkins").select("*").eq("user_id", uid).eq("day", day),
      supabase.from("daily_scores").select("*").eq("user_id", uid).eq("season_id", seasonId).eq("day", day).maybeSingle(),
      supabase.from("day_extras").select("*").eq("user_id", uid).eq("day", day).maybeSingle(),
      supabase.rpc("today_habit_points", { _season_id: seasonId, _day: day }),
    ]);
    if (c.error) throw c.error;
    if (s.error) throw s.error;
    if (e.error) throw e.error;
    if (points.error) throw points.error;
    return { checkins: c.data, score: s.data, extras: e.data, points: points.data as unknown as HabitPoints[] };
  },
});

export const scoresQuery = (uid: string, seasonId: string) => queryOptions({
  queryKey: ["scores", uid, seasonId],
  queryFn: async () => {
    const { data, error } = await supabase.from("daily_scores").select("*").eq("user_id", uid).eq("season_id", seasonId).order("day");
    if (error) throw error;
    return data;
  },
});

export const myCrewQuery = (uid: string, seasonId: string) => queryOptions({
  queryKey: ["myCrew", uid, seasonId],
  queryFn: async () => {
    const { data, error } = await supabase.from("crew_members").select("crew_id, crews!inner(id, season_id, name, code)")
      .eq("user_id", uid).eq("crews.season_id", seasonId).limit(1).maybeSingle();
    if (error) throw error;
    return data?.crew_id ?? null;
  },
});

/** Everything a signed-in screen needs: user, profile, season, local today. */
export function useBase() {
  const user = useUser();
  const uid = user?.id ?? "";
  const profile = useQuery({ ...profileQuery(uid), enabled: !!uid });
  const season = useQuery({ ...activeSeasonQuery(uid), enabled: !!uid });
  const tz = profile.data?.timezone ?? "Africa/Tunis";
  const today = localDate(tz);
  return { user, uid, profile: profile.data, season: season.data, tz, today, loading: user === undefined || profile.isLoading || season.isLoading };
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function errKey(e: unknown): string {
  const m = (e as { message?: string })?.message ?? "";
  for (const k of ["crew_not_found", "crew_full", "already_in_crew", "day_closed", "max_habits", "forbidden"]) if (m.includes(k)) return k;
  return "";
}
