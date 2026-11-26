const SEASON_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function seasonSearch(value: unknown) {
  if (value === undefined) return "";
  return typeof value === "string" ? value : "invalid";
}

export function isSeasonId(value: string) {
  return SEASON_ID.test(value);
}
