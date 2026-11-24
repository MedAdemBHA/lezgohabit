export const ONBOARDING_HABIT_LIMIT = 6;
export function canAddHabit(count: number) { return count < ONBOARDING_HABIT_LIMIT; }
export function canStartSeason(count: number) { return count >= 1 && count <= ONBOARDING_HABIT_LIMIT; }
export const DESIGN_HABIT_GROUPS = [
  { key: 'body', color: 'bg-lime', habits: ['train', 'run', 'steps', 'sleep7'] },
  { key: 'mind', color: 'bg-blue', habits: ['learn15', 'read', 'no_social_noon', 'journal'] },
  { key: 'soul', color: 'bg-teal', habits: ['salat', 'quran', 'dhikr', 'dua', 'tasbih'] },
  { key: 'fuel', color: 'bg-pink', habits: ['no_sugar', 'coffee', 'water', 'no_fast_food'] },
] as const;
