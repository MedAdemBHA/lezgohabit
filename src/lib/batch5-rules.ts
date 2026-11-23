/** Presentation conversions only; rewards and comparisons belong to Postgres. */
export const LB_PER_KG = 2.2046226218;
export function displayWeight(kg: number, unit: string) {
  return Math.round(kg * (unit === 'lb' ? LB_PER_KG : 1) * 10) / 10;
}
export function timerSeconds(startedAt: string, minutes: number, now: number) {
  return Math.max(0, Math.ceil((Date.parse(startedAt) + minutes * 60000 - now) / 1000));
}
export function jailBreaks(visibility: DocumentVisibilityState) { return visibility !== 'visible'; }