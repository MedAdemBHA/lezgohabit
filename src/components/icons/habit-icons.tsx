import type { ReactNode } from "react";
import type { IconProps } from "./index";

/**
 * One drawing per habit template, in the supplied sticker style: 48px grid, 3px ink outline,
 * round joins, flat sticker colours from the design tokens (so they follow light/dark themes).
 */
export function Sticker({ size = 48, children, ...props }: IconProps & { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

/** Diagonal "no" bar used by the quit habits. */
const NoBar = () => <path d="M9 39 39 9" stroke="var(--pink)" strokeWidth="5" />;

export const StepsIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M13 6c4 0 6 4 6 9s-2 9-6 9-5-4-5-9 1-9 5-9z" fill="var(--orange)" />
    <path d="M9 28h9v4a4.5 4.5 0 0 1-9 0z" fill="var(--orange)" />
    <path d="M35 14c4 0 5 4 5 9s-1 9-5 9-6-4-6-9 2-9 6-9z" fill="var(--yellow)" />
    <path d="M30 36h9v3a4.5 4.5 0 0 1-9 0z" fill="var(--yellow)" />
  </Sticker>
);

export const Steps10kIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M12 9c4 0 6 4 6 9s-2 9-6 9-5-4-5-9 1-9 5-9z" fill="var(--orange)" />
    <path d="M8 31h9v4a4.5 4.5 0 0 1-9 0z" fill="var(--orange)" />
    <path d="M28 44V6" />
    <path d="M28 7h15l-4 6 4 6H28z" fill="var(--lime)" />
    <path d="M33 7v12M38 7v12" strokeWidth="1.5" />
  </Sticker>
);

export const CoffeeIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M8 18h26v12a10 10 0 0 1-10 10h-6A10 10 0 0 1 8 30z" fill="var(--orange)" />
    <path d="M34 21h3a5 5 0 0 1 0 10h-3" />
    <path d="M16 6c-2 3 2 5 0 8M24 6c-2 3 2 5 0 8" />
  </Sticker>
);

export const ShowerIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M10 6v8a6 6 0 0 1 6-6h6" />
    <path d="M14 18a12 8 0 0 1 24 0z" fill="var(--blue)" />
    <path d="M18 25l-2 5M26 25v6M34 25l2 5M21 35l-1.5 4M31 35l1.5 4" />
  </Sticker>
);

export const SunriseIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M10 34a14 14 0 0 1 28 0z" fill="var(--yellow)" />
    <path d="M4 34h40M24 6v8M10 13l5 5M38 13l-5 5" />
    <path d="M18 41h12" />
  </Sticker>
);

export const MidnightIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="24" cy="26" r="17" fill="var(--purple)" />
    <path d="M24 15v11l7 4" />
    <path d="M36 5a6 6 0 0 0 6 8 7 7 0 1 1-6-8z" fill="var(--yellow)" strokeWidth="2.5" />
  </Sticker>
);

export const PushupIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="10" cy="20" r="4.5" fill="var(--lime)" />
    <path d="M14 22l24 6" strokeWidth="5" />
    <path d="M17 23l-1 10M38 28l4 5" />
    <path d="M4 38h40" />
  </Sticker>
);

export const PlankIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="9" cy="24" r="4.5" fill="var(--lime)" />
    <path d="M13 27h26" strokeWidth="5" />
    <path d="M15 30v5h6M39 27l4 8" />
    <circle cx="34" cy="11" r="7" fill="var(--yellow)" />
    <path d="M34 8v3.5l2 1.5" strokeWidth="2.5" />
  </Sticker>
);

export const StretchIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="24" cy="9" r="5" fill="var(--teal)" />
    <path d="M8 6l16 12 16-12" />
    <path d="M24 18v10l-10 14M24 28l10 14" />
    <path d="M14 42h20" stroke="var(--teal)" />
  </Sticker>
);

export const SunIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="24" cy="24" r="10" fill="var(--yellow)" />
    <path d="M24 4v5M24 39v5M4 24h5M39 24h5M10 10l3.5 3.5M34.5 34.5 38 38M38 10l-3.5 3.5M13.5 34.5 10 38" />
  </Sticker>
);

