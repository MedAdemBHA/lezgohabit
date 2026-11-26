import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, Flame, Target, Users } from "lucide-react";
import { Brand, LezgoMark } from "@/components/lezgo/brand";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { ExploreAsGuest } from "@/components/lezgo/guest";
import {
  ChallengeDates,
  ChallengeHabits,
  InviteCodeButton,
  PublicHeader,
  usePublicLanguage,
} from "@/components/lezgo/public-entry";
import { publicChallengeCatalog } from "@/lib/challenge-preview.functions";
import { guestDemoAvailable } from "@/lib/admin.functions";
import { groupCatalog, type CatalogCard } from "@/lib/challenge-catalog";
import { pageHead } from "@/lib/page-head";
import { useUser } from "@/lib/data";
import i18n, { isRtl, loc, selectLang, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { lang?: Lang | undefined } => ({
    lang: selectLang(search["lang"]),
  }),
  loader: async () => {
    const [cards, demoAvailable] = await Promise.all([
      publicChallengeCatalog().catch(() => []),
      guestDemoAvailable().catch(() => false),
    ]);
    return { ...groupCatalog(cards), demoAvailable };
  },
  head: ({ match }) => {
    const lang = match.search.lang ?? "en";
    const t = i18n.getFixedT(lang);
    return pageHead(`${t("landing.headline").replace(/\n/g, " ")} — lezgo`, t("landing.subtitle"), {
      privatePage: false,
      canonicalPath: "/",
      imagePath: "/og-home.png",
      imageAlt: t("landing.hero").replace(/\n/g, " "),
      lang,
    });
  },
  component: Landing,
});

function Landing() {
  const lang = usePublicLanguage(Route.useSearch().lang);
  const { open, upcoming, demoAvailable } = Route.useLoaderData();
  const t = i18n.getFixedT(lang);
  const nav = useNavigate();
  const user = useUser();
  const hash = useLocation({ select: (location) => location.hash });
  const current = open.find((card) => card.kind === "official") ?? open[0];
  const featured = current ?? upcoming[0];
  const steps = [
    { icon: Target, color: "bg-lime", label: t("landing.step1"), detail: t("landing.step1Detail") },
    {
      icon: CalendarCheck,
      color: "bg-orange",
      label: t("landing.step2"),
      detail: t("landing.step2Detail"),
    },
    {
      icon: Users,
      color: "bg-purple",
      label: t("landing.step3"),
      detail: t("landing.step3Detail"),
    },
  ];

  return (
    <div className="public-site">
      <div className="public-wrap">
        <PublicHeader
          lang={lang}
          signedIn={!!user}
          onLanguage={(next) => void nav({ to: "/", search: { lang: next }, hash, replace: true })}
        />
        <main>
          <section className="home-masthead" aria-labelledby="home-hero">
            <div className="home-hero-copy">
              <p className="public-kicker">
                <Flame className="size-5" aria-hidden="true" />
                {t("landing.freeChallenges")}
              </p>
              <FitHeading
                id="home-hero"
                className="home-headline"
                text={t("landing.headline")}
                requestedSize={isRtl(lang) ? 44 : 58}
                useCssInitialSize
              />
              <p className="home-intro">{t("landing.subtitle")}</p>
              <div className="public-actions">
                <Link to="/start" search={{ lang }} className="public-action public-action-primary">
                  {t("landing.browse")}{" "}
                  <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
                </Link>
                <InviteCodeButton
                  lang={lang}
                  onSubmit={(code) => void nav({ to: "/start", search: { code, lang } })}
                />
              </div>
              <p className="mt-3 text-[14px] font-extrabold">{t("ux.trust")}</p>
            </div>
            <div className="home-photo">
              <img
                src="/images/lezgo-track.webp"
                width={1122}
                height={1402}
                alt={t("landing.trackPhoto")}
                fetchPriority="high"
              />
              <span className="home-photo-mark" aria-hidden="true">
                <LezgoMark size={78} />
              </span>
            </div>
          </section>

          {featured && <FeaturedChallenge card={featured} isOpen={!!current} lang={lang} />}

          <section id="how-it-works" aria-labelledby="how-heading" className="home-how">
            <h2 id="how-heading" className="public-section-title">
              {t("landing.how")}
            </h2>
            <ol>
              {steps.map(({ icon: Icon, color, label, detail }) => (
                <li key={label}>
                  <span className={`home-step-icon ${color}`}>
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{label}</h3>
                    <p>{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {demoAvailable && (
            <div className="home-demo">
              <div>
                <h2 className="text-2xl font-extrabold">{t("landing.demoTitle")}</h2>
                <p className="mt-1 text-sm font-medium">{t("landing.demoDetail")}</p>
              </div>
              <ExploreAsGuest lang={lang} className="home-demo-button" />
            </div>
          )}
        </main>

        <footer className="public-footer">
          <Link to="/" search={{ lang }} aria-label={t("landing.home")}>
            <Brand size={28} />
          </Link>
          <div className="flex flex-wrap items-center gap-x-3">
            <Link
              to="/legal/$document"
              params={{ document: "terms" }}
              search={{ lang }}
              className="public-footer-link"
            >
              {t("design.terms")}
            </Link>
            <Link
              to="/legal/$document"
              params={{ document: "privacy" }}
              search={{ lang }}
              className="public-footer-link"
            >
              {t("design.privacy")}
            </Link>
          </div>
          <Link to="/admin" className="public-footer-link">
            {t("auth.adminSignIn")}
          </Link>
        </footer>
      </div>
    </div>
  );
}

function FeaturedChallenge({
  card,
  isOpen,
  lang,
}: {
  card: CatalogCard;
  isOpen: boolean;
  lang: Lang;
}) {
  const t = i18n.getFixedT(lang);
  return (
    <section aria-labelledby="featured-title" className="home-featured">
      <div className="home-featured-lead">
        <p className="public-kicker">
          <span className="public-status-dot" />
          {t(isOpen ? "startFlow.openNow" : "socialDesign.upcoming")}
        </p>
        <h2 id="featured-title">{loc(card.name, lang)}</h2>
        <div className="public-meta">
          <ChallengeDates card={card} lang={lang} />
          <span>{t("batch6.days", { n: card.days })}</span>
        </div>
        {card.kind === "creator" && card.creator && (
          <p className="text-sm font-bold">
            {t("batch6.creatorLabel", { name: `@${card.creator.replace(/^@/, "")}` })}
          </p>
        )}
        {isOpen && (
          <Link
            to="/start"
            search={{ lang, season: card.season_id }}
            hash="open-challenges"
            className="public-action public-action-dark"
          >
            {t("landing.viewChallenge")}{" "}
            <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </Link>
        )}
      </div>
      <ChallengeHabits card={card} lang={lang} />
    </section>
  );
}
