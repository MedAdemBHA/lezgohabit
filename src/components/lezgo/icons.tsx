type P = { className?: string; size?: number };
const base = (size = 24) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const TodayIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden><rect x="3.5" y="4.5" width="17" height="16" rx="4" /><path d="M8 2.5v4M16 2.5v4M8 13l3 3 5-6" /></svg>
);
export const RanksIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden><path d="M4 20v-6h5v6M9.5 20V9h5v11M15 20v-8h5v8M3 20.5h18" /></svg>
);
export const CrewIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden><circle cx="8.5" cy="8.5" r="3.5" /><circle cx="16.5" cy="9.5" r="2.8" /><path d="M2.5 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5M15 14.6c3 0 5.3 1.6 6 5.4" /></svg>
);
/** The only gradient allowed in the system. */
export const FlameIcon = ({ className, size = 22, dim }: P & { dim?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <defs><linearGradient id="lz-flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--yellow)" /><stop offset="1" stopColor="var(--orange)" /></linearGradient></defs>
    <path d="M12 2.5c.8 3.4 5.5 5.7 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.3-4.2 2.6-5.3.2 1.6 1 2.6 2 3-.6-3.4.2-6.3.9-8.7z"
      fill={dim ? "var(--muted)" : "url(#lz-flame)"} stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
