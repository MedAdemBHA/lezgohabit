import { useRouterState } from "@tanstack/react-router";
import i18n, { selectLang } from "@/lib/i18n";

export function StickerLoading() {
  const search = useRouterState({ select: (state) => state.location.searchStr });
  // The server and client need the same text before the saved locale is restored.
  const lang = selectLang(new URLSearchParams(search).get("lang")) ?? "en";
  const label = i18n.getFixedT(lang)("common.loading");

  return (
    <div role="status" aria-label={label} className="mx-auto w-full max-w-[440px] px-5 py-10">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="h-12 w-2/3 rounded-xl border-2 border-ink bg-yellow" />
        <div className="h-40 rounded-[20px] border-2 border-ink bg-lime shadow-hard" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-[18px] border-2 border-ink bg-card shadow-hard" />
          ))}
        </div>
      </div>
    </div>
  );
}
