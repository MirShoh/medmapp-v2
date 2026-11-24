import type { Metadata } from "next";
import { seo } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/site/section";
import { ToolsHub } from "@/components/site/tools";

type P = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return seo({ locale, path: "/tools", title: t("tools.title"), description: t("tools.subtitle") });
}

export default async function ToolsPage({ params }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <>
      <PageHero eyebrow={t("nav.tools")} title={t("tools.title")} subtitle={t("tools.subtitle")} />
      <section className="container-x py-12"><ToolsHub /></section>
    </>
  );
}
