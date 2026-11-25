import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { absUrl, breadcrumbLd, faqLd, seo } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DoctorCard, HospitalCard, PackageCard, TreatmentCard } from "@/components/site/cards";
import { CompareBar } from "@/components/site/compare";
import { ConsultationForm } from "@/components/site/consultation-form";
import { Block, KeyFacts, PriceTable } from "@/components/site/detail";
import { Faq, Prose } from "@/components/site/section";
import { cardLabels } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { serverGet } from "@/lib/server";
import type { CountryCard, DoctorCard as TD, FAQ, HospitalCard as TH, PackageCard as TP, Price, Treatment } from "@/lib/types";
import { date } from "@/lib/utils";

type C = CountryCard & {
  intro: string; medical_overview: string; travel_info: string; visa_info: string; visa_info_source: string; visa_info_updated: string | null;
  accommodation_info: string; patient_journey: string; meta_title: string; meta_description: string;
  hospitals: TH[]; doctors: TD[]; treatments: Treatment[]; prices: Price[]; packages: TP[]; faqs: FAQ[]; cities: { id: number; name: string }[];
};
type P = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });
  const c = await serverGet<C>(`/public/destinations/${slug}/`, locale);
  return c ? seo({ locale, path: `/destinations/${slug}`, title: c.meta_title || t("meta.countryTitle", { name: c.name }),
    description: c.meta_description || c.intro || c.tagline || t("meta.countryDescription", { name: c.name }), image: mediaUrl(c.hero_image) }) : {};
}

function Text({ v, empty }: { v?: string; empty: string }) {
  return v ? <Prose text={v} /> : <p className="text-sm text-ink-muted">{empty}</p>;
}

