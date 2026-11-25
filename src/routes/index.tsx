import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, ListChecks, Target, Users } from "lucide-react";
import { ExploreAsGuest } from "@/components/lezgo/guest";
import { HabitIcon } from "@/components/lezgo/habit-icon";
import { InviteCodeButton, PublicHeader, usePublicLanguage } from "@/components/lezgo/public-entry";
import { publicChallengeCatalog } from "@/lib/challenge-preview.functions";
import { groupCatalog, type CatalogCard } from "@/lib/challenge-catalog";
import { pageHead } from "@/lib/page-head";
import i18n, { formatDayMonth, loc, selectLang, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { lang?: Lang | undefined } => ({ lang: selectLang(search["lang"]) }),
  loader: async () => groupCatalog(await publicChallengeCatalog().catch(() => [])),
  head: ({ match }) => {
    const lang = match.search.lang ?? "en";
    const t = i18n.getFixedT(lang);
    return pageHead(
      `lezgo — ${t("landing.hero").replace(/\n/g, " ")}`,
      t("landing.subtitle"),
      { privatePage: false, canonicalPath: "/", imagePath: "/og-home.png", imageAlt: t("landing.hero").replace(/\n/g, " "), lang },
    );
  },
  component: Landing,
});

function Landing() {
  const lang = usePublicLanguage(Route.useSearch().lang);
  const { open, upcoming } = Route.useLoaderData();
  const t = i18n.getFixedT(lang);
  const nav = useNavigate();
  const current = open.find((card) => card.kind === "official") ?? open[0];
  const featured = current ?? upcoming[0];
  const steps = [
    { icon: Target, color: "bg-lime", label: t("landing.step1"), detail: t("landing.step1Detail") },
    { icon: ListChecks, color: "bg-yellow", label: t("landing.step2"), detail: t("landing.step2Detail") },
    { icon: Users, color: "bg-blue", label: t("landing.step3"), detail: t("landing.step3Detail") },
  ];

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[1120px] flex-col gap-9 px-5 pb-6 pt-4 sm:gap-12 sm:px-8">
      <PublicHeader lang={lang} onLanguage={(next) => void nav({ to: "/", search: { lang: next }, replace: true })} />
      <section className="grid items-center gap-7 sm:gap-10 md:grid-cols-[1.06fr_0.94fr] md:py-9" aria-labelledby="home-hero">
        <div className="space-y-5">
          <p className="inline-flex rounded-lg bg-yellow px-2.5 py-1 text-sm font-extrabold sticker-border">{t("landing.free")}</p>
          <h1 id="home-hero" className="whitespace-pre-line text-[clamp(2.5rem,8vw,5.15rem)] font-extrabold leading-[0.94] tracking-tight">{t("landing.hero")}</h1>
          <p className="max-w-[41ch] text-[17px] font-semibold leading-relaxed text-design-body sm:text-lg">{t("landing.subtitle")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/start" search={{ lang }} className="press inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-base font-extrabold text-lime sticker-border shadow-hard-orange press-orange">
              {t("landing.browse")} <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
            </Link>
            <InviteCodeButton lang={lang} onSubmit={(code) => void nav({ to: "/start", search: { code, lang } })} />
          </div>
        </div>
        {featured ? <FeaturedChallenge card={featured} isOpen={!!current} lang={lang} /> : (
          <div className="rounded-3xl bg-lime p-5 text-ink sticker-border shadow-hard sm:p-7">
            <Target className="size-9" aria-hidden="true" />
            <h2 className="mt-4 text-3xl font-extrabold">{t("startFlow.personal")}</h2>
            <p className="mt-2 text-base font-semibold">{t("startFlow.personalHint")}</p>
            <Link to="/start" search={{ lang }} className="mt-5 inline-flex min-h-11 items-center gap-2 font-extrabold underline underline-offset-4">
              {t("landing.browse")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>
      <section aria-labelledby="how-to-play" className="space-y-4">
        <h2 id="how-to-play" className="text-[28px] font-extrabold">{t("landing.how")}</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {steps.map(({ icon: Icon, color, label, detail }) => (
            <li key={label} className="flex gap-3 rounded-2xl bg-card p-4 sticker-border">
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl sticker-border ${color}`}><Icon className="size-5" aria-hidden="true" /></span>
              <div><h3 className="font-extrabold">{label}</h3><p className="mt-1 text-sm font-semibold text-design-body">{detail}</p></div>
            </li>
          ))}
        </ol>
      </section>
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink pt-4">
        <div className="w-full max-w-[245px]"><ExploreAsGuest lang={lang} /></div>
        <Link to="/admin" className="inline-flex min-h-11 items-center text-sm font-bold text-design-muted underline underline-offset-4">{t("auth.adminSignIn")}</Link>
      </footer>
    </main>
  );
}

function FeaturedChallenge({ card, isOpen, lang }: { card: CatalogCard; isOpen: boolean; lang: Lang }) {
  const t = i18n.getFixedT(lang);
  return (
    <article className="relative rounded-3xl bg-lime p-5 text-ink sticker-border shadow-hard sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-lg bg-ink px-2.5 py-1 text-sm font-extrabold text-lime">{t(isOpen ? "startFlow.openNow" : "socialDesign.upcoming")}</span>
        <span className="rounded-lg bg-yellow px-2.5 py-1 text-sm font-extrabold sticker-border">{t("batch6.days", { n: card.days })}</span>
      </div>
      <h2 className="mt-4 break-words text-[clamp(1.9rem,5vw,3.25rem)] font-extrabold leading-tight">{loc(card.name, lang)}</h2>
      <p className="mt-2 flex items-center gap-2 text-sm font-bold">
        <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
        <span><time dateTime={card.starts_on}>{formatDayMonth(card.starts_on, lang)}</time> – <time dateTime={card.ends_on}>{formatDayMonth(card.ends_on, lang)}</time></span>
      </p>
      {card.habits.length > 0 && <ul className="mt-5 grid gap-2">
        {card.habits.map((habit) => (
          <li key={habit.key} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-sm font-extrabold sticker-border">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-yellow sticker-border" aria-hidden="true"><HabitIcon name={habit.key} className="size-5" /></span>
            {loc(habit.name, lang)}
          </li>
        ))}
      </ul>}
      {isOpen && <Link to="/start" search={{ lang, season: card.season_id }} className="mt-4 inline-flex min-h-11 items-center gap-2 font-extrabold underline underline-offset-4">
        {t("landing.viewChallenge")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </Link>}
    </article>
  );
}
