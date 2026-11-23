/** Opt-in real database regression tests; run against temporary fixture players only.
 * LEZGO_TEST_USER / LEZGO_TEST_SEASON / LEZGO_TEST_DAYS identify a seeded historical fixture.
 * Stages 4, 6 and 7 exercise exact award boundaries, not browser-derived scores.
 */
import { execFileSync } from 'node:child_process';
import { describe,expect,it } from 'vitest';
const uid=process.env['LEZGO_TEST_USER'];const sid=process.env['LEZGO_TEST_SEASON'];const days=Number(process.env['LEZGO_TEST_DAYS']);
const uuid=/^[0-9a-f-]{36}$/;
function query(sql:string):Record<string,unknown>[] {const result=JSON.parse(execFileSync('lovable',['supabase','query',sql,'--json'],{encoding:'utf8'})) as {rows:Record<string,unknown>[]};return result.rows;}
describe.skipIf(!uid||!sid||!Number.isFinite(days))('server-earned badges and access',()=>{
 it('first check-in is awarded from saved positive check-ins',()=>{expect(uid&&uuid.test(uid)).toBe(true);expect(sid&&uuid.test(sid)).toBe(true);const rows=query(`select key from public.badges where user_id='${uid}' and season_id='${sid}'`);expect(rows.map(r=>r['key'])).toContain('first_go');});
 it('7-day streak requires at least 7 saved streak days',()=>{const rows=query(`select key from public.badges where user_id='${uid}' and season_id='${sid}' and key='streak7'`);expect(rows.length).toBe(days>=7?1:0);});
 it('sugar-free week requires 7 consecutive completed days',()=>{const rows=query(`select key from public.badges where user_id='${uid}' and season_id='${sid}' and key='sugar7'`);expect(rows.length).toBe(days>=7?1:0);});
 it('Perfect ×5 requires 5 saved perfect days',()=>{const rows=query(`select key from public.badges where user_id='${uid}' and season_id='${sid}' and key='perfect5'`);expect(rows.length).toBe(days>=5?1:0);});
 it('Boss K.O. is not fabricated from habits',()=>{expect(query(`select key from public.badges where user_id='${uid}' and season_id='${sid}' and key='boss_ko'`).length).toBe(0);});
 it('players cannot award their own badges or write buddy acceptance directly',()=>{const row=query("select has_table_privilege('authenticated','public.badges','INSERT') as badge_write,has_table_privilege('authenticated','public.buddy_links','UPDATE') as buddy_write,has_function_privilege('authenticated','public._award_badges(uuid,uuid)','EXECUTE') as award_access")[0];expect(row?.['badge_write']).toBe(false);expect(row?.['buddy_write']).toBe(false);expect(row?.['award_access']).toBe(false);});
});