export default async function DestinationPage({ params }: P) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const c = await serverGet<C>(`/public/destinations/${slug}/`, locale);
  if (!c) notFound();
  const L = { locale, labels: cardLabels(t) };
  const hero = mediaUrl(c.hero_image);
  const none = t("detail.noInfo");
  const nav = [["intro", t("detail.intro")], ["hospitals", t("nav.hospitals")], ["treatments", t("detail.treatments")], ["travel", t("detail.travel")], ["visa", t("detail.visa")], ["consult", t("nav.consult")]];
  return (
    <>
      <JsonLd data={[breadcrumbLd(locale, [["MedMapp", "/"], [t("nav.destinations"), "/destinations"], [c.name, `/destinations/${c.slug}`]]),
        c.hospitals.length ? { "@context": "https://schema.org", "@type": "ItemList", name: c.name,
          itemListElement: c.hospitals.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: absUrl(locale, `/hospitals/${x.slug}`), name: x.name })) } : null,
        faqLd(c.faqs)]} />
      <section className="bg-hero relative overflow-hidden pb-12 pt-28 text-white lg:pt-36">
        { }
        {hero && <img src={hero} alt={c.name} data-credit={c.hero_image_credit || undefined} data-source={c.hero_image_source || undefined} className="absolute inset-0 size-full object-cover opacity-55" fetchPriority="high" />}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-900/60 to-transparent" />
        <div className="container-x relative">
          <div className="text-6xl">{c.flag}</div>
          <h1 className="mt-3 font-display text-4xl font-extrabold text-white sm:text-6xl">{c.name}</h1>
          {c.tagline && <p className="mt-3 max-w-2xl text-lg text-white/75">{c.tagline}</p>}
          <div className="mt-8 max-w-3xl">
            <KeyFacts items={[
              { label: t("nav.hospitals"), value: c.hospitals_count }, { label: t("nav.doctors"), value: c.doctors_count },
              { label: t("detail.treatments"), value: c.treatments.length }, { label: t("common.languages"), value: c.languages },
            ]} />
          </div>
        </div>
      </section>
      <nav className="sticky top-16 z-30 border-b border-line bg-white/90 backdrop-blur lg:top-[72px]">
        <div className="container-x scrollbar-thin flex gap-1 overflow-x-auto py-2">
          {nav.map(([id, label]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-mist hover:text-navy-900">{label}</a>)}
        </div>
      </nav>
      <div className="container-x space-y-6 py-10">
        <div className="grid gap-6 lg:grid-cols-2">
          <Block title={t("detail.intro")} id="intro"><Text v={c.intro} empty={none} /></Block>
          <Block title={t("detail.medicalOverview")}><Text v={c.medical_overview} empty={none} /></Block>
        </div>
        <section id="hospitals" className="scroll-mt-32">
          <h2 className="mb-5 font-display text-2xl font-bold">{t("nav.hospitals")}</h2>
          {c.hospitals.length
            ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{c.hospitals.map((h) => <HospitalCard key={h.id} h={h} {...L} />)}</div>
            : <p className="rounded-2xl bg-white p-6 text-sm text-ink-muted">{t("home.emptyCatalog")}</p>}
        </section>
        {c.doctors.length > 0 && (
          <section>
            <h2 className="mb-5 font-display text-2xl font-bold">{t("detail.doctors")}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{c.doctors.map((d) => <DoctorCard key={d.id} d={d} {...L} />)}</div>
          </section>
        )}
        {c.treatments.length > 0 && (
          <section id="treatments" className="scroll-mt-32">
            <h2 className="mb-5 font-display text-2xl font-bold">{t("detail.treatments")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{c.treatments.map((x) => <TreatmentCard key={x.id} t={x} {...L} />)}</div>
          </section>
        )}
        {c.prices.length > 0 && (
          <Block title={t("detail.prices")}>
            <PriceTable rows={c.prices} locale={locale} labels={{ source: t("common.source"), updated: t("common.updated") }} />
            <p className="mt-3 text-xs text-ink-muted">{t("common.disclaimerPrice")}</p>
          </Block>
        )}
        {c.packages.length > 0 && (
          <section>
            <h2 className="mb-5 font-display text-2xl font-bold">{t("detail.packages")}</h2>
            <div className="grid gap-5 md:grid-cols-3">{c.packages.map((p) => <PackageCard key={p.id} p={p} {...L} />)}</div>
          </section>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          <Block title={t("detail.travel")} id="travel"><Text v={c.travel_info} empty={none} /></Block>
          <Block title={t("detail.visa")} id="visa">
            <Text v={c.visa_info} empty={none} />
            <p className="mt-4 flex gap-2 rounded-xl bg-warning-soft p-3 text-xs text-warning"><AlertTriangle className="size-4 shrink-0" />{t("detail.visaNote")}</p>
            {(c.visa_info_source || c.visa_info_updated) && (
              <p className="mt-2 text-[11px] text-ink-muted">
                {c.visa_info_source && <a href={c.visa_info_source} target="_blank" rel="noopener noreferrer" className="underline">{t("common.source")}</a>}
                {c.visa_info_updated && ` · ${t("common.updated")} ${date(c.visa_info_updated, locale)}`}
              </p>
            )}
          </Block>
          <Block title={t("detail.accommodation")}><Text v={c.accommodation_info} empty={none} /></Block>
        </div>
        {c.patient_journey && <Block title={t("detail.journey")}><Prose text={c.patient_journey} /></Block>}
        {c.faqs.length > 0 && <div><h2 className="mb-4 font-display text-2xl font-bold">{t("detail.faq")}</h2><Faq items={c.faqs} /></div>}
        <section id="consult" className="scroll-mt-32 rounded-3xl bg-navy-900 p-6 sm:p-10">
          <h2 className="font-display text-2xl font-extrabold text-white">{t("contact.title")} · {c.flag} {c.name}</h2>
          <p className="mt-2 text-sm text-white/65">{t("contact.subtitle")}</p>
          <div className="mt-6 rounded-2xl bg-white p-5"><ConsultationForm preset={{ destination: c.id }} source="destination_page" /></div>
        </section>
      </div>
      <CompareBar kind="hospitals" />
    </>
  );
}
