import { cn } from "@/lib/utils";

/** Lezgo logo: lime rounded square (24% radius), ink border, two ink chevrons. Never flipped in RTL. */
export function LezgoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={cn("shrink-0", className)} role="img" aria-label="lezgo">
      <rect x="4" y="4" width="92" height="92" rx="24" className="fill-lime stroke-ink" strokeWidth="7" />
      <path d="M28 30l20 20-20 20M52 30l20 20-20 20" fill="none" className="stroke-ink" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span dir="ltr" className={cn("font-sans text-2xl font-extrabold tracking-normal [font-family:var(--font-sans)]", className)}>
      <span className="text-ink">lez</span><span className="text-orange">go</span>
    </span>
  );
}

export function Brand({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2" dir="ltr">
      <LezgoMark size={size} />
      <Wordmark />
    </div>
  );
}
