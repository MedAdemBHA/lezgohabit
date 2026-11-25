import { createElement } from "react";
import satori, { init as initSatori, type Font } from "satori/standalone";
import { Resvg, initWasm as initResvgWasm } from "@resvg/resvg-wasm";
import layoutWasm from "satori/layout.wasm?module";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm?module";
import bricolageLatinRegular from "@/assets/fonts/bricolage-grotesque-latin-400-normal.woff2?inline";
import bricolageLatinBold from "@/assets/fonts/bricolage-grotesque-latin-700-normal.woff2?inline";
import bricolageLatinExtRegular from "@/assets/fonts/bricolage-grotesque-latin-ext-400-normal.woff2?inline";
import bricolageLatinExtBold from "@/assets/fonts/bricolage-grotesque-latin-ext-700-normal.woff2?inline";
import alexandriaArabicRegular from "@/assets/fonts/alexandria-arabic-400-normal.woff2?inline";
import alexandriaArabicBold from "@/assets/fonts/alexandria-arabic-700-normal.woff2?inline";
import alexandriaLatinRegular from "@/assets/fonts/alexandria-latin-400-normal.woff2?inline";
import alexandriaLatinBold from "@/assets/fonts/alexandria-latin-700-normal.woff2?inline";
import type { PublicChallengePreview } from "@/lib/public-challenges.server";

const WIDTH = 1200;
const HEIGHT = 630;
const FONT_OPTIONS: Font[] = [
  font("Bricolage Grotesque", bricolageLatinRegular, 400),
  font("Bricolage Grotesque", bricolageLatinBold, 700),
  font("Bricolage Grotesque Ext", bricolageLatinExtRegular, 400),
  font("Bricolage Grotesque Ext", bricolageLatinExtBold, 700),
  font("Alexandria", alexandriaArabicRegular, 400, "ar-AR"),
  font("Alexandria", alexandriaArabicBold, 700, "ar-AR"),
  font("Alexandria Latin", alexandriaLatinRegular, 400),
  font("Alexandria Latin", alexandriaLatinBold, 700),
];
const b = createElement;
let enginesReady: Promise<void> | undefined;

function font(name: string, dataUrl: string, weight: 400 | 700, lang?: "ar-AR"): Font {
  return { name, data: decodeDataUrl(dataUrl), weight, style: "normal", ...(lang ? { lang } : {}) };
}

function decodeDataUrl(dataUrl: string): ArrayBuffer {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("invalid_inline_asset");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function initRenderers() {
  if (!enginesReady) {
    enginesReady = Promise.all([initSatori(layoutWasm), initResvgWasm(resvgWasm)]).then(() => undefined);
  }
  await enginesReady;
}

const oneLine = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);
const safeName = (value: Record<string, string> | undefined, lang: "en" | "ar") => {
  if (!value) return "";
  return value[lang] ?? value["en"] ?? value["fr"] ?? value["ar"] ?? "";
};

const INK = "#111111";
const CREAM = "#FFF6E5";
const PAPER = "#FFFDF7";
const STICKERS = ["#C8F560", "#7FB2FF", "#FF8FC7", "#C3A6FF", "#FFD43B", "#5EE6C8"];
const LATIN = "Bricolage Grotesque, Bricolage Grotesque Ext";
const ARABIC = "Alexandria, Alexandria Latin, Bricolage Grotesque, Bricolage Grotesque Ext";
const hasArabic = (value: string) => /[\u0600-\u06ff]/u.test(value);

function blob(size: number, color: string, position: Record<string, number>) {
  return b("div", { style: { position: "absolute", width: size, height: size, borderRadius: size, backgroundColor: color, ...position } });
}

function statTile(value: string, label: string, color: string, tilt: number) {
  return b("div", {
    style: {
      width: 236,
      height: 104,
      padding: "0 22px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      backgroundColor: color,
      border: `4px solid ${INK}`,
      borderRadius: 22,
      boxShadow: `6px 6px 0 ${INK}`,
      transform: `rotate(${tilt}deg)`,
    },
  },
  b("div", { style: { fontSize: 50, fontWeight: 700, lineHeight: 1 } }, value),
  b("div", { style: { marginTop: 4, fontSize: 17, fontWeight: 700, letterSpacing: 2 } }, label));
}

function habitSticker(label: string, index: number, rtl: boolean) {
  return b("div", {
    key: `habit-${index}`,
    lang: rtl ? "ar-AR" : undefined,
    style: {
      display: "flex",
      maxWidth: 560,
      padding: "8px 16px",
      backgroundColor: STICKERS[index % STICKERS.length],
      border: `3px solid ${INK}`,
      borderRadius: 14,
      boxShadow: `4px 4px 0 ${INK}`,
      fontFamily: hasArabic(label) ? ARABIC : LATIN,
      fontSize: 23,
      fontWeight: 700,
      lineHeight: 1.2,
      transform: `rotate(${index % 2 ? 1.5 : -1.5}deg)`,
    },
  }, label);
}

