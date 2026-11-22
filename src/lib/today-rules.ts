import type { PrayerState } from './habits';
export const MAX_DAILY_SPINS = 3;
export const DAILY_DARE_COUNT = 7;
export function canSpin(spins: number) { return spins < MAX_DAILY_SPINS; }
export function cyclePrayer(state: PrayerState | undefined): PrayerState | undefined {
  return state === 'on_time' ? 'late' : state === 'late' ? undefined : 'on_time';
}
export function incrementCount(value: number) { return value + 1; }
export function habitColor(key: string, category: string) {
  if (key === 'sleep' || key === 'sleep7') return 'purple';
  if (key === 'run' || key === 'dua') return 'orange';
  if (key === 'water') return 'blue';
  if (['coffee', 'no_sugar', 'no_fast_food'].includes(key)) return 'pink';
  if (category === 'faith') return 'teal';
  if (category === 'mind') return 'blue';
  return 'lime';
}
export function streakAtRisk(hour: number, completion: number, hasHabits: boolean, closed = false) { return !closed && hasHabits && hour >= 20 && completion < 0.6; }
