import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type EventHabit = {
  key: string;
  name: Record<string, string>;
  target: number;
  unit: string | null;
  kind?: string;
  rule?: Json;
  what_counts: Record<string, string>;
};

export type EventState = "draft" | "upcoming" | "live" | "ended" | "archived";
export type OfficialEvent = {
  id: string;
  name: Record<string, string>;
  goal: Record<string, string>;
  starts_on: string;
  ends_on: string;
  color: string;
  published: boolean;
  archived: boolean;
  state: EventState;
  members: number;
  today: number;
  completed: number;
  left: number;
  habits: EventHabit[];
};

export const officialEventsQuery = queryOptions({
  queryKey: ["official-events"],
  retry: false,
  queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_official_events");
    if (error) throw error;
    return data as unknown as OfficialEvent[];
  },
});

export type ModerationAction = "hide" | "restore" | "dismiss" | "mute" | "unmute" | "ban" | "unban" | "remove" | "transfer";
export type ModerationScope = { season: string; crew?: string | undefined };
type ModerationMember = { id: string; name: string; handle: string };
type ModerationQueue = {
  me: string;
  members: ModerationMember[];
  restrictions: { id: string; handle: string; restriction: "ban" | "mute"; reason: string }[];
  reports: { id: string; author: string; body: string; hidden: boolean; reports: string[] }[];
};

const args = (scope: ModerationScope) => ({ _season: scope.season, ...(scope.crew ? { _crew: scope.crew } : {}) });
export const moderationAccess = (scope: ModerationScope, uid: string) => queryOptions({
  queryKey: ["moderation-access", scope.season, scope.crew, uid],
  retry: false,
  queryFn: async () => {
    const { data, error } = await supabase.rpc("community_moderation_access", args(scope));
    if (error) throw error;
    return data;
  },
});

export const moderationQueue = (scope: ModerationScope, memberSearch: string) => queryOptions({
  queryKey: ["moderation-queue", scope.season, scope.crew, memberSearch],
  retry: false,
  queryFn: async () => {
    const { data, error } = await supabase.rpc("community_moderation_queue", { ...args(scope), _search: memberSearch });
    if (error) throw error;
    return data as unknown as ModerationQueue;
  },
});

export async function moderate(scope: ModerationScope, action: ModerationAction, target: string, reason: string) {
  const { error } = await supabase.rpc("moderate_community", {
    _season: scope.season, _crew: scope.crew ?? null, _action: action, _target: target, _reason: reason.trim(),
  });
  if (error) throw error;
}

type ModerationNotice = { id: string; scope: "crew" | "event"; name: string; action: ModerationAction; reason: string; at: string; seen: boolean; appeal: string | null; response: string | null };
export const moderationNotices = (uid: string) => queryOptions({
  queryKey: ["moderation-notices", uid],
  retry: false,
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_moderation_notices");
    if (error) throw error;
    return data as unknown as ModerationNotice[];
  },
});

export const myActiveEventQuery = (uid: string) => queryOptions({
  queryKey: ["active-event", uid],
  queryFn: async () => {
    const { data, error } = await supabase.from("season_entries")
      .select("season_id,seasons(name)").eq("user_id", uid).eq("status", "active").maybeSingle();
    if (error) throw error;
    return data;
  },
});

export function joinErrorKey(key: string) {
  if (key === "challenge_not_started") return "events.early";
  if (key === "challenge_surrendered") return "events.leftBefore";
  if (key === "challenge_ended" || key === "challenge_complete") return "events.closed";
  if (key === "crew_full") return "events.crewFull";
  if (key === "challenge_full") return "batch6.full";
  if (key === "crew_not_found" || key === "challenge_not_found") return "events.invalidCode";
  if (key === "crew_moderation_ban") return "events.crewBanned";
  if (key === "event_moderation_ban") return "events.eventBanned";
  if (key === "crew_setup_pending") return "events.crewSetup";
  if (key === "active_challenge_exists") return "events.currentGeneric";
  return "events.joinError";
}

type MemberReport = { id: string; handle: string; reason: string };
export const memberReportsQuery = (scope: ModerationScope) => queryOptions({
  queryKey: ["moderation-member-reports", scope.season, scope.crew],
  retry: false,
  queryFn: async () => {
    const { data, error } = await supabase.rpc("community_member_reports_queue", args(scope));
    if (error) throw error;
    return data as unknown as MemberReport[];
  },
});


export const EVENT_COLORS = {
  blue: "#a8d8fb", pink: "#f6b3d0", purple: "#c5aafb", orange: "#ffb863",
  lime: "#c8f560", teal: "#75dec8", yellow: "#ffe176",
} as const;
export function eventColor(color: string | undefined): string {
  if (color && /^[#][a-f0-9]{6}$/i.test(color)) return color;
  return color && Object.hasOwn(EVENT_COLORS, color)
    ? EVENT_COLORS[color as keyof typeof EVENT_COLORS] : EVENT_COLORS.blue;
}
