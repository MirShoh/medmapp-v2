import type { Metadata } from "next";
import { seo } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CountryCard } from "@/components/site/cards";
import { FilterBar } from "@/components/site/filter-bar";
import { getFilters, toQuery } from "@/lib/filters";
import { PageHero } from "@/components/site/section";
import { Empty } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cardLabels } from "@/lib/labels";
import { serverGet } from "@/lib/server";
import type { CountryCard as TC } from "@/lib/types";

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return seo({ locale, path: "/destinations", title: t("list.destinationsTitle"), description: t("list.destinationsSub") });
}

export default async function DestinationsPage({ params, searchParams }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  const f = await getFilters(locale);
  const list = (await serverGet<TC[]>(`/public/destinations/${toQuery(sp, ["search", "treatment", "specialty"])}`, locale)) || [];
  return (
    <>
      <PageHero eyebrow={t("nav.destinations")} title={t("list.destinationsTitle")} subtitle={t("list.destinationsSub")} />
      <section className="container-x -mt-6 pb-16">
        <FilterBar total={list.length} fields={[
          { name: "search", label: t("common.search"), type: "text", placeholder: t("list.countrySearch") },
          { name: "treatment", label: t("common.treatment"), type: "select", options: f.treatments.map((x) => ({ value: x.slug, label: x.name })) },
          { name: "specialty", label: t("common.specialty"), type: "select", options: f.specialties.map((x) => ({ value: x.slug, label: x.title })) },
        ]} />
        <div className="mt-8" />
        {list.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((c) => <CountryCard key={c.id} c={c} locale={locale} labels={cardLabels(t)} className="min-h-72" />)}</div>
        ) : <Empty title={t("common.empty")} />}
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[["uzbekistan-gateway", t("footer.gatewayUz"), "🇺🇿"], ["central-asia-gateway", t("footer.gatewayCa"), "🌏"], ["international-gateway", t("footer.gatewayIntl"), "🌍"]].map(([slug, label, flag]) => (
            <Link key={slug} href={`/p/${slug}`} className="card card-hover flex items-center gap-4 p-5">
              <span className="text-3xl">{flag}</span><span className="font-display font-bold text-navy-900">{label}</span><span className="ml-auto text-teal-600">→</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
