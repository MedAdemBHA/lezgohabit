import { createServerFn } from "@tanstack/react-start";

export const challengePreview = createServerFn({ method: "GET" })
  .inputValidator((code: string) => {
    if (!/^[a-zA-Z0-9]{6}$/.test(code)) throw Error("invalid_code");
    return code.toUpperCase();
  })
  .handler(async ({ data: code }) => {
    const { getPublicChallengePreview } = await import("@/lib/public-challenges.server");
    return getPublicChallengePreview(code);
  });

export const featuredCreatorChallenges = createServerFn({ method: "GET" }).handler(async () => {
  const { getFeaturedCreatorChallenges } = await import("@/lib/public-challenges.server");
  return getFeaturedCreatorChallenges();
});
