/** The frozen result surrender_challenge returns, kept for the calm recap shown right after leaving. */
export type SurrenderRecap = {
  season_id: string;
  name: string;
  points: number;
  completed_days: number;
  perfect_days: number;
  consistency: number;
  trophy: boolean;
};

const KEY = "lezgo_surrender_recap";

export function saveSurrenderRecap(recap: SurrenderRecap) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(recap));
  } catch {
    /* storage unavailable: History still has the result */
  }
}

export function readSurrenderRecap(): SurrenderRecap | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as SurrenderRecap | null;
    return value && typeof value.points === "number" ? value : null;
  } catch {
    return null;
  }
}

export function clearSurrenderRecap() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
