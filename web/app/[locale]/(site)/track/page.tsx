import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/site/section";
import { TrackRequest } from "@/components/site/second-opinion-form";
import { seo } from "@/lib/seo";

type P = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return seo({ locale, path: "/track", title: t("so.track"), description: t("so.trackHint") });
}

export default async function TrackPage({ params }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <>
      <PageHero eyebrow={t("so.track")} title={t("so.trackTitle")} subtitle={t("so.trackHint")} />
      <section className="py-12 lg:py-16">
        <div className="container-x max-w-xl"><TrackRequest /></div>
      </section>
    </>
  );
}
