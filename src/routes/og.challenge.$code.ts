import { createFileRoute } from "@tanstack/react-router";

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const oneLine = (value: string, max = 52) => value.replace(/\s+/g, " ").trim().slice(0, max);

export const Route = createFileRoute("/og/challenge/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[A-Z0-9]{6}$/i.test(params.code)) return new Response("Not found", { status: 404 });
        const { getPublicChallengePreview } = await import("@/lib/public-challenges.server");
        const challenge = await getPublicChallengePreview(params.code.toUpperCase());
        const name = oneLine(challenge?.name ?? "Crew invitation", 58);
        const creator = oneLine(challenge?.creator ? `@${challenge.creator.replace(/^@/, "")}` : `Code ${params.code.toUpperCase()}`, 34);
        const habits = (challenge?.habits ?? []).slice(0, 4).map((habit) => oneLine(habit.name["en"] ?? habit.name["fr"] ?? habit.name["ar"] ?? "Habit", 28));
        const extra = Math.max(0, (challenge?.habits.length ?? 0) - habits.length);
        const habitRows = habits.map((habit, index) =>
          `<text x="${96 + (index % 2) * 500}" y="${442 + Math.floor(index / 2) * 42}" class="habit">• ${escapeXml(habit)}</text>`,
        ).join("");
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(name)} challenge card">
  <rect width="1200" height="630" fill="#fff6e5"/>
  <circle cx="1112" cy="92" r="156" fill="#ffb13b"/>
  <circle cx="1052" cy="555" r="105" fill="#b9e64a"/>
  <rect x="44" y="42" width="1112" height="546" rx="34" fill="#fffdf7" stroke="#191919" stroke-width="7"/>
  <rect x="76" y="76" width="180" height="52" rx="14" fill="#b9e64a" stroke="#191919" stroke-width="4"/>
  <text x="166" y="112" text-anchor="middle" class="brand">lezgo</text>
  <text x="1090" y="109" text-anchor="end" class="eyebrow">HABIT CHALLENGE</text>
  <text x="88" y="221" class="title" textLength="1024" lengthAdjust="spacingAndGlyphs">${escapeXml(name)}</text>
  <text x="92" y="278" class="creator">by ${escapeXml(creator)} on Lezgo</text>
  <rect x="88" y="318" width="222" height="74" rx="18" fill="#ffe176" stroke="#191919" stroke-width="4"/>
  <text x="199" y="366" text-anchor="middle" class="stat">${challenge?.days ?? "CREW"} ${challenge ? "DAYS" : "INVITE"}</text>
  <rect x="328" y="318" width="238" height="74" rx="18" fill="#a8d8fb" stroke="#191919" stroke-width="4"/>
  <text x="447" y="366" text-anchor="middle" class="stat">${challenge?.habits.length ?? 0} HABITS</text>
  <text x="608" y="365" class="joined">${challenge?.members ?? 0} people joined</text>
  ${habitRows}
  ${extra ? `<text x="96" y="${442 + Math.ceil(habits.length / 2) * 42}" class="habit">+ ${extra} more habits</text>` : ""}
  <text x="1090" y="548" text-anchor="end" class="tagline">SHOW UP. LEZGO.</text>
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill: #191919; }
    .brand { font-size: 30px; font-weight: 900; }
    .eyebrow { font-size: 18px; font-weight: 800; letter-spacing: 3px; }
    .title { font-size: 66px; font-weight: 900; }
    .creator { font-size: 26px; font-weight: 700; }
    .stat { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
    .joined { font-size: 22px; font-weight: 700; }
    .habit { font-size: 24px; font-weight: 700; }
    .tagline { font-size: 18px; font-weight: 900; letter-spacing: 2px; }
  </style>
</svg>`;
        return new Response(svg, {
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=300, s-maxage=3600",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
