import type { SVGProps } from "react";
export type IconProps = SVGProps<SVGSVGElement> & { size?: number };
export function TrainIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="4" y="16" width="6" height="16" rx="2" fill="var(--lime)" />
      <rect x="10" y="11" width="7" height="26" rx="2" fill="var(--lime)" />
      <rect x="31" y="11" width="7" height="26" rx="2" fill="var(--lime)" />
      <rect x="38" y="16" width="6" height="16" rx="2" fill="var(--lime)" />
      <rect x="17" y="21" width="14" height="6" fill="var(--card)" />
    </svg>
  );
}
export function RunIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 31l4-15 8 2 3 6 10 3 12 3c3 1 4 3 4 6v2H4z" fill="var(--orange)" />
      <path d="M4 36h40" />
      <path d="M20 25l2-3M25 27l2-3" />
    </svg>
  );
}
export function LearnIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M24 14c-5-4-12-4-18-3v26c6-1 13-1 18 3 5-4 12-4 18-3V11c-6-1-13-1-18 3z"
        fill="var(--blue)"
      />
      <path d="M24 14v26" />
      <path
        d="M38 2l1.5 3.5L43 7l-3.5 1.5L38 12l-1.5-3.5L33 7l3.5-1.5z"
        fill="var(--yellow)"
        strokeWidth="2.2"
      />
    </svg>
  );
}
export function SleepIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M30 8a17 17 0 1 0 13 24A14 14 0 0 1 30 8z" fill="var(--purple)" />
      <path d="M8 6h8l-8 8h8" strokeWidth="2.6" />
    </svg>
  );
}
export function SalatIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="10" y="4" width="28" height="36" rx="3" fill="var(--teal)" />
      <path d="M16 34V19a8 8 0 0 1 16 0v15z" fill="var(--card)" />
      <path d="M24 9v3" />
      <path d="M14 40v5M20 40v5M28 40v5M34 40v5" />
    </svg>
  );
}
export function QuranIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 12l18 7 18-7v17l-18 7-18-7z" fill="var(--yellow)" />
      <path d="M24 19v17" />
      <path d="M10 46l28-12M38 46L10 34" />
      <path
        d="M24 3l1.4 3 3.1.4-2.3 2.1.6 3.1L24 10l-2.8 1.6.6-3.1-2.3-2.1 3.1-.4z"
        fill="var(--teal)"
        strokeWidth="2"
      />
    </svg>
  );
}
export function DhikrIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="2.6"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="28" cy="8.6" r="3.6" fill="var(--teal)" />
      <circle cx="34.5" cy="13.4" r="3.6" fill="var(--card)" />
      <circle cx="37" cy="21" r="3.6" fill="var(--teal)" />
      <circle cx="34.5" cy="28.6" r="3.6" fill="var(--card)" />
      <circle cx="28" cy="33.4" r="3.6" fill="var(--teal)" />
      <circle cx="20" cy="33.4" r="3.6" fill="var(--card)" />
      <circle cx="13.5" cy="28.6" r="3.6" fill="var(--teal)" />
      <circle cx="11" cy="21" r="3.6" fill="var(--card)" />
      <circle cx="13.5" cy="13.4" r="3.6" fill="var(--teal)" />
      <circle cx="20" cy="8.6" r="3.6" fill="var(--card)" />
      <path d="M24 37v4" />
      <path d="M20 46l4-5 4 5z" fill="var(--teal)" />
    </svg>
  );
}
export function DuaIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M7 24c0-3 4-3 4 0v7c0 5 5 9 13 9s13-4 13-9v-7c0-3 4-3 4 0v7c0 9-7 15-17 15S7 40 7 31z"
        fill="var(--yellow)"
      />
      <path
        d="M24 4l1.8 4.2L30 10l-4.2 1.8L24 16l-1.8-4.2L18 10l4.2-1.8z"
        fill="var(--card)"
        strokeWidth="2.2"
      />
      <path d="M12 12l2 2M36 12l-2 2" strokeWidth="2.4" />
    </svg>
  );
}
export function NoSugarIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 18h26v9a13 13 0 0 1-26 0z" fill="var(--pink)" />
      <path d="M34 21h3a5 5 0 0 1 0 10h-3" />
      <path d="M15 5c-2 3 2 5 0 8M23 5c-2 3 2 5 0 8" />
      <path d="M6 44L42 6" stroke="var(--cream)" strokeWidth="8" />
      <path d="M6 44L42 6" strokeWidth="3.4" />
    </svg>
  );
}
export function WaterIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M24 4C17 15 11 22 11 30a13 13 0 0 0 26 0c0-8-6-15-13-26z" fill="var(--blue)" />
      <path d="M18 31a6 6 0 0 0 6 6" stroke="var(--card)" />
    </svg>
  );
}
export function ProofIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M16 14l3-6h10l3 6" fill="var(--yellow)" />
      <rect x="4" y="14" width="40" height="27" rx="5" fill="var(--yellow)" />
      <circle cx="24" cy="27.5" r="8" fill="var(--card)" />
      <circle cx="24" cy="27.5" r="3" fill="var(--ink)" />
      <path d="M37 20h1" />
    </svg>
  );
}
export function ChaosIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <g transform="rotate(12 24 24)">
        <rect x="7" y="7" width="34" height="34" rx="8" fill="var(--purple)" />
        <circle cx="16" cy="16" r="2.6" fill="var(--ink)" stroke="none" />
        <circle cx="24" cy="24" r="2.6" fill="var(--ink)" stroke="none" />
        <circle cx="32" cy="32" r="2.6" fill="var(--ink)" stroke="none" />
        <circle cx="32" cy="16" r="2.6" fill="var(--ink)" stroke="none" />
        <circle cx="16" cy="32" r="2.6" fill="var(--ink)" stroke="none" />
      </g>
    </svg>
  );
}
export function BossIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M27 3L9 27h13l-3 18 20-26H26z" fill="var(--orange)" />
    </svg>
  );
}
export function StreakIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M24 4c3 8 13 11 13 23a13 13 0 0 1-26 0c0-6 4-9 5-13 2 3 4 4 6 3-2-4-1-9 2-13z"
        fill="var(--orange)"
      />
      <path d="M24 27c2 3 6 4 6 9a6 6 0 0 1-12 0c0-3 2-4 3-6 1 1 2 1 3-3z" fill="var(--yellow)" />
    </svg>
  );
}
export function CrewIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="19" r="5.5" fill="var(--blue)" />
      <circle cx="36" cy="19" r="5.5" fill="var(--pink)" />
      <path d="M3 40a9 9 0 0 1 18 0z" fill="var(--blue)" />
      <path d="M27 40a9 9 0 0 1 18 0z" fill="var(--pink)" />
      <circle cx="24" cy="15" r="6.5" fill="var(--lime)" />
      <path d="M12 43a12 12 0 0 1 24 0z" fill="var(--lime)" />
    </svg>
  );
}
export function ThoughtIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M8 8h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H22l-9 8v-8H8a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
        fill="var(--teal)"
      />
      <circle cx="16" cy="21" r="2.4" fill="var(--ink)" stroke="none" />
      <circle cx="24" cy="21" r="2.4" fill="var(--ink)" stroke="none" />
      <circle cx="32" cy="21" r="2.4" fill="var(--ink)" stroke="none" />
    </svg>
  );
}
/** Language: two overlapping speech bubbles, Latin "A" behind and an Arabic "ع" stroke in front. */
export function LanguageIcon({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M8 5h20a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H14l-6 5v-5a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z"
        fill="var(--blue)"
      />
      <path d="M12 20l6-11 6 11M14.5 16h7" strokeWidth="2.6" />
      <path
        d="M40 19H22a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h12l6 5v-5a4 4 0 0 0 4-4V23a4 4 0 0 0-4-4z"
        fill="var(--lime)"
      />
      <path
        d="M34.5 24.5c-2.2-1.6-5.6-.6-5 2.2.4 2 3.3 2.5 5 1.4M34.5 28.3c-3.6-.4-7.2 1.2-7 4 .2 2.7 4 3.4 7.6 2.4"
        strokeWidth="2.6"
      />
    </svg>
  );
}
/**
 * Language flags, drawn small so they stay crisp at 20–28px. Arabic is spoken in many countries,
 * so it gets a neutral "ع" tile instead of one nation's flag; Tunisian Darja gets Tunisia's flag.
 */