export const PlusIcon = (p: IconProps) => (
  <Sticker {...p}>
    <rect x="6" y="6" width="36" height="36" rx="12" fill="var(--lime)" strokeDasharray="5 5" />
    <path d="M24 15v18M15 24h18" />
  </Sticker>
);

export const PhoneMorningIcon = (p: IconProps) => (
  <Sticker {...p}>
    <rect x="8" y="10" width="18" height="32" rx="4" fill="var(--card)" />
    <path d="M14 36h6" />
    <circle cx="34" cy="16" r="9" fill="var(--yellow)" />
    <path d="M34 11v5h4" strokeWidth="2.5" />
    <path d="M5 45 29 7" stroke="var(--pink)" strokeWidth="4" />
  </Sticker>
);

export const ScreenTimeIcon = (p: IconProps) => (
  <Sticker {...p}>
    <rect x="12" y="4" width="24" height="40" rx="5" fill="var(--blue)" />
    <circle cx="24" cy="22" r="7" fill="var(--card)" />
    <path d="M24 18.5V22l2.5 1.5" strokeWidth="2.5" />
    <path d="M20 38h8" />
  </Sticker>
);

export const TasbihIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="24" cy="20" r="13" strokeWidth="2" />
    <circle cx="24" cy="7" r="3.5" fill="var(--teal)" />
    <circle cx="33.2" cy="10.8" r="3.5" fill="var(--teal)" />
    <circle cx="37" cy="20" r="3.5" fill="var(--teal)" />
    <circle cx="33.2" cy="29.2" r="3.5" fill="var(--teal)" />
    <circle cx="14.8" cy="29.2" r="3.5" fill="var(--teal)" />
    <circle cx="11" cy="20" r="3.5" fill="var(--teal)" />
    <circle cx="14.8" cy="10.8" r="3.5" fill="var(--teal)" />
    <circle cx="24" cy="34" r="4" fill="var(--yellow)" />
    <path d="M24 38v3l-4 4h8l-4-4" fill="var(--yellow)" />
  </Sticker>
);

export const FastFoodIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M8 22a16 12 0 0 1 32 0z" fill="var(--orange)" />
    <path d="M7 27h34" stroke="var(--lime)" strokeWidth="5" />
    <path d="M9 32h30v2a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6z" fill="var(--orange)" />
    <NoBar />
  </Sticker>
);

export const AppleIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path
      d="M24 16c-4-3-15-3-15 10 0 9 7 17 11 17 2 0 3-1 4-1s2 1 4 1c4 0 11-8 11-17 0-13-11-13-15-10z"
      fill="var(--pink)"
    />
    <path d="M24 16c0-5 2-9 5-11" />
    <path d="M26 11c4-4 10-3 11 0-4 3-8 3-11 0z" fill="var(--lime)" strokeWidth="2.5" />
  </Sticker>
);

export const ProteinIcon = (p: IconProps) => (
  <Sticker {...p}>
    <ellipse cx="24" cy="25" rx="17" ry="15" fill="var(--card)" />
    <circle cx="24" cy="26" r="7.5" fill="var(--yellow)" />
    <path d="M13 18a12 12 0 0 1 7-5" stroke="var(--cream)" strokeWidth="2" />
  </Sticker>
);

export const BedIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M5 12v28M43 26v14M5 34h38" />
    <rect x="5" y="24" width="38" height="10" rx="2" fill="var(--purple)" />
    <rect x="9" y="17" width="12" height="7" rx="3.5" fill="var(--card)" />
    <path d="M27 24l3-3 3 3" strokeWidth="2.5" />
  </Sticker>
);

export const BroomIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M36 5 24 27" />
    <path d="M20 24l10 6-5 13H9l3-12z" fill="var(--yellow)" />
    <path d="M14 43l3-9M20 43l2-8" strokeWidth="2.5" />
    <path d="M38 34l2-4 2 4-2 4zM7 12l1.5-3 1.5 3-1.5 3z" fill="var(--teal)" strokeWidth="2" />
  </Sticker>
);

export const WalletIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M8 14l22-8 3 8" fill="var(--lime)" />
    <rect x="6" y="14" width="36" height="26" rx="5" fill="var(--teal)" />
    <path d="M30 23h12v8H30a4 4 0 0 1 0-8z" fill="var(--card)" />
    <circle cx="31" cy="27" r="1.5" fill="var(--ink)" stroke="none" />
  </Sticker>
);

