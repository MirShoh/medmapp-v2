import type { Metadata } from "next";
import { seo } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DoctorCard } from "@/components/site/cards";
import { FilterBar, Pager } from "@/components/site/filter-bar";
import { PageHero } from "@/components/site/section";
import { Empty } from "@/components/ui";
import type { Paginated } from "@/lib/api";
import { getFilters, toQuery } from "@/lib/filters";
import { cardLabels } from "@/lib/labels";
import { serverGet } from "@/lib/server";
import type { DoctorCard as TD } from "@/lib/types";

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return seo({ locale, path: "/doctors", title: t("list.doctorsTitle"), description: t("list.doctorsSub") });
}

export default async function DoctorsPage({ params, searchParams }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  const f = await getFilters(locale);
  const data = await serverGet<Paginated<TD>>(`/public/doctors/${toQuery(sp, ["country", "hospital", "specialty", "treatment", "language", "experience_min", "search", "page"])}`, locale, 30);
  return (
    <>
      <PageHero eyebrow={t("nav.doctors")} title={t("list.doctorsTitle")} subtitle={t("list.doctorsSub")} />
      <section className="container-x -mt-6 pb-24">
        <FilterBar total={data?.count} fields={[
          { name: "search", label: t("common.search"), type: "text", placeholder: t("list.doctorSearch") },
          { name: "specialty", label: t("common.specialty"), type: "select", options: f.specialties.map((s) => ({ value: s.slug, label: s.title })) },
          { name: "country", label: t("common.country"), type: "select", options: f.countries.map((c) => ({ value: c.slug, label: `${c.flag} ${c.name}` })) },
          { name: "experience_min", label: t("list.minExperience"), type: "select", options: [10, 20, 30, 40].map((n) => ({ value: String(n), label: `${n}+` })) },
        ]} />
        <div className="mt-8">
          {data?.results.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data.results.map((d) => <DoctorCard key={d.id} d={d} locale={locale} labels={cardLabels(t)} />)}</div>
          ) : <Empty title={t("list.noResults")} text={t("home.emptyCatalog")} />}
          <Pager count={data?.count || 0} />
        </div>
      </section>
    </>
  );
}
