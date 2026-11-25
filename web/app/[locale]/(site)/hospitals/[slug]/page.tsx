import { ArrowRight, Award, BadgeCheck, Building2, CalendarDays, CheckCircle2, ClipboardList, FileText, Globe, HeartPulse, Home, Languages, Mail, MapPin, Phone, Plane, Star, Stethoscope, Users } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { SITE_URL, absUrl, breadcrumbLd, clip, faqLd, seo } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DoctorCard, HospitalCard as HospitalCardView, PackageCard } from "@/components/site/cards";
import { CompareToggle } from "@/components/site/compare";
import { ConsultationForm } from "@/components/site/consultation-form";
import { Block, Bullets, KeyFacts, PriceTable } from "@/components/site/detail";
import { Icon } from "@/components/site/icon";
import { Faq, Prose } from "@/components/site/section";
import { Link } from "@/i18n/navigation";
import { cardLabels } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { serverGet, staticSlugs } from "@/lib/server";
import type { DoctorCard as TD, HospitalCard, PackageCard as TP, Price, TreatmentMini } from "@/lib/types";
import { money } from "@/lib/utils";

type CountryInfo = {
  name: string; slug: string; flag: string; tagline: string; languages: string; is_destination: boolean;
  intro: string; visa_info: string; travel_info: string; accommodation_info: string; hospitals_count: number;
};
type H = HospitalCard & {
  hero_image: string | null; description: string; address: string; latitude: string | null; longitude: string | null;
  website: string; phone: string; email: string; image_source: string; icu_bed_count: number; operating_rooms_count: number;
  infrastructure_details: string; guest_house_details: string; gallery: { id: number; image: string }[];
  accreditations_full: { code: string; name: string; verify_url: string }[]; treatments: TreatmentMini[];
  facilities_list: string[]; equipment_list: string[]; services_list: string[]; languages_list: string[];
  doctors: TD[]; packages: TP[];
  reviews: { id: number; author_name: string; rating: number; text: string; is_verified: boolean; created_at: string }[];
  prices: { legacy: { category: string; procedure_name: string; price: string }[]; published: Price[] };
  country_prices: Record<string, { price_from: number; price_to: number | null; currency: string }>;
  country: CountryInfo | null; similar: HospitalCard[];
  meta_title: string; meta_description: string;
};
type P = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = await serverGet<H>(`/public/hospitals/${slug}/`, locale);
  if (!h) return {};
  // "Name — City, Country", without repeating a city the name already contains.
  const where = h.city ? (h.name.includes(h.city.name.split(" ")[0]) ? h.city.country.name : `${h.city.name}, ${h.city.country.name}`) : "";
  return seo({ locale, path: `/hospitals/${slug}`, title: h.meta_title || (where ? `${h.name} — ${where}` : h.name),
    description: h.meta_description || h.short_description || h.description, image: mediaUrl(h.image) });
}