export const CallIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M12 6l7 8-4 5c2 5 6 9 11 11l5-4 8 7-4 6C21 39 9 27 7 12z" fill="var(--lime)" />
    <path d="M33 6a10 10 0 0 1 9 9M31 12a5 5 0 0 1 5 5" />
  </Sticker>
);

export const BookIcon = (p: IconProps) => (
  <Sticker {...p}>
    <rect x="11" y="5" width="26" height="36" rx="3" fill="var(--orange)" />
    <path d="M11 35h26v8H14a3 3 0 0 1-3-3z" fill="var(--card)" />
    <path d="M17 5v28" />
    <path d="M29 5v13l3.5-3 3.5 3V5" fill="var(--pink)" strokeWidth="2.5" />
  </Sticker>
);

export const PhoneOffIcon = (p: IconProps) => (
  <Sticker {...p}>
    <rect x="13" y="4" width="22" height="40" rx="5" fill="var(--purple)" />
    <path d="M20 38h8" />
    <path d="M18 18c2-3 10-3 12 0M20 23c2-2 6-2 8 0" strokeWidth="2.5" />
    <NoBar />
  </Sticker>
);

export const GradCapIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M4 18 24 9l20 9-20 9z" fill="var(--blue)" />
    <path d="M12 22v9c0 3 6 6 12 6s12-3 12-6v-9" fill="var(--blue)" />
    <path d="M44 18v12" />
    <circle cx="44" cy="33" r="2.5" fill="var(--yellow)" />
  </Sticker>
);

export const JournalIcon = (p: IconProps) => (
  <Sticker {...p}>
    <rect x="8" y="5" width="26" height="38" rx="3" fill="var(--pink)" />
    <path d="M14 5v38" />
    <path d="M19 15h9M19 21h7" strokeWidth="2.5" />
    <path d="M40 16l4 4-14 14-6 2 2-6z" fill="var(--yellow)" />
  </Sticker>
);

export const NoSocialIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path
      d="M8 10h28a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H20l-8 7v-7H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z"
      fill="var(--blue)"
    />
    <path d="M22 18c-2-3-7-1-5 3l5 4 5-4c2-4-3-6-5-3z" fill="var(--pink)" strokeWidth="2.5" />
    <NoBar />
  </Sticker>
);

export const FocusIcon = (p: IconProps) => (
  <Sticker {...p}>
    <rect x="5" y="27" width="14" height="14" rx="3" fill="var(--lime)" />
    <rect x="19" y="27" width="14" height="14" rx="3" fill="var(--yellow)" />
    <rect x="12" y="13" width="14" height="14" rx="3" fill="var(--orange)" />
    <circle cx="37" cy="13" r="7" fill="var(--card)" />
    <circle cx="37" cy="13" r="2" fill="var(--ink)" stroke="none" />
  </Sticker>
);

export const LotusIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M24 8c6 6 6 18 0 26-6-8-6-20 0-26z" fill="var(--pink)" />
    <path d="M24 34C17 32 9 25 8 16c7 0 13 5 16 12" fill="var(--purple)" />
    <path d="M24 34c7-2 15-9 16-18-7 0-13 5-16 12" fill="var(--purple)" />
    <path d="M10 40h28" />
  </Sticker>
);

export const HeartIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path
      d="M24 41S5 30 5 17a10 10 0 0 1 19-4 10 10 0 0 1 19 4c0 13-19 24-19 24z"
      fill="var(--pink)"
    />
    <path d="M13 17a5 5 0 0 1 5-5" stroke="var(--card)" />
  </Sticker>
);

export const EnergyCanIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M15 8h18l2 4v28a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3V12z" fill="var(--lime)" />
    <path d="M27 14l-8 12h7l-4 10 9-13h-7z" fill="var(--yellow)" strokeWidth="2.5" />
    <NoBar />
  </Sticker>
);

export const SmokeFreeIcon = (p: IconProps) => (
  <Sticker {...p}>
    <rect x="5" y="26" width="38" height="8" rx="2" fill="var(--card)" />
    <path d="M33 26v8" />
    <rect x="33" y="26" width="10" height="8" fill="var(--orange)" />
    <path d="M38 20c-3-3 3-5 0-9M42 20c-3-3 3-5 0-9" strokeWidth="2.5" />
    <NoBar />
  </Sticker>
);
