import { describe, expect, it } from 'vitest';
import { canAddHabit, canStartSeason } from '@/lib/habit-selection';
describe('Onboarding habits', () => {
  it('allows adding until the maximum of 3', () => {
    expect(canAddHabit(2)).toBe(true); expect(canAddHabit(3)).toBe(false);
  });
  it('requires 1 to 3 habits to start', () => {
    expect(canStartSeason(0)).toBe(false); expect(canStartSeason(1)).toBe(true);
    expect(canStartSeason(3)).toBe(true); expect(canStartSeason(4)).toBe(false);
  });
});
