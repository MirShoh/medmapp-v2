import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { absUrl, breadcrumbLd, clip, faqLd, seo } from "@/lib/seo";
import { mediaUrl } from "@/lib/media";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DoctorCard, HospitalCard, PackageCard, TreatmentCard } from "@/components/site/cards";
import { CompareBar } from "@/components/site/compare";
import { ConsultationForm } from "@/components/site/consultation-form";
import { Block, KeyFacts, PriceTable } from "@/components/site/detail";
import { Faq, Prose } from "@/components/site/section";
import { Link } from "@/i18n/navigation";
import { cardLabels } from "@/lib/labels";
import { serverGet } from "@/lib/server";
import type { Country, DoctorCard as TD, FAQ, HospitalCard as TH, PackageCard as TP, Price, Treatment } from "@/lib/types";
import { money } from "@/lib/utils";

type T = Treatment & {
  overview: string; treatment_info: string; preparation: string; recovery_info: string; meta_title: string; meta_description: string;
  hospitals: TH[]; doctors: TD[]; packages: TP[]; prices: Price[]; countries: Country[]; faqs: FAQ[]; related: Treatment[];
};
type P = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });
  const x = await serverGet<T>(`/public/treatments/${slug}/`, locale);
  return x ? seo({ locale, path: `/treatments/${slug}`, title: x.meta_title || t("meta.treatmentTitle", { name: x.name }),
    description: x.meta_description || x.short_description || x.overview || t("meta.treatmentDescription", { name: x.name }), image: mediaUrl(x.image) }) : {};
}

export default async function TreatmentPage({ params }: P) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const x = await serverGet<T>(`/public/treatments/${slug}/`, locale);
  if (!x) notFound();
  const L = { locale, labels: cardLabels(t) };
  return (
    <>
      <JsonLd data={[{
        "@context": "https://schema.org", "@type": "MedicalProcedure", name: x.name, url: absUrl(locale, `/treatments/${x.slug}`),
        description: clip(x.short_description || x.overview, 300) || undefined, preparation: clip(x.preparation, 500) || undefined,
        followup: clip(x.recovery_info, 500) || undefined,
      }, breadcrumbLd(locale, [["MedMapp", "/"], [t("nav.treatments"), "/treatments"], [x.name, `/treatments/${x.slug}`]]), faqLd(x.faqs)]} />
      <section className="bg-hero relative overflow-hidden pb-12 pt-28 text-white lg:pt-36">
        {x.image && <img src={mediaUrl(x.image)!} alt="" className="absolute inset-0 size-full object-cover opacity-35" fetchPriority="high" />}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-900/75 to-navy-900/40" />
        <div className="container-x relative">
          <Link href={`/treatments?specialty=${x.specialty.slug}`} className="eyebrow text-teal-300">{x.specialty.title}</Link>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold text-white sm:text-5xl">{x.name}</h1>
          {x.short_description && <p className="mt-4 max-w-2xl text-lg text-white/70">{x.short_description}</p>}
          <div className="mt-8 max-w-3xl">
            <KeyFacts items={[
              { label: t("common.from"), value: x.price_from_usd ? money(x.price_from_usd, "USD", locale) : null },
              { label: t("detail.duration"), value: x.duration_days ? `${x.duration_days} ${t("common.days")}` : null },
              { label: t("nav.hospitals"), value: x.hospitals_count },
              { label: t("nav.destinations"), value: x.countries.length },
            ]} />
          </div>
        </div>
      </section>
      <div className="container-x grid gap-6 py-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Block title={t("detail.overview")}>{x.overview ? <Prose text={x.overview} /> : <p className="text-sm text-ink-muted">{t("detail.noInfo")}</p>}</Block>
          {x.treatment_info && <Block title={t("detail.aboutTreatment")}><Prose text={x.treatment_info} /></Block>}
          {x.prices.length > 0 && (
            <Block title={t("detail.countryOptions")}>
              <PriceTable rows={x.prices} locale={locale} labels={{ source: t("common.source"), updated: t("common.updated") }} />
              <p className="mt-3 text-xs text-ink-muted">{t("common.disclaimerPrice")}</p>
            </Block>
          )}
          {x.preparation && <Block title={t("detail.preparation")}><Prose text={x.preparation} /></Block>}
          {x.recovery_info && <Block title={t("detail.recovery")}><Prose text={x.recovery_info} /></Block>}
          {x.hospitals.length > 0 && <Block title={t("nav.hospitals")}><div className="grid gap-4 sm:grid-cols-2">{x.hospitals.map((h) => <HospitalCard key={h.id} h={h} {...L} />)}</div></Block>}
          {x.doctors.length > 0 && <Block title={t("detail.doctors")}><div className="grid gap-3 md:grid-cols-2">{x.doctors.map((d) => <DoctorCard key={d.id} d={d} {...L} />)}</div></Block>}
          {x.packages.length > 0 && <Block title={t("detail.packages")}><div className="grid gap-4 md:grid-cols-2">{x.packages.map((p) => <PackageCard key={p.id} p={p} {...L} />)}</div></Block>}
          {x.faqs.length > 0 && <div><h2 className="mb-4 font-display text-xl font-bold">{t("detail.faq")}</h2><Faq items={x.faqs} /></div>}
          {x.related.length > 0 && (
            <div>
              <h2 className="mb-4 font-display text-xl font-bold">{t("detail.related")}</h2>
              <div className="grid gap-4 sm:grid-cols-3">{x.related.map((r) => <TreatmentCard key={r.id} t={r} {...L} />)}</div>
            </div>
          )}
          <p className="text-xs text-ink-muted">{t("common.disclaimerMedical")}</p>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="font-display text-lg font-bold">{t("common.requestQuote")}</h2>
            <div className="mt-4"><ConsultationForm compact preset={{ treatment: x.id, specialty: x.specialty.id }} source="treatment_page" /></div>
          </div>
        </aside>
      </div>
      <CompareBar kind="hospitals" />
    </>
  );
}
