import {describe,it,expect} from 'vitest';
import {DEMO_PEOPLE,DEMO_HISTORY_DAYS,DEMO_POSTS,requiresReason,suspiciousCheckins,suspiciousLift} from '@/lib/admin-rules';
describe('batch 7 rules',()=>{
 it('seeds exactly 40 realistic profiles',()=>expect(DEMO_PEOPLE.length).toBe(40));
 it('seeds 14 history days',()=>expect(DEMO_HISTORY_DAYS).toBe(14));
 it('seeds 60 feed posts',()=>expect(DEMO_POSTS).toBe(60));
 it('shared demo is Demo · you',()=>expect(DEMO_PEOPLE[0]?.[0]).toBe('Demo · you'));
 it('streak reset requires a reason',()=>expect(requiresReason('reset_streak')).toBe(true));
 it('day reset requires a reason',()=>expect(requiresReason('reset_day')).toBe(true));
 it('20 check-ins is allowed, 21 is suspicious',()=>{expect(suspiciousCheckins(20)).toBe(false);expect(suspiciousCheckins(21)).toBe(true);});
 it('a 50% lift increase is allowed, above 50% is suspicious',()=>{expect(suspiciousLift(100,150)).toBe(false);expect(suspiciousLift(100,151)).toBe(true);});
});
