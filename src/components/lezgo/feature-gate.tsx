import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { isFeatureOn, useFeatureFlags, type FeatureKey } from "@/lib/features";

/** A switched-off feature's route sends the player to Today (direct URLs included). */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const flags = useFeatureFlags();
  if (!flags.data && !flags.isError) return null;
  if (flags.isError || isFeatureOn(flags.data, feature)) return children;
  return <Navigate to="/today" replace />;
}
