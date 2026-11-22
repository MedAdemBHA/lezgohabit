import { cn } from "@/lib/utils";

/** Lezgo logo: lime rounded square (24% radius), ink border, two ink chevrons. Never flipped in RTL. */
export function LezgoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={cn("shrink-0", className)} role="img" aria-label="lezgo">
      <rect x="1.25" y="1.25" width="45.5" height="45.5" rx="11" className="fill-lime stroke-ink" strokeWidth="2.5" />
      <path d="M13 15l9 9-9 9M25 15l9 9-9 9" fill="none" className="stroke-ink" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span dir="ltr" className={cn("font-sans text-2xl font-extrabold tracking-tight [font-family:var(--font-sans)]", className)}>
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
