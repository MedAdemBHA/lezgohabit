import { describe, expect, it } from 'vitest';
import { canAddHabit, canStartSeason } from '@/lib/habit-selection';
describe('Onboarding habits', () => {
  it('allows adding until the maximum of 6', () => {
    expect(canAddHabit(5)).toBe(true); expect(canAddHabit(6)).toBe(false);
  });
  it('requires 1 to 6 habits to start', () => {
    expect(canStartSeason(0)).toBe(false); expect(canStartSeason(1)).toBe(true);
    expect(canStartSeason(6)).toBe(true); expect(canStartSeason(7)).toBe(false);
  });
});
