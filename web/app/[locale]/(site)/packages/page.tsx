import type { Metadata } from "next";
import { seo } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PackageCard } from "@/components/site/cards";
import { CompareBar } from "@/components/site/compare";
import { FilterBar, Pager } from "@/components/site/filter-bar";
import { PageHero } from "@/components/site/section";
import { Empty } from "@/components/ui";
import type { Paginated } from "@/lib/api";
import { getFilters, toQuery } from "@/lib/filters";
import { cardLabels } from "@/lib/labels";
import { serverGet } from "@/lib/server";
import type { PackageCard as TP } from "@/lib/types";

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return seo({ locale, path: "/packages", title: t("list.packagesTitle"), description: t("list.packagesSub") });
}

export default async function PackagesPage({ params, searchParams }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  const f = await getFilters(locale);
  const data = await serverGet<Paginated<TP>>(`/public/packages/${toQuery(sp, ["country", "treatment", "specialty", "price_max", "search", "ordering", "page"])}`, locale, 30);
  return (
    <>
      <PageHero eyebrow={t("nav.packages")} title={t("list.packagesTitle")} subtitle={t("list.packagesSub")} />
      <section className="container-x -mt-6 pb-24">
        <FilterBar total={data?.count} fields={[
          { name: "search", label: t("common.search"), type: "text" },
          { name: "country", label: t("common.country"), type: "select", options: f.countries.map((c) => ({ value: c.slug, label: `${c.flag} ${c.name}` })) },
          { name: "specialty", label: t("common.specialty"), type: "select", options: f.specialties.map((s) => ({ value: s.slug, label: s.title })) },
          { name: "treatment", label: t("common.treatment"), type: "select", options: f.treatments.map((s) => ({ value: s.slug, label: s.name })) },
          { name: "price_max", label: t("list.priceMax"), type: "number" },
          { name: "ordering", label: t("common.filters"), type: "select", options: [{ value: "price", label: t("list.sortPrice") }] },
        ]} />
        <p className="mt-4 text-xs text-ink-muted">{t("common.disclaimerPrice")}</p>
        <div className="mt-6">
          {data?.results.length
            ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.results.map((p) => <PackageCard key={p.id} p={p} locale={locale} labels={cardLabels(t)} />)}</div>
            : <Empty title={t("list.noResults")} text={t("home.emptyCatalog")} />}
          <Pager count={data?.count || 0} />
        </div>
      </section>
      <CompareBar kind="packages" />
    </>
  );
}
