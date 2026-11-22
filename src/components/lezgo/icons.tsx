type P = { className?: string; size?: number };
const base = (size = 24) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const TodayIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden><rect x="3.5" y="4.5" width="17" height="16" rx="4" /><path d="M8 2.5v4M16 2.5v4M8 13l3 3 5-6" /></svg>
);
export const RanksIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden><path d="M4 20v-6h5v6M9.5 20V9h5v11M15 20v-8h5v8M3 20.5h18" /></svg>
);
export { CrewIcon } from '@/components/icons';
import { StreakIcon } from '@/components/icons';
export const FlameIcon = ({ className, size = 22, dim }: P & { dim?: boolean }) => <StreakIcon size={size} className={className} opacity={dim ? 0.45 : 1} />;
