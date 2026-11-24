import { BadgeCheck, Globe, Mail, MapPin, Phone, Star } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { SITE_URL, absUrl, breadcrumbLd, clip, seo } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DoctorCard, PackageCard } from "@/components/site/cards";
import { CompareToggle } from "@/components/site/compare";
import { ConsultationForm } from "@/components/site/consultation-form";
import { Block, Bullets, KeyFacts, PriceTable } from "@/components/site/detail";
import { Prose } from "@/components/site/section";
import { Link } from "@/i18n/navigation";
import { cardLabels } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { serverGet } from "@/lib/server";
import type { DoctorCard as TD, HospitalCard, PackageCard as TP, Price, TreatmentMini } from "@/lib/types";

type H = HospitalCard & {
  hero_image: string | null; description: string; address: string; latitude: string | null; longitude: string | null;
  website: string; phone: string; email: string; image_source: string; icu_bed_count: number; operating_rooms_count: number;
  infrastructure_details: string; guest_house_details: string; gallery: { id: number; image: string }[];
  accreditations_full: { code: string; name: string; verify_url: string }[]; treatments: TreatmentMini[];
  facilities_list: string[]; equipment_list: string[]; services_list: string[]; languages_list: string[];
  doctors: TD[]; packages: TP[];
  reviews: { id: number; author_name: string; rating: number; text: string; is_verified: boolean; created_at: string }[];
  prices: { legacy: { category: string; procedure_name: string; price: string }[]; published: Price[] };
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

export default async function HospitalPage({ params }: P) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const h = await serverGet<H>(`/public/hospitals/${slug}/`, locale);
  if (!h) notFound();
  const L = { locale, labels: cardLabels(t) };
  const hero = mediaUrl(h.hero_image || h.image);
  const hasMap = h.latitude && h.longitude;
  const tabs: [string, string, number | undefined][] = [
    ["overview", t("detail.overview"), undefined],
    ["treatments", t("detail.treatments"), h.treatments.length],
    ["doctors", t("detail.doctors"), h.doctors.length],
    ["packages", t("detail.packages"), h.packages.length],
    ["facilities", t("detail.facilities"), h.facilities_list.length + h.equipment_list.length],
    ["reviews", t("detail.reviews"), h.reviews.length],
  ];
  const legacyRows = h.prices.legacy.map((p, i) => ({
    id: -i - 1, treatment_name: p.procedure_name, hospital_name: p.category, price_from: p.price, price_to: null, currency: "USD", source: "", updated_on: null,
  }));
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
      }, breadcrumbLd(locale, [["MedMapp", "/"], [t("nav.hospitals"), "/hospitals"], [h.name, `/hospitals/${h.slug}`]])]} />
      <section className="bg-hero relative overflow-hidden pb-12 pt-28 text-white lg:pt-36">
        { }
        {hero && <img src={hero} alt="" className="absolute inset-0 size-full object-cover opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-900/70 to-navy-900/40" />
        {hero && h.image_credit && (
          <a href={h.image_source || undefined} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 right-4 z-10 max-w-[60%] truncate rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/75 backdrop-blur hover:text-white">📷 {h.image_credit}</a>
        )}
        <div className="container-x relative">
          <div className="flex flex-wrap items-center gap-2">
            {h.is_verified
              ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-500 px-2.5 py-1 text-xs font-bold"><BadgeCheck className="size-3.5" />{t("common.verified")}</span>
              : <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">{t("common.notVerified")}</span>}
            {h.accreditations_full.map((a) => <span key={a.code} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/20">{a.code}</span>)}
          </div>
          <div className="mt-4 flex items-center gap-4">
            { }
            {h.logo && <img src={mediaUrl(h.logo)!} alt="" className="size-16 rounded-2xl bg-white object-contain p-2" />}
            <h1 className="font-display text-3xl font-extrabold text-white sm:text-5xl">{h.name}</h1>
          </div>
          {h.city && <p className="mt-3 flex items-center gap-1.5 text-white/75"><MapPin className="size-4" />{h.address || h.city.name}, {h.city.country.flag} {h.city.country.name}</p>}
          {h.rating && <p className="mt-2 flex items-center gap-1 text-sm"><Star className="size-4 fill-sand-400 text-sand-400" />{h.rating.toFixed(1)} · {h.reviews_count} {t("common.reviews")}</p>}
          <div className="mt-8">
            <KeyFacts items={[
              { label: t("list.type"), value: t.has(`htype.${h.hospital_type}`) ? t(`htype.${h.hospital_type}`) : null },
              { label: t("common.founded"), value: h.founded_year }, { label: t("common.beds"), value: h.bed_count },
              { label: t("nav.doctors"), value: h.doctors.length }, { label: t("common.specialty"), value: h.specialties.length },
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
      <div className="container-x grid gap-6 py-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Block title={t("detail.overview")} id="overview">
            {h.description ? <Prose text={h.description} /> : <p className="text-sm text-ink-muted">{h.short_description || t("detail.noInfo")}</p>}
            {h.specialties.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {h.specialties.map((s) => <Link key={s.id} href={`/hospitals?specialty=${s.slug}`} className="chip hover:border-teal-300">{s.title}</Link>)}
              </div>
            )}
          </Block>
          {h.gallery.length > 0 && (
            <Block title={t("detail.gallery")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                { }
                {h.gallery.map((g) => <img key={g.id} src={mediaUrl(g.image)!} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" loading="lazy" />)}
              </div>
            </Block>
          )}
          {h.treatments.length > 0 && (
            <Block title={t("detail.treatments")} id="treatments">
              <div className="grid gap-2 sm:grid-cols-2">
                {h.treatments.map((x) => (
                  <Link key={x.id} href={`/treatments/${x.slug}`} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm font-medium hover:border-teal-300">
                    {x.name}<span className="text-xs text-ink-muted">{x.specialty?.title}</span>
                  </Link>
                ))}
              </div>
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
                    <div className="font-display font-bold">{a.code}</div>
                    <div className="text-xs text-ink-muted">{a.name}</div>
                    {a.verify_url && <a href={a.verify_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-teal-700">{t("ui.verify")} →</a>}
                  </li>
                ))}
              </ul>
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
        </div>
        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <div className="card p-5">
            <h2 className="font-display text-lg font-bold">{t("common.requestQuote")}</h2>
            <div className="mt-4"><ConsultationForm compact preset={{ hospital: h.id }} source="hospital_page" /></div>
          </div>
          {(h.services_list.length > 0 || h.languages_list.length > 0) && (
            <div className="card p-5">
              <h3 className="mb-3 font-display font-bold">{t("detail.services")}</h3>
              <Bullets items={h.services_list} />
              {h.languages_list.length > 0 && <p className="mt-3 text-sm"><span className="text-ink-muted">{t("common.languages")}:</span> {h.languages_list.join(", ")}</p>}
            </div>
          )}
          {(h.phone || h.email || h.website) && (
            <div className="card space-y-2 p-5 text-sm">
              <h3 className="mb-1 font-display font-bold">{t("detail.contacts")}</h3>
              {h.website && <a href={h.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-teal-700"><Globe className="size-4" />{h.website.replace(/^https?:\/\//, "")}</a>}
              {h.phone && <p className="flex items-center gap-2"><Phone className="size-4 text-ink-muted" />{h.phone}</p>}
              {h.email && <p className="flex items-center gap-2"><Mail className="size-4 text-ink-muted" />{h.email}</p>}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