function makeCard(challenge: PublicChallengePreview | null, code: string) {
  const rawName = challenge?.name ?? "You're invited to a crew";
  const rtl = hasArabic(rawName);
  const lang = rtl ? "ar" : "en";
  const title = oneLine(rawName, 60);
  const creator = challenge?.creator ? oneLine(`by @${challenge.creator.replace(/^@/, "")}`, 34) : "Habit crew on Lezgo";
  const titleSize = title.length > 44 ? 46 : title.length > 30 ? 56 : title.length > 18 ? 66 : 78;
  const habits = (challenge?.habits ?? []).slice(0, 5).map((habit) => oneLine(safeName(habit.name, lang), 26)).filter(Boolean);
  const extra = Math.max(0, (challenge?.habits.length ?? 0) - habits.length);
  const members = challenge?.members ?? 0;
  const status = challenge?.ended ? "ENDED" : challenge?.full ? "FULL" : "OPEN";
  const statusColor = challenge?.ended || challenge?.full ? "#FF8FC7" : "#C8F560";
  const align = rtl ? "flex-end" : "flex-start";

  const content = b("div", {
    style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: align },
  },
  b("div", {
    lang: rtl ? "ar-AR" : undefined,
    style: {
      display: "block",
      maxWidth: 680,
      fontFamily: rtl ? ARABIC : LATIN,
      fontSize: titleSize,
      lineHeight: rtl ? 1.3 : 1.02,
      fontWeight: 700,
      letterSpacing: rtl ? 0 : -1,
      textAlign: rtl ? "right" : "left",
      lineClamp: 2,
    },
  }, title),
  b("div", { style: { display: "flex", marginTop: 12, fontSize: 24, fontWeight: 400, color: "#3a3a3a" } }, creator),
  b("div", {
    style: { display: "flex", flexWrap: "wrap", justifyContent: align, gap: 14, marginTop: "auto", maxWidth: 690 },
  },
    ...habits.map((habit, index) => habitSticker(habit, index, hasArabic(habit))),
    ...(extra ? [b("div", { style: { display: "flex", alignItems: "center", padding: "8px 6px", fontSize: 22, fontWeight: 700 } }, `+${extra} more`)] : []),
  ));

  const stats = challenge && b("div", {
    style: { width: 250, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 },
  },
    statTile(String(challenge.days), "DAYS", "#FFD43B", rtl ? 2 : -2),
    statTile(String(members), members === 1 ? "PERSON IN" : "PEOPLE IN", "#7FB2FF", rtl ? -2 : 2),
  );

  return b("div", {
    style: {
      width: WIDTH,
      height: HEIGHT,
      position: "relative",
      display: "flex",
      backgroundColor: CREAM,
      color: INK,
      fontFamily: LATIN,
    },
  },
  blob(360, "#FF7A2F", { right: -120, top: -170 }),
  blob(300, "#C8F560", { left: -130, bottom: -170 }),
  blob(90, "#C3A6FF", { right: 70, bottom: -30 }),
  b("div", {
    style: {
      position: "absolute",
      left: 44,
      top: 38,
      width: 1100,
      height: 538,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      padding: "30px 40px 0",
      backgroundColor: PAPER,
      border: `6px solid ${INK}`,
      borderRadius: 40,
      boxShadow: `12px 12px 0 ${INK}`,
      overflow: "hidden",
    },
  },
  b("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
    b("div", { style: { display: "flex", alignItems: "center", gap: 14 } },
      b("div", { style: { display: "flex", padding: "4px 18px 8px", border: `4px solid ${INK}`, borderRadius: 16, backgroundColor: "#C8F560", boxShadow: `4px 4px 0 ${INK}`, fontSize: 34, fontWeight: 700, letterSpacing: -1 } },
        "lez", b("span", { style: { color: "#FF7A2F" } }, "go")),
      b("div", { style: { display: "flex", fontSize: 30, fontWeight: 700, color: "#FF7A2F", letterSpacing: -4 } }, ">>"),
    ),
    b("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
      b("div", { style: { display: "flex", padding: "8px 16px", borderRadius: 999, backgroundColor: INK, color: PAPER, fontSize: 16, fontWeight: 700, letterSpacing: 3 } }, "HABIT CHALLENGE"),
      ...(challenge ? [b("div", { style: { display: "flex", padding: "6px 14px", borderRadius: 999, border: `3px solid ${INK}`, backgroundColor: statusColor, fontSize: 16, fontWeight: 700, letterSpacing: 2 } }, status)] : []),
    ),
  ),
  b("div", { style: { flex: 1, display: "flex", flexDirection: rtl ? "row-reverse" : "row", gap: 40, padding: "28px 0 26px" } }, content, stats || b("div", { style: { width: 250, display: "flex", alignItems: "center", justifyContent: "center" } }, statTile("1 MIN", "A DAY TO CHECK IN", "#C8F560", -4))),
  b("div", {
    style: {
      margin: "0 -40px",
      height: 74,
      padding: "0 40px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: INK,
      color: PAPER,
      fontSize: 22,
      fontWeight: 700,
    },
  },
    b("div", { style: { display: "flex", letterSpacing: 2 } }, "SHOW UP. LEZGO."),
    b("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
      b("span", { style: { color: "#C8F560", letterSpacing: 2, fontSize: 18 } }, "JOIN WITH CODE"),
      b("span", { style: { display: "flex", padding: "4px 14px", borderRadius: 10, backgroundColor: "#FFD43B", color: INK, fontSize: 26, letterSpacing: 4 } }, code),
    ),
  )));
}

export async function renderChallengeCard(challenge: PublicChallengePreview | null, code: string): Promise<ArrayBuffer> {
  await initRenderers();
  const svg = await satori(makeCard(challenge, code), { width: WIDTH, height: HEIGHT, fonts: FONT_OPTIONS });
  const image = new Resvg(svg, {
    fitTo: { mode: "original" },
    background: CREAM,
    font: { loadSystemFonts: false, sansSerifFamily: "Bricolage Grotesque" },
  });
  const rendered = image.render();
  try {
    const png = rendered.asPng();
    const buffer = new ArrayBuffer(png.byteLength);
    new Uint8Array(buffer).set(png);
    return buffer;
  } finally {
    rendered.free();
    image.free();
  }
}