/** A description is "thin" when it only repeats the one-line summary; then the page writes a factual intro itself. */
function isThin(h: H) {
  const plain = (h.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length < 160 || plain === (h.short_description || "").trim();
}

export default async function HospitalPage({ params }: P) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const h = await serverGet<H>(`/public/hospitals/${slug}/`, locale);
  if (!h) notFound();
  const L = { locale, labels: cardLabels(t) };
  const hero = mediaUrl(h.hero_image || h.image);
  const hasMap = h.latitude && h.longitude;
  const country = h.country;
  const place = h.city ? `${h.city.name}, ${h.city.country.name}` : "";
  const kind = t.has(`hp.kind.${h.hospital_type}`) ? t(`hp.kind.${h.hospital_type}`) : t("hp.kind.clinic");
  const accr = h.accreditations_full.map((a) => a.code).join(", ");
  const thisYear = new Date().getFullYear();
  const years = h.founded_year ? Math.floor((thisYear - h.founded_year) / 10) * 10 : 0;

  // treatments grouped by specialty, each with the indicative country price when one is published
  const groups = new Map<string, { title: string; slug: string; icon?: string; items: TreatmentMini[] }>();
  for (const x of h.treatments) {
    const key = x.specialty?.slug || "other";
    if (!groups.has(key)) groups.set(key, { title: x.specialty?.title || "", slug: key, icon: x.specialty?.icon, items: [] });
    groups.get(key)!.items.push(x);
  }
  const hasCountryPrices = Object.keys(h.country_prices || {}).length > 0;

  const why = [
    accr && t("hp.whyAccredited", { list: accr }),
    h.hospital_type === "university" && t("hp.whyUniversity"),
    h.hospital_type === "specialty" && t("hp.whySpecialty"),
    h.specialties.length >= 5 && t("hp.whyMulti", { n: h.specialties.length }),
    years >= 10 && t("hp.whyFounded", { years }),
    h.doctors.length > 0 && t("hp.whyDoctors", { n: h.doctors.length }),
    h.is_popular && t("hp.whyPopular"),
    country?.travel_info && t("hp.whyTravel", { country: country.name, text: clip(country.travel_info, 140) }),
  ].filter(Boolean) as string[];

  const faqs = [
    { id: 1, question: t("hp.q1"), answer: t("hp.a1", { name: h.name }) },
    { id: 2, question: t("hp.q2"), answer: t("hp.a2") },
    ...(country ? [{ id: 3, question: t("hp.q3", { country: country.name }), answer: country.visa_info || t("hp.a3") }] : []),
    { id: 4, question: t("hp.q4"), answer: t("hp.a4") },
    { id: 5, question: t("hp.q5"), answer: t("hp.a5") },
  ];

  const tabs: [string, string, number | undefined][] = [
    ["overview", t("detail.overview"), undefined],
    ["treatments", t("detail.treatments"), h.treatments.length],
    ["doctors", t("detail.doctors"), h.doctors.length],
    ["packages", t("detail.packages"), h.packages.length],
    ["journey", t("hp.journey"), undefined],
    ["facilities", t("detail.facilities"), h.facilities_list.length + h.equipment_list.length],
    ["reviews", t("detail.reviews"), h.reviews.length],
    ["faq", t("hp.faq"), undefined],
  ];
  const legacyRows = h.prices.legacy.map((p, i) => ({
    id: -i - 1, treatment_name: p.procedure_name, hospital_name: p.category, price_from: p.price, price_to: null, currency: "USD", source: "", updated_on: null,
  }));
  const glance: { icon: typeof Building2; label: string; value: React.ReactNode }[] = [
    { icon: Building2, label: t("hp.type"), value: kind.charAt(0).toUpperCase() + kind.slice(1) },
    { icon: MapPin, label: t("hp.location"), value: h.city ? <>{h.city.country.flag} {place}</> : null },
    { icon: CalendarDays, label: t("hp.founded"), value: h.founded_year },
    { icon: HeartPulse, label: t("hp.specialties"), value: h.specialties.length || null },
    { icon: Stethoscope, label: t("hp.treatments"), value: h.treatments.length || null },
    { icon: Users, label: t("hp.doctors"), value: h.doctors.length || null },
    { icon: Award, label: t("hp.accreditations"), value: accr || null },
    { icon: Languages, label: t("hp.languages"), value: h.languages_list.join(", ") || country?.languages || null },
    { icon: Globe, label: t("hp.website"), value: h.website ? <a href={h.website} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">{h.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a> : null },
  ].filter((r) => r.value !== null && r.value !== undefined && r.value !== "");
  const steps = [
    { icon: FileText, title: t("hp.s1"), text: t("hp.s1t") },
    { icon: ClipboardList, title: t("hp.s2"), text: t("hp.s2t") },
    { icon: Plane, title: t("hp.s3"), text: t("hp.s3t") },
    { icon: Stethoscope, title: t("hp.s4"), text: t("hp.s4t") },
    { icon: Home, title: t("hp.s5"), text: t("hp.s5t") },
  ];
  const sameCity = h.similar.length > 0 && h.similar.every((s) => s.city?.id === h.city?.id);

  return (
    <>
      <JsonLd data={[{
        "@context": "https://schema.org", "@type": ["Hospital", "MedicalOrganization"], "@id": `${absUrl(locale, `/hospitals/${h.slug}`)}#hospital`,
        name: h.name, url: absUrl(locale, `/hospitals/${h.slug}`), description: clip(h.short_description || h.description, 300) || undefined,
        image: h.image ? `${SITE_URL}${mediaUrl(h.image)}` : undefined, logo: h.logo ? `${SITE_URL}${mediaUrl(h.logo)}` : undefined,
        foundingDate: h.founded_year ? String(h.founded_year) : undefined, sameAs: h.website || undefined, telephone: h.phone || undefined,
        address: h.city ? { "@type": "PostalAddress", streetAddress: h.address || undefined, addressLocality: h.city.name, addressCountry: h.city.country.iso_code || h.city.country.name } : undefined,
        geo: h.latitude && h.longitude ? { "@type": "GeoCoordinates", latitude: Number(h.latitude), longitude: Number(h.longitude) } : undefined,
        medicalSpecialty: h.specialties.map((s) => s.title),
        availableService: h.treatments.slice(0, 20).map((x) => ({ "@type": "MedicalProcedure", name: x.name })),
        aggregateRating: h.rating && h.reviews_count ? { "@type": "AggregateRating", ratingValue: h.rating, reviewCount: h.reviews_count, bestRating: 5 } : undefined,
      }, breadcrumbLd(locale, [["MedMapp", "/"], [t("nav.hospitals"), "/hospitals"], [h.name, `/hospitals/${h.slug}`]]), faqLd(faqs)]} />
      <section className="bg-hero relative overflow-hidden pb-12 pt-28 text-white lg:pt-36">
        {hero && <img src={hero} alt="" data-credit={h.image_credit || undefined} data-source={h.image_source || undefined} className="absolute inset-0 size-full object-cover opacity-40" fetchPriority="high" />}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-900/70 to-navy-900/40" />
        <div className="container-x relative">
          <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-white/60" aria-label="Breadcrumb">
            <Link href="/hospitals" className="hover:text-white">{t("nav.hospitals")}</Link>
            {country?.slug && <><span>/</span><Link href={`/hospitals?country=${country.slug}`} className="hover:text-white">{country.name}</Link></>}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            {h.is_verified
              ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-500 px-2.5 py-1 text-xs font-bold"><BadgeCheck className="size-3.5" />{t("common.verified")}</span>
              : <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">{t("common.notVerified")}</span>}
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/20">{kind}</span>
            {h.accreditations_full.map((a) => <span key={a.code} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/20">{a.code}</span>)}
          </div>
          <div className="mt-4 flex items-center gap-4">
            {h.logo && <img src={mediaUrl(h.logo)!} alt="" className="size-16 rounded-2xl bg-white object-contain p-2" />}
            <h1 className="font-display text-3xl font-extrabold text-white sm:text-5xl">{h.name}</h1>
          </div>
          {h.city && <p className="mt-3 flex items-center gap-1.5 text-white/75"><MapPin className="size-4 shrink-0" />{h.address || h.city.name}, {h.city.country.flag} {h.city.country.name}</p>}
          {h.short_description && <p className="mt-3 max-w-2xl text-white/80">{h.short_description}</p>}
          {h.rating && <p className="mt-2 flex items-center gap-1 text-sm"><Star className="size-4 fill-sand-400 text-sand-400" />{h.rating.toFixed(1)} · {h.reviews_count} {t("common.reviews")}</p>}
          <div className="mt-8">
            <KeyFacts items={[
              { label: t("common.founded"), value: h.founded_year }, { label: t("common.beds"), value: h.bed_count },
              { label: t("nav.doctors"), value: h.doctors.length }, { label: t("common.specialty"), value: h.specialties.length },
              { label: t("detail.treatments"), value: h.treatments.length },
              { label: "ICU", value: h.icu_bed_count }, { label: "OR", value: h.operating_rooms_count },
            ]} />
          </div>
        </div>
      </section>
      <nav className="sticky top-16 z-30 border-b border-line bg-white/90 backdrop-blur lg:top-[72px]">
        <div className="container-x scrollbar-thin flex items-center gap-1 overflow-x-auto py-2">
          {tabs.filter(([, , n]) => n === undefined || n > 0).map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-mist hover:text-navy-900">{label}</a>
          ))}
          <span className="ml-auto shrink-0"><CompareToggle kind="hospitals" item={{ id: h.id, name: h.name }} /></span>
        </div>
      </nav>
      <div className="container-x grid grid-cols-[minmax(0,1fr)] gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Block title={t("hp.about")} id="overview">
            {isThin(h) ? (
              <div className="space-y-3 text-[15px] leading-relaxed text-ink">
                <p>{t("hp.autoIntro", { name: h.name, place, type: kind, specialties: h.specialties.length, treatments: h.treatments.length })}</p>
                {h.short_description && <p>{h.short_description}</p>}
                {(h.founded_year || accr) && (
                  <p>{h.founded_year ? t("hp.autoFounded", { year: h.founded_year }) : ""} {accr ? t("hp.autoAccredited", { list: accr }) : ""}</p>
                )}
                {h.description && h.description !== h.short_description && <Prose text={h.description} />}
                <p className="text-sm text-ink-muted">{t("hp.noDescription")}</p>
              </div>
            ) : <Prose text={h.description} />}
            {h.specialties.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {h.specialties.map((s) => <Link key={s.id} href={`/hospitals?specialty=${s.slug}`} className="chip hover:border-teal-300">{s.title}</Link>)}
              </div>
            )}
          </Block>

          {why.length > 0 && (
            <Block title={t("hp.why")}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {why.map((w) => (
                  <li key={w} className="flex gap-3 rounded-xl bg-mist p-4 text-sm leading-relaxed text-ink">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-500" />{w}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {h.gallery.length > 0 && (
            <Block title={t("detail.gallery")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {h.gallery.map((g) => <img key={g.id} src={mediaUrl(g.image)!} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" loading="lazy" />)}
              </div>
            </Block>
          )}

          {h.treatments.length > 0 && (
            <Block title={t("hp.bySpecialty")} id="treatments">
              <div className="space-y-5">
                {[...groups.values()].map((g) => (
                  <div key={g.slug}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-900">
                      <span className="grid size-7 place-items-center rounded-lg bg-teal-50 text-teal-600"><Icon name={g.icon} className="size-4" /></span>{g.title}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {g.items.map((x) => {
                        const p = h.country_prices?.[String(x.id)];
                        return (
                          <Link key={x.id} href={`/treatments/${x.slug}`} className="group flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm transition hover:border-teal-300 hover:bg-teal-50/40">
                            <span className="min-w-0 font-medium text-navy-900 group-hover:text-teal-700">{x.name}</span>
                            {p ? <span className="shrink-0 text-xs font-semibold text-navy-900">{t("hp.from", { price: money(p.price_from, p.currency, locale) })}</span>
                              : <ArrowRight className="size-4 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-teal-600" />}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {hasCountryPrices && country && <p className="mt-4 text-xs text-ink-muted">{t("hp.countryPriceNote", { country: country.name })}</p>}
            </Block>
          )}

          {(h.prices.published.length > 0 || legacyRows.length > 0) && (
            <Block title={t("detail.prices")}>
              <PriceTable rows={[...h.prices.published, ...legacyRows]} locale={locale} labels={{ source: t("common.source"), updated: t("common.updated") }} />
              <p className="mt-3 text-xs text-ink-muted">{t("common.disclaimerPrice")}</p>
            </Block>
          )}
          {h.doctors.length > 0 && <Block title={t("detail.doctors")} id="doctors"><div className="grid gap-3 md:grid-cols-2">{h.doctors.map((d) => <DoctorCard key={d.id} d={d} {...L} />)}</div></Block>}
          {h.packages.length > 0 && <Block title={t("detail.packages")} id="packages"><div className="grid gap-4 md:grid-cols-2">{h.packages.map((p) => <PackageCard key={p.id} p={p} {...L} />)}</div></Block>}

          <Block title={t("hp.journey")} id="journey">
            <ol className="relative space-y-5 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-px before:bg-line">
              {steps.map((s, i) => (
                <li key={s.title} className="relative flex gap-4">
                  <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full bg-teal-500 text-white ring-4 ring-white"><s.icon className="size-5" /></span>
                  <div className="min-w-0 pt-1">
                    <p className="font-display font-bold text-navy-900"><span className="mr-1.5 text-teal-600">{i + 1}.</span>{s.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Block>

          {(h.facilities_list.length > 0 || h.equipment_list.length > 0 || h.infrastructure_details) && (
            <Block title={t("detail.facilities")} id="facilities">
              <Bullets items={h.facilities_list} cols />
              {h.equipment_list.length > 0 && <><h3 className="mb-3 mt-6 font-display font-bold">{t("detail.equipment")}</h3><Bullets items={h.equipment_list} cols /></>}
              {h.infrastructure_details && <div className="mt-5"><Prose text={h.infrastructure_details} /></div>}
            </Block>
          )}
          {h.accreditations_full.length > 0 && (
            <Block title={t("detail.accreditations")}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {h.accreditations_full.map((a) => (
                  <li key={a.code} className="rounded-xl border border-line p-4">
                    <div className="flex items-center gap-2 font-display font-bold"><Award className="size-4 text-teal-600" />{a.code}</div>
                    <div className="mt-1 text-xs text-ink-muted">{a.name}</div>
                    {a.verify_url && <a href={a.verify_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-teal-700">{t("ui.verify")} →</a>}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {country && (country.visa_info || country.travel_info || country.intro) && (
            <Block title={<>{country.flag} {t("hp.trip", { country: country.name })}</>}>
              {country.intro && <p className="text-sm leading-relaxed text-ink">{country.intro}</p>}
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {country.visa_info && <div className="rounded-xl bg-mist p-4"><dt className="text-xs font-bold uppercase tracking-wide text-teal-700">{t("hp.visa")}</dt><dd className="mt-1 text-sm leading-relaxed text-ink">{country.visa_info}</dd></div>}
                {country.travel_info && <div className="rounded-xl bg-mist p-4"><dt className="text-xs font-bold uppercase tracking-wide text-teal-700">{t("hp.travel")}</dt><dd className="mt-1 text-sm leading-relaxed text-ink">{country.travel_info}</dd></div>}
                {country.languages && <div className="rounded-xl bg-mist p-4"><dt className="text-xs font-bold uppercase tracking-wide text-teal-700">{t("hp.langs")}</dt><dd className="mt-1 text-sm text-ink">{country.languages}</dd></div>}
              </dl>
              {country.is_destination && country.slug && (
                <Link href={`/destinations/${country.slug}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
                  {t("hp.aboutCountry", { country: country.name })}<ArrowRight className="size-4" />
                </Link>
              )}
            </Block>
          )}

          {h.reviews.length > 0 && (
            <Block title={t("detail.reviews")} id="reviews">
              <div className="space-y-4">
                {h.reviews.map((r) => (
                  <div key={r.id} className="border-b border-line pb-4 last:border-0">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {r.author_name}{r.is_verified && <BadgeCheck className="size-4 text-teal-500" />}
                      <span className="ml-auto flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-3.5 fill-sand-400 text-sand-400" />)}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{r.text}</p>
                  </div>
                ))}
              </div>
            </Block>
          )}
          {hasMap && (
            <Block title={t("detail.location")}>
              <iframe title="map" className="h-72 w-full rounded-xl border-0" loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(h.longitude) - 0.01},${Number(h.latitude) - 0.01},${Number(h.longitude) + 0.01},${Number(h.latitude) + 0.01}&marker=${h.latitude},${h.longitude}`} />
            </Block>
          )}
          <section id="faq" className="scroll-mt-32">
            <h2 className="mb-4 font-display text-xl font-bold text-navy-900">{t("hp.faq")}</h2>
            <Faq items={faqs} />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <div id="quote" className="card scroll-mt-32 p-5">
            <h2 className="font-display text-lg font-bold">{t("common.requestQuote")}</h2>
            <div className="mt-4"><ConsultationForm compact preset={{ hospital: h.id }} source="hospital_page" /></div>
          </div>
          {glance.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 font-display font-bold">{t("hp.atGlance")}</h3>
              <dl className="divide-y divide-line text-sm">
                {glance.map((g) => (
                  <div key={g.label} className="flex items-start gap-3 py-2.5">
                    <g.icon className="mt-0.5 size-4 shrink-0 text-teal-600" />
                    <dt className="w-28 shrink-0 text-ink-muted">{g.label}</dt>
                    <dd className="min-w-0 break-words font-medium text-navy-900">{g.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {(h.services_list.length > 0 || h.languages_list.length > 0) && (
            <div className="card p-5">
              <h3 className="mb-3 font-display font-bold">{t("detail.services")}</h3>
              <Bullets items={h.services_list} />
              {h.languages_list.length > 0 && <p className="mt-3 text-sm"><span className="text-ink-muted">{t("common.languages")}:</span> {h.languages_list.join(", ")}</p>}
            </div>
          )}
          {(h.phone || h.email) && (
            <div className="card space-y-2 p-5 text-sm">
              <h3 className="mb-1 font-display font-bold">{t("detail.contacts")}</h3>
              {h.phone && <p className="flex items-center gap-2"><Phone className="size-4 text-ink-muted" />{h.phone}</p>}
              {h.email && <p className="flex items-center gap-2"><Mail className="size-4 text-ink-muted" />{h.email}</p>}
            </div>
          )}
        </aside>
      </div>

      {h.similar.length > 0 && (
        <section className="bg-soft border-t border-line py-12">
          <div className="container-x">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-extrabold text-navy-900">
                {sameCity && h.city ? t("hp.similarCity", { city: h.city.name }) : t("hp.similarCountry", { country: country?.name || "" })}
              </h2>
              {country?.slug && <Link href={`/hospitals?country=${country.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">{t("hp.seeAll")}{country.hospitals_count ? ` (${country.hospitals_count})` : ""}<ArrowRight className="size-4" /></Link>}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {h.similar.map((s) => <HospitalCardView key={s.id} h={s} {...L} />)}
            </div>
          </div>
        </section>
      )}

      {/* phone: the quote form sits far below, so keep one tap to it */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 p-3 backdrop-blur lg:hidden">
        <a href="#quote" className="flex items-center justify-center gap-2 rounded-xl bg-green-500 py-3 text-sm font-bold text-white">{t("hp.getQuote")}<ArrowRight className="size-4" /></a>
      </div>
      <div className="h-16 lg:hidden" />
    </>
  );
}

// Rendered on the first request, then served from the cache and refreshed in the background every 60 s (ISR).
// Without this, every visit re-rendered the page on the server.
export const revalidate = 60;
// Locale comes from the URL, never from cookies/headers, so the page can always be rendered statically.
export const dynamic = "force-static";
export async function generateStaticParams() {
  return staticSlugs("hospitals");
}