export function LangFlag({
  lang,
  size = 24,
  ...props
}: IconProps & { lang: "en" | "fr" | "ar" | "aeb" }) {
  const id = `flag-${lang}`;
  return (
    <svg
      width={size}
      height={Math.round((size * 2) / 3)}
      viewBox="0 0 30 20"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <clipPath id={id}>
          <rect width="30" height="20" rx="4" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {lang === "en" && (
          <>
            <rect width="30" height="20" fill="#012169" />
            <path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
            <path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" strokeWidth="1.6" />
            <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
            <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth="3.4" />
          </>
        )}
        {lang === "fr" && (
          <>
            <rect width="10" height="20" fill="#0055A4" />
            <rect x="10" width="10" height="20" fill="#fff" />
            <rect x="20" width="10" height="20" fill="#EF4135" />
          </>
        )}
        {lang === "aeb" && (
          <>
            <rect width="30" height="20" fill="#E70013" />
            <circle cx="15" cy="10" r="5.6" fill="#fff" />
            <circle cx="15" cy="10" r="4.2" fill="#E70013" />
            <circle cx="16.1" cy="10" r="3.4" fill="#fff" />
            <path
              d="M18.6 10l-2.56.83 1.58-2.18v2.7l-1.58-2.18z"
              fill="#E70013"
              transform="rotate(-90 17.3 10)"
            />
          </>
        )}
        {lang === "ar" && (
          <>
            {/* Neutral Arabic tile: "ع" measured in Alexandria (ink spans -0.53em…+0.38em around
                the baseline), so baseline 11 at 13px centers it optically inside the 20-unit tile. */}
            <rect width="30" height="20" fill="#007A3D" />
            <text
              x="15.15"
              y="11"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="#fff"
              fontFamily="var(--font-arabic)"
            >
              ع
            </text>
          </>
        )}
      </g>
      <rect
        x="0.75"
        y="0.75"
        width="28.5"
        height="18.5"
        rx="3.5"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
