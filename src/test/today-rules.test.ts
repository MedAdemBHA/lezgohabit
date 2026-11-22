import { describe, expect, it } from 'vitest';
import { canSpin, cyclePrayer, incrementCount, MAX_DAILY_SPINS, streakAtRisk } from '@/lib/today-rules';
import { completion } from '@/lib/habits';
describe('Today controls', () => {
 it('shows streak risk after 20:00 below 60 percent only', () => { expect(streakAtRisk(19,.5,true)).toBe(false); expect(streakAtRisk(20,.5,true)).toBe(true); expect(streakAtRisk(20,.6,true)).toBe(false); expect(streakAtRisk(21,.5,false)).toBe(false); expect(streakAtRisk(21,.5,true,true)).toBe(false); });
 it('allows no more than 3 spins per day', () => { expect(MAX_DAILY_SPINS).toBe(3); expect(canSpin(2)).toBe(true); expect(canSpin(3)).toBe(false); });
 it('cycles each prayer none → on time → late → none', () => { expect(cyclePrayer(undefined)).toBe('on_time'); expect(cyclePrayer('on_time')).toBe('late'); expect(cyclePrayer('late')).toBeUndefined(); });
 it('count taps add exactly 1', () => { expect(incrementCount(2)).toBe(3); expect(incrementCount(0)).toBe(1); });
 it('partial Salat shows completion from on-time and late prayers', () => { expect(completion({ kind: 'salat', target: 5 }, { value: 2.5, detail: { prayers: { fajr: 'on_time', dhuhr: 'late', asr: 'on_time' } } })).toBe(0.5); });
});
