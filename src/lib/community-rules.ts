export const BADGE_KEYS = ['first_go','streak7','boss_ko','salat5','sugar7','perfect5'] as const;
export function initials(name: string) {
 const parts = name.trim().split(/\s+/).filter(Boolean);
 if (parts.length > 1) return `${parts[0]?.charAt(0) ?? ''}${parts.at(-1)?.charAt(0) ?? ''}`.toUpperCase();
 return (parts[0] ?? '?').slice(0,2).toUpperCase();
}
export function seasonWeek(day: number) { return Math.max(1, Math.ceil(day/7)); }
export function movement(previous: number | null, current: number) { return previous === null ? 0 : previous-current; }
export function trailState(day: string, today: string, score?: { completion: number; shield_used: boolean }) {
 if (score?.shield_used) return 'shield';
 if (day === today) return 'today';
 if ((score?.completion ?? 0) >= .6) return 'done';
 return day < today ? 'missed' : 'future';
}
