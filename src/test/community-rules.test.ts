import { describe,it,expect } from 'vitest';
import { initials,seasonWeek,movement,trailState } from '@/lib/community-rules';
describe('Community views',()=>{
 it('shows 2-letter initials',()=>{expect(initials('Nour Rahmani')).toBe('NR');expect(initials('Adem')).toBe('AD');});
 it('uses season-relative weeks',()=>{expect(seasonWeek(7)).toBe(1);expect(seasonWeek(9)).toBe(2);});
 it('movement is yesterday rank minus current rank',()=>{expect(movement(6,4)).toBe(2);expect(movement(4,5)).toBe(-1);expect(movement(null,4)).toBe(0);});
 it('trail distinguishes shields, today, 60-percent days and misses',()=>{expect(trailState('2026-11-22','2026-11-23',{completion:0,shield_used:true})).toBe('shield');expect(trailState('2026-11-23','2026-11-23')).toBe('today');expect(trailState('2026-11-22','2026-11-23',{completion:.6,shield_used:false})).toBe('done');expect(trailState('2026-11-22','2026-11-23')).toBe('missed');});
});
