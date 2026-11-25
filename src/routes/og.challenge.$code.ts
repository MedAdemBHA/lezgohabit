import { createFileRoute } from "@tanstack/react-router";

const imageHeaders = {
  "content-type": "image/png",
  "cache-control": "public, max-age=300, s-maxage=3600",
  "x-content-type-options": "nosniff",
};

async function homeFallbackResponse() {
  const { getOgHomeFallback } = await import("@/lib/og-home-fallback.server");
  return new Response(getOgHomeFallback(), { headers: imageHeaders });
}

export const Route = createFileRoute("/og/challenge/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[A-Z0-9]{6}$/i.test(params.code)) return homeFallbackResponse();
        try {
          const [{ getPublicChallengePreview }, { renderChallengeCard }] = await Promise.all([
            import("@/lib/public-challenges.server"),
            import("@/lib/og-card.server"),
          ]);
          const code = params.code.toUpperCase();
          const challenge = await getPublicChallengePreview(code);
          const png = await renderChallengeCard(challenge, code);
          return new Response(png, { headers: imageHeaders });
        } catch (error) {
          console.error("[og-card] Challenge image rendering failed; serving the home preview.", error);
          return homeFallbackResponse();
        }
      },
    },
  },
});
