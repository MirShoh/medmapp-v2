import { CalendarClock, Hotel, Car, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { seo } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CompareToggle } from "@/components/site/compare";
import { ConsultationForm } from "@/components/site/consultation-form";
import { Block, Bullets } from "@/components/site/detail";
import { Prose } from "@/components/site/section";
import { Link } from "@/i18n/navigation";
import { serverGet, staticSlugs } from "@/lib/server";
import type { PackageCard } from "@/lib/types";
import { cn, date, money } from "@/lib/utils";

type Pk = PackageCard & {
  description: string; excluded: string[]; accommodation: string; transfer: string; additional: string[];
  additional_expenses_note: string; meta_title: string; meta_description: string;
};
type P = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await serverGet<Pk>(`/public/packages/${slug}/`, locale);
  return p ? seo({ locale, path: `/packages/${slug}`, title: p.meta_title || p.name, description: p.meta_description || p.description }) : {};
}

export default async function PackagePage({ params }: P) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const p = await serverGet<Pk>(`/public/packages/${slug}/`, locale);
  if (!p) notFound();
  return (
    <>
      <section className="bg-hero pb-12 pt-28 text-white lg:pt-36">
        <div className="container-x">
          <Link href={`/treatments/${p.treatment.slug}`} className="eyebrow text-teal-300">{p.treatment.name}</Link>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold text-white sm:text-5xl">{p.name}</h1>
          <p className="mt-3 flex items-center gap-1.5 text-white/75"><MapPin className="size-4" />
            <Link href={`/hospitals/${p.hospital.slug}`} className="underline-offset-2 hover:underline">{p.hospital.name}</Link>
            {p.hospital.country && <> · {p.hospital.country.flag} {p.hospital.country.name}</>}
          </p>
        </div>
      </section>
      <div className="container-x grid gap-6 py-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {p.description && <Block title={t("detail.overview")}><Prose text={p.description} /></Block>}
          <div className="grid gap-6 md:grid-cols-2">
            <Block title={t("detail.included")}><Bullets items={p.included} /></Block>
            <Block title={t("detail.excluded")}>
              {p.excluded.length ? <ul className="space-y-2 text-sm text-ink-soft">{p.excluded.map((x) => <li key={x} className="flex gap-2"><span className="text-danger">✕</span>{x}</li>)}</ul>
                : <p className="text-sm text-ink-muted">{t("detail.noInfo")}</p>}
            </Block>
          </div>
          {(p.accommodation || p.transfer) && (
            <div className="grid gap-6 md:grid-cols-2">
              {p.accommodation && <Block title={<span className="flex items-center gap-2"><Hotel className="size-5 text-teal-600" />{t("detail.accommodation")}</span>}><Prose text={p.accommodation} /></Block>}
              {p.transfer && <Block title={<span className="flex items-center gap-2"><Car className="size-5 text-teal-600" />{t("ui.transfer")}</span>}><Prose text={p.transfer} /></Block>}
            </div>
          )}
          {p.additional.length > 0 && <Block title={t("detail.additional")}><Bullets items={p.additional} cols /></Block>}
          {p.additional_expenses_note && <Block title={t("detail.extraCosts")}><Prose text={p.additional_expenses_note} /></Block>}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", p.price_type === "confirmed" ? "bg-success-soft text-success" : "bg-sand-100 text-sand-500")}>
              {p.price_type === "confirmed" ? t("common.confirmed") : t("common.estimate")}
            </span>
            <div className="mt-4 font-display text-4xl font-extrabold text-navy-900">{money(p.price, p.currency, locale)}</div>
            <dl className="mt-4 space-y-2 text-sm">
              {p.duration_days && <div className="flex justify-between"><dt className="text-ink-muted">{t("detail.duration")}</dt><dd className="font-semibold">{p.duration_days} {t("common.days")}</dd></div>}
              {p.hospital_stay_days && <div className="flex justify-between"><dt className="text-ink-muted">{t("detail.hospitalStay")}</dt><dd className="font-semibold">{p.hospital_stay_days} {t("common.days")}</dd></div>}
              {p.valid_until && <div className="flex justify-between"><dt className="flex items-center gap-1 text-ink-muted"><CalendarClock className="size-4" />{t("detail.validUntil")}</dt><dd className="font-semibold">{date(p.valid_until, locale)}</dd></div>}
            </dl>
            <p className="mt-4 text-xs text-ink-muted">{t("common.disclaimerPrice")}</p>
            <CompareToggle kind="packages" item={{ id: p.id, name: p.name }} className="mt-4" />
          </div>
          <div className="card p-5">
            <h2 className="font-display text-lg font-bold">{t("common.requestQuote")}</h2>
            <div className="mt-4"><ConsultationForm compact preset={{ package: p.id, hospital: p.hospital.id, treatment: p.treatment.id }} source="package_page" /></div>
          </div>
        </aside>
      </div>
    </>
  );
}

// Rendered on the first request, then served from the cache and refreshed in the background every 60 s (ISR).
// Without this, every visit re-rendered the page on the server.
export const revalidate = 60;
// Locale comes from the URL, never from cookies/headers, so the page can always be rendered statically.
export const dynamic = "force-static";
export async function generateStaticParams() {
  return staticSlugs("packages");
}
