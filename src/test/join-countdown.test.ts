import { expect, it } from 'vitest';
import { splitMs, winterArcEndLocal } from '@/lib/time';
it('ends the Join countdown on January 1, 2027 at local midnight', () => {
 const end = new Date(winterArcEndLocal());
 expect(end.getFullYear()).toBe(2027); expect(end.getMonth()).toBe(0);
 expect(end.getDate()).toBe(1); expect(end.getHours()).toBe(0);
 expect(end.getMinutes()).toBe(0); expect(end.getSeconds()).toBe(0);
 expect(splitMs(winterArcEndLocal() - new Date(2026, 11, 31, 23, 59, 59).getTime())).toEqual({ d: 0, h: 0, m: 0, s: 1 });
});
