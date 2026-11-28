import { useQuery } from "@tanstack/react-query";
import { featureFlagsQuery } from "./admin-data";

/**
 * Optional features an admin can switch off (admin_feature_flags). The server enforces each
 * one in its write RPCs (_require_feature); the client hides every entry point and redirects
 * the feature's route to Today. See docs/feature-flags.md.
 */
export type FeatureKey =
  | "bosses"
  | "duels"
  | "buddies"
  | "lift"
  | "capsule_audio"
  | "daily_dare"
  | "creator_challenges"
  | "push";

/** Routes that belong entirely to one feature. */
export const FEATURE_ROUTES: Partial<Record<FeatureKey, string>> = {
  bosses: "/boss",
  buddies: "/buddies",
  lift: "/lift",
};

type Flags = Record<string, boolean> | null | undefined;

/** A flag missing from the table means the feature is on (matches _require_feature). */
export function isFeatureOn(flags: Flags, key: FeatureKey) {
  return flags?.[key] !== false;
}

/** True when a link (inbox item, notification) points into a switched-off feature's route. */
export function hiddenUrl(url: string | null | undefined, flags: Flags) {
  if (!url) return false;
  let path = url;
  try {
    path = new URL(url, "https://lezgo.invalid").pathname;
  } catch {
    /* keep the raw value */
  }
  return (Object.entries(FEATURE_ROUTES) as [FeatureKey, string][]).some(
    ([key, route]) => !isFeatureOn(flags, key) && (path === route || path.startsWith(`${route}/`)),
  );
}

export function useFeatureFlags() {
  return useQuery(featureFlagsQuery);
}

/**
 * Whether to show a feature. While flags load we report "off" so a hidden feature never
 * flashes on screen; an error falls back to "on" so a failed request hides nothing it shouldn't.
 */
export function useFeature(key: FeatureKey) {
  const flags = useFeatureFlags();
  if (flags.isError) return true;
  if (!flags.data) return false;
  return isFeatureOn(flags.data, key);
}
