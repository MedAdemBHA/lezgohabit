import { createServerFn } from "@tanstack/react-start";

export const challengePreview = createServerFn({ method: "GET" })
  .validator((code: string) => /^[a-zA-Z0-9]{6}$/.test(code) ? code.toUpperCase() : "")
  .handler(async ({ data: code }) => {
    if (!code) return null;
    const { getPublicChallengePreview } = await import("@/lib/public-challenges.server");
    return getPublicChallengePreview(code);
  });

export const featuredCreatorChallenges = createServerFn({ method: "GET" }).handler(async () => {
  const { getFeaturedCreatorChallenges } = await import("@/lib/public-challenges.server");
  return getFeaturedCreatorChallenges();
});

export const crewInvitePreview = createServerFn({ method: "GET" })
  .validator((code: string) => /^[a-zA-Z0-9]{6}$/.test(code) ? code.toUpperCase() : "")
  .handler(async ({ data }) => {
    if (!data) return null;
    const { getCrewInvitePreview } = await import("@/lib/public-challenges.server");
    return getCrewInvitePreview(data);
  });

export const currentOfficialEvent = createServerFn({ method: "GET" }).handler(async () => {
  const { getCurrentOfficialEvent } = await import("@/lib/public-challenges.server");
  return getCurrentOfficialEvent();
});
