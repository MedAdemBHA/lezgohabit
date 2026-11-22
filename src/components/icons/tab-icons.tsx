import type { IconProps } from './index';
const paths = {
  today: <><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></>,
  lift: <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>,
  ranks: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3"/>,
  boss: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>,
  community: <><rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/></>,
};
export function TabIcon({ kind, size = 20, ...props }: IconProps & { kind: keyof typeof paths }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>{paths[kind]}</svg>;
}
export function GlobeIcon({ size = 20, ...props }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>;
}
export function TodayFlame({ size = 18, ...props }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="var(--ink)" strokeWidth="3.4" strokeLinejoin="round" aria-hidden {...props}><path d="M24 4c3 8 13 11 13 23a13 13 0 0 1-26 0c0-6 4-9 5-13 2 3 4 4 6 3-2-4-1-9 2-13z" fill="var(--yellow)"/></svg>;
}
export function CupIcon({ filled, size = 22 }: { filled: boolean; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M4 8h12v6a6 6 0 0 1-12 0V8z" fill={filled ? 'var(--ink)' : 'var(--card)'}/><path d="M16 9h1.5a2.5 2.5 0 0 1 0 5H16"/></svg>;
}