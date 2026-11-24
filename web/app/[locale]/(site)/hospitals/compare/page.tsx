import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { HospitalCompare } from "@/components/site/compare-view";
import { PageHero } from "@/components/site/section";

export default async function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <>
      <PageHero eyebrow={t("common.compare")} title={t("compare.title")} />
      <section className="container-x py-12"><Suspense><HospitalCompare /></Suspense></section>
    </>
  );
}
