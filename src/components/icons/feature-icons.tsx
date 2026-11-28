import type { IconProps } from "./index";
import { Sticker } from "./habit-icons";

/**
 * App feature drawings (Small Wins, buddies, invite, trophies...), in the same sticker style as
 * the habit icons, replacing thin generic line icons on feature tiles and empty states.
 */
export const WinsIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M20 6l4 11 11 4-11 4-4 11-4-11-11-4 11-4z" fill="var(--yellow)" />
    <path d="M37 27l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--pink)" strokeWidth="2.5" />
    <circle cx="38" cy="10" r="3" fill="var(--lime)" strokeWidth="2.5" />
  </Sticker>
);

export const BuddyIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="16" cy="16" r="7" fill="var(--yellow)" />
    <circle cx="32" cy="16" r="7" fill="var(--pink)" />
    <path d="M4 40a12 12 0 0 1 24 0z" fill="var(--yellow)" />
    <path d="M20 40a12 12 0 0 1 24 0z" fill="var(--pink)" />
  </Sticker>
);

export const InviteIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="18" cy="16" r="8" fill="var(--lime)" />
    <path d="M4 42a14 14 0 0 1 28 0z" fill="var(--lime)" />
    <circle cx="37" cy="24" r="8" fill="var(--yellow)" />
    <path d="M37 20v8M33 24h8" strokeWidth="2.5" />
  </Sticker>
);

export const CrowdIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="11" cy="17" r="5" fill="var(--blue)" />
    <circle cx="37" cy="17" r="5" fill="var(--pink)" />
    <circle cx="24" cy="13" r="6" fill="var(--yellow)" />
    <path d="M3 38a8 8 0 0 1 16 0zM29 38a8 8 0 0 1 16 0z" fill="var(--card)" />
    <path d="M13 40a11 11 0 0 1 22 0z" fill="var(--yellow)" />
  </Sticker>
);

export const CompassIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="24" cy="24" r="19" fill="var(--teal)" />
    <path d="M30 13l-4 13-8 9 4-13z" fill="var(--card)" />
    <path d="M30 13l-8 9 4 4z" fill="var(--pink)" />
  </Sticker>
);

export const TrophyIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M14 6h20v12a10 10 0 0 1-20 0z" fill="var(--yellow)" />
    <path d="M14 10H7a7 7 0 0 0 7 9M34 10h7a7 7 0 0 1-7 9" />
    <path d="M24 28v6" />
    <path d="M15 42a9 6 0 0 1 18 0z" fill="var(--orange)" />
    <path d="M19 11v6" stroke="var(--card)" />
  </Sticker>
);

export const PadlockIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M15 21v-6a9 9 0 0 1 18 0v6" />
    <rect x="9" y="21" width="30" height="22" rx="5" fill="var(--yellow)" />
    <circle cx="24" cy="30" r="3" fill="var(--ink)" stroke="none" />
    <path d="M24 32v5" />
  </Sticker>
);

export const GhostIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M9 42V22a15 15 0 0 1 30 0v20l-5-4-5 4-5-4-5 4-5-4z" fill="var(--card)" />
    <circle cx="19" cy="22" r="2.5" fill="var(--ink)" stroke="none" />
    <circle cx="29" cy="22" r="2.5" fill="var(--ink)" stroke="none" />
    <path d="M21 29a4 3 0 0 0 6 0" fill="var(--pink)" strokeWidth="2.5" />
  </Sticker>
);

export const CameraIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M6 15h8l4-6h12l4 6h8v24H6z" fill="var(--yellow)" />
    <circle cx="24" cy="26" r="8" fill="var(--blue)" />
    <circle cx="21.5" cy="23.5" r="2" fill="var(--card)" stroke="none" />
    <circle cx="37" cy="20" r="1.5" fill="var(--ink)" stroke="none" />
  </Sticker>
);

export const FirstGoIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M24 4l5 4 6-1 2 6 6 3-2 6 2 6-6 3-2 6-6-1-5 4-5-4-6 1-2-6-6-3 2-6-2-6 6-3 2-6 6 1z" fill="var(--lime)" />
    <path d="M16 24l6 6 11-12" />
  </Sticker>
);

export const PerfectIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M24 5l5.6 12 13 1.4-9.7 8.8 2.8 12.8L24 33.4 12.3 40l2.8-12.8-9.7-8.8 13-1.4z" fill="var(--yellow)" />
    <path d="M19 21l-1.5 5" stroke="var(--card)" />
  </Sticker>
);

export const SnowflakeIcon = (p: IconProps) => (
  <Sticker {...p}>
    <circle cx="24" cy="24" r="19" fill="var(--blue)" />
    <path d="M24 10v28M12 17l24 14M12 31l24-14" />
    <path d="M20 12l4 4 4-4M20 36l4-4 4 4" strokeWidth="2.5" />
  </Sticker>
);

export const DuelIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M8 6l22 22M40 6 18 28" />
    <path d="M26 32l6-6 4 4-6 6zM22 32l-6-6-4 4 6 6z" fill="var(--orange)" />
    <path d="M35 35l6 6M13 35l-6 6" strokeWidth="4" />
  </Sticker>
);

export const PhoneIcon = (p: IconProps) => (
  <Sticker {...p}>
    <rect x="13" y="4" width="22" height="40" rx="5" fill="var(--purple)" />
    <rect x="17" y="10" width="14" height="22" rx="2" fill="var(--card)" />
    <path d="M21 38h6" />
  </Sticker>
);

export const BoltIcon = (p: IconProps) => (
  <Sticker {...p}>
    <path d="M28 4 10 27h12l-4 17 20-25H26z" fill="var(--yellow)" />
  </Sticker>
);
