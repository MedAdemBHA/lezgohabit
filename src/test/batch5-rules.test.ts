import {describe,it,expect} from 'vitest';
import {displayWeight,jailBreaks,timerSeconds} from '@/lib/batch5-rules';
describe('detox and kit presentation rules',()=>{
 it('15 minutes runs for exactly 900 seconds',()=>expect(timerSeconds('2026-11-23T00:00:00Z',15,Date.parse('2026-11-23T00:00:00Z'))).toBe(900));
 it('30 minutes ends at 30 minutes and never becomes negative',()=>{expect(timerSeconds('2026-11-23T00:00:00Z',30,Date.parse('2026-11-23T00:30:00Z'))).toBe(0);expect(timerSeconds('2026-11-23T00:00:00Z',30,Date.parse('2026-11-23T01:00:00Z'))).toBe(0);});
 it('60 minutes runs for exactly 3600 seconds',()=>expect(timerSeconds('2026-11-23T00:00:00Z',60,Date.parse('2026-11-23T00:00:00Z'))).toBe(3600));
 it('leaving the visible app breaks phone jail',()=>{expect(jailBreaks('hidden')).toBe(true);expect(jailBreaks('visible')).toBe(false);});
 it('10kg kit is displayed in pounds without changing the stored kg',()=>{expect(displayWeight(10,'lb')).toBe(22);expect(displayWeight(10,'kg')).toBe(10);});
});
