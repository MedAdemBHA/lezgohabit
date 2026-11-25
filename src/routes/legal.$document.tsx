import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/lezgo/brand";
import { usePublicLanguage } from "@/components/lezgo/public-entry";
import i18n, { selectLang, type Lang } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/legal/$document")({
  validateSearch: (search: Record<string, unknown>): { lang?: Lang | undefined } => ({
    lang: selectLang(search["lang"]),
  }),
  beforeLoad: ({ params }) => {
    if (params.document !== "terms" && params.document !== "privacy") throw notFound();
    return { document: params.document };
  },
  head: ({ params, match }) => {
    const lang = match.search.lang ?? "en";
    const t = i18n.getFixedT(lang);
    const privacy = params.document === "privacy";
    return pageHead(
      `${t(privacy ? "design.privacy" : "design.terms")} — Lezgo`,
      t(privacy ? "accountPolicies.accountData" : "accountPolicies.use"),
      { privatePage: false, canonicalPath: `/legal/${params.document}`, lang },
    );
  },
  component: LegalPage,
});

function LegalPage() {
  const { document } = Route.useRouteContext();
  const lang = usePublicLanguage(Route.useSearch().lang);
  const t = i18n.getFixedT(lang);
  const privacy = document === "privacy";
  return (
    <div className="public-site">
      <main className="public-wrap space-y-5 py-5">
        <Link
          to="/"
          search={{ lang }}
          aria-label={t("landing.home")}
          className="inline-flex"
          dir="ltr"
        >
          <Brand size={35} />
        </Link>
        <h1 className="text-3xl font-extrabold">
          {t(privacy ? "design.privacy" : "design.terms")}
        </h1>
        {privacy ? (
          <div className="space-y-4 text-design-body">
            <p>{t("accountPolicies.accountData")}</p>
            <p>{t("accountPolicies.googleData")}</p>
            <p>{t("accountPolicies.visibility")}</p>
            <p>{t("accountPolicies.preferences")}</p>
          </div>
        ) : (
          <div className="space-y-4 text-design-body">
            <p>{t("accountPolicies.use")}</p>
            <p>{t("accountPolicies.conduct")}</p>
            <p>{t("accountPolicies.moderation")}</p>
          </div>
        )}
        <Link to="/" search={{ lang }} className="public-action public-action-secondary">
          <ArrowLeft aria-hidden="true" className="size-5 rtl:rotate-180" />
          {t("landing.home")}
        </Link>
      </main>
    </div>
  );
}
