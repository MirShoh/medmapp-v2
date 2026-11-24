import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { seo } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConsultButton } from "@/components/site/hero-actions";
import { HowSteps } from "@/components/site/how-steps";
import { PageHero } from "@/components/site/section";

type P = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return seo({ locale, path: "/how-it-works", title: t("how.title"), description: t("howPage.subtitle") });
}

type Step = { title: string; you: string; we: string; time: string };
const LABELS = ["modeAbroad", "modeHome", "modeAbroadHint", "modeHomeHint", "you", "we", "time", "step", "prev", "next", "start"] as const;

export default async function HowPage({ params }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const labels = Object.fromEntries(LABELS.map((k) => [k, t(`howPage.${k}`)])) as Record<(typeof LABELS)[number], string>;
  const facts = t.raw("howPage.facts") as string[];
  return (
    <>
      <PageHero eyebrow={t("nav.how")} title={t("how.title")} subtitle={t("howPage.subtitle")} />
      <section className="py-14 lg:py-20">
        <div className="container-x">
          <HowSteps steps={{ abroad: t.raw("howPage.abroad") as Step[], home: t.raw("howPage.home") as Step[] }} labels={labels} />
        </div>
      </section>
      <section className="pb-20">
        <div className="container-x">
          <div className="bg-hero relative grid items-center gap-8 overflow-hidden rounded-[2rem] p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
            <div className="bg-grid pointer-events-none absolute inset-0" />
            <div className="relative">
              <h2 className="font-display text-3xl font-extrabold text-white">{t("howPage.factsTitle")}</h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {facts.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 rounded-2xl bg-white/5 p-4 text-sm font-medium text-white/90 ring-1 ring-white/10">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-400" />{f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative text-center lg:text-right">
              <p className="text-lg text-white/75">{t("contact.subtitle")}</p>
              <ConsultButton size="lg" icon className="mt-5" source="how_it_works" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
