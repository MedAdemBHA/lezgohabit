import { localDate } from "@/lib/time";

type CatalogHabit = {
  key: string;
  name: Record<string, string>;
  what_counts: Record<string, string>;
  kind: string;
  target: number;
  unit: string | null;
  is_faith: boolean;
};

export type CatalogCard = {
  id: string;
  season_id: string;
  kind: "official" | "creator";
  name: Record<string, string>;
  goal?: Record<string, string>;
  creator: string;
  code: string | null;
  days: number;
  starts_on: string;
  ends_on: string;
  members: number;
  habits: CatalogHabit[];
};

export function groupCatalog(cards: CatalogCard[], today = localDate("Africa/Tunis")) {
  return {
    open: cards.filter((card) => card.starts_on <= today && today <= card.ends_on),
    upcoming: cards
      .filter((card) => card.starts_on > today)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on)),
  };
}

export function inviteBlock(
  invite: { starts_on: string; full: boolean; ended: boolean },
  kind: "crew" | "creator",
  today = localDate("Africa/Tunis"),
) {
  if (invite.ended) return "events.closed";
  if (invite.full) return kind === "crew" ? "events.crewFull" : "batch6.full";
  if (invite.starts_on > today) return "events.early";
  return null;
}
