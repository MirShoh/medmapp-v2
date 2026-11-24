import type { Metadata } from "next";
import { seo } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HospitalCard } from "@/components/site/cards";
import { CompareBar } from "@/components/site/compare";
import { FilterBar, Pager } from "@/components/site/filter-bar";
import { PageHero } from "@/components/site/section";
import { Empty } from "@/components/ui";
import type { Paginated } from "@/lib/api";
import { getFilters, toQuery } from "@/lib/filters";
import { cardLabels } from "@/lib/labels";
import { serverGet } from "@/lib/server";
import type { HospitalCard as TH } from "@/lib/types";

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return seo({ locale, path: "/hospitals", title: t("list.hospitalsTitle"), description: t("list.hospitalsSub") });
}

export default async function HospitalsPage({ params, searchParams }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  const f = await getFilters(locale);
  const data = await serverGet<Paginated<TH>>(`/public/hospitals/${toQuery(sp, ["country", "city", "specialty", "treatment", "type", "accreditation", "language", "price_max", "verified", "search", "ordering", "page"])}`, locale, 30);
  return (
    <>
      <PageHero eyebrow={t("nav.hospitals")} title={t("list.hospitalsTitle")} subtitle={t("list.hospitalsSub")} />
      <section className="container-x -mt-6 pb-24">
        <FilterBar total={data?.count} fields={[
          { name: "search", label: t("common.search"), type: "text", placeholder: t("list.hospitalSearch") },
          { name: "country", label: t("common.country"), type: "select", options: f.countries.map((c) => ({ value: c.slug, label: `${c.flag} ${c.name}` })) },
          { name: "specialty", label: t("common.specialty"), type: "select", options: f.specialties.map((s) => ({ value: s.slug, label: s.title })) },
          { name: "type", label: t("list.type"), type: "select", options: f.hospital_types.map((o) => ({ value: o.value, label: t(`htype.${o.value}`) })) },
        ]} />
        <div className="mt-8">
          {data?.results.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.results.map((h) => <HospitalCard key={h.id} h={h} locale={locale} labels={cardLabels(t)} />)}
            </div>
          ) : <Empty title={t("list.noResults")} text={t("home.emptyCatalog")} />}
          <Pager count={data?.count || 0} />
        </div>
      </section>
      <CompareBar kind="hospitals" />
    </>
  );
}
