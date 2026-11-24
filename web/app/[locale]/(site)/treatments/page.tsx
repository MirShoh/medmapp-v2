import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/site/section";
import { TreatmentExplorer } from "@/components/site/treatment-explorer";
import { seo } from "@/lib/seo";
import { serverGet } from "@/lib/server";
import type { Specialty, Treatment } from "@/lib/types";

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return seo({ locale, path: "/treatments", title: t("list.treatmentsTitle"), description: t("list.treatmentsSub") });
}

export default async function TreatmentsPage({ params, searchParams }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  const specialties = (await serverGet<Specialty[]>("/public/specialties/", locale)) || [];
  const treatments = (await serverGet<{ results: Treatment[] }>("/public/treatments/?page_size=500", locale, 60))?.results || [];
  return (
    <>
      <PageHero eyebrow={t("nav.treatments")} title={t("list.treatmentsTitle")} subtitle={t("explorer.pageSubtitle")} />
      <section className="container-x py-12 pb-24">
        <TreatmentExplorer page initial={sp.specialty} specialties={specialties} treatments={treatments} locale={locale} labels={{
          popular: t("explorer.popular"), search: t("explorer.search"), hospitals: t("explorer.hospitals"), from: t("common.from"),
          open: t("common.learnMore"), empty: t("explorer.empty"), ctaTitle: t("explorer.ctaTitle"), ctaText: t("explorer.ctaText"),
          all: t("explorer.all"), everything: t("common.all"), advanced: t("ui.advanced"), hospitalsBy: t("explorer.hospitalsBy"),
        }} />
        <p className="mt-10 text-center text-xs text-ink-muted">{t("common.disclaimerMedical")}</p>
      </section>
    </>
  );
}
