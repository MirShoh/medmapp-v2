"use client";

import { BadgeCheck, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Empty, LoadingBlock } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";
import { readCompare } from "./compare";

type Row<T> = { label: string; render: (x: T) => ReactNode };

function useIds(kind: string) {
  const sp = useSearchParams();
  const fromUrl = (sp.get("ids") || "").split(",").filter(Boolean);
  const [ids, setIds] = useState<string[]>(fromUrl);
  useEffect(() => {
    if (!fromUrl.length) setIds(readCompare(kind).map((i) => String(i.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ids;
}

function Table<T extends { id: number; name: string; slug: string }>({ items, rows, base, onRemove }: { items: T[]; rows: Row<T>[]; base: string; onRemove: (id: number) => void }) {
  const dash = <span className="text-ink-muted">—</span>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="w-44 p-4" />
            {items.map((x) => (
              <th key={x.id} className="p-4 text-left align-top">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/${base}/${x.slug}`} className="font-display text-base font-bold text-navy-900 hover:text-teal-700">{x.name}</Link>
                  <button onClick={() => onRemove(x.id)} className="rounded p-1 text-ink-muted hover:bg-mist" aria-label="Remove"><X className="size-4" /></button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.label} className="align-top">
              <th className="bg-mist/60 p-4 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">{r.label}</th>
              {items.map((x) => {
                const v = r.render(x);
                return <td key={x.id} className="p-4">{v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length) ? dash : v}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type HC = {
  id: number; name: string; slug: string; is_verified: boolean; hospital_type: string; city: { name: string; country: { name: string; flag: string } } | null;
  specialties: { id: number; title: string }[]; accreditations_full: { code: string }[]; treatments: { id: number; name: string }[];
  languages_list: string[]; facilities_list: string[]; services_list: string[]; founded_year: number | null; bed_count: number;
  rating: number | null; reviews_count: number; doctors_count: number; min_price_usd: string | null;
  prices: { published: { id: number; treatment_name: string; price_from: string; currency: string; source: string }[] };
};

export function HospitalCompare() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const ids = useIds("hospitals");
  const [items, setItems] = useState<HC[] | null>(null);
  useEffect(() => {
    if (!ids.length) return setItems([]);
    api<HC[]>(`/public/hospitals/compare/?ids=${ids.join(",")}`, { auth: false }).then(setItems).catch(() => setItems([]));
  }, [ids]);
  if (items === null) return <LoadingBlock />;
  if (!items.length) return <Empty title={t("compare.empty")} action={<Link href="/hospitals" className="font-semibold text-teal-700">{t("nav.hospitals")} →</Link>} />;
  const list = (a: string[]) => a.length ? <ul className="space-y-1">{a.slice(0, 8).map((x) => <li key={x}>{x}</li>)}</ul> : null;
  return (
    <>
      <p className="mb-4 text-xs text-ink-muted">{t("compare.onlyVerified")}</p>
      <Table base="hospitals" items={items} onRemove={(id) => router.replace(`/hospitals/compare?ids=${items.filter((x) => x.id !== id).map((x) => x.id).join(",")}`)}
        rows={[
          { label: t("common.verified"), render: (x) => x.is_verified ? <span className="inline-flex items-center gap-1 font-semibold text-teal-700"><BadgeCheck className="size-4" />{t("common.verified")}</span> : <span className="text-ink-muted">{t("common.notVerified")}</span> },
          { label: t("detail.location"), render: (x) => x.city ? `${x.city.country.flag} ${x.city.name}, ${x.city.country.name}` : null },
          { label: t("list.type"), render: (x) => x.hospital_type },
          { label: t("detail.accreditations"), render: (x) => x.accreditations_full.map((a) => a.code).join(", ") },
          { label: t("detail.specialties"), render: (x) => list(x.specialties.map((s) => s.title)) },
          { label: t("detail.treatments"), render: (x) => list(x.treatments.map((s) => s.name)) },
          { label: t("detail.prices"), render: (x) => x.prices.published.length ? <ul className="space-y-1">{x.prices.published.slice(0, 5).map((p) => <li key={p.id}>{p.treatment_name}: <b>{money(p.price_from, p.currency, locale)}</b></li>)}</ul> : x.min_price_usd ? `${t("common.from")} ${money(x.min_price_usd, "USD", locale)}` : null },
          { label: t("detail.facilities"), render: (x) => list(x.facilities_list) },
          { label: t("common.languages"), render: (x) => x.languages_list.join(", ") },
          { label: t("detail.services"), render: (x) => list(x.services_list) },
          { label: t("common.founded"), render: (x) => x.founded_year },
          { label: t("common.beds"), render: (x) => x.bed_count || null },
          { label: t("detail.doctors"), render: (x) => x.doctors_count || null },
          { label: t("detail.reviews"), render: (x) => x.rating ? `${x.rating.toFixed(1)} ★ (${x.reviews_count})` : null },
        ]} />
    </>
  );
}

type PC = {
  id: number; name: string; slug: string; price: string; currency: string; price_type: string; duration_days: number | null; hospital_stay_days: number | null;
  included: string[]; excluded: string[]; additional_expenses_note: string; valid_until: string | null;
  hospital: { name: string; is_verified: boolean; country: { name: string; flag: string } | null }; treatment: { name: string };
};

export function PackageCompare() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const ids = useIds("packages");
  const [items, setItems] = useState<PC[] | null>(null);
  useEffect(() => {
    if (!ids.length) return setItems([]);
    api<PC[]>(`/public/packages/compare/?ids=${ids.join(",")}`, { auth: false }).then(setItems).catch(() => setItems([]));
  }, [ids]);
  if (items === null) return <LoadingBlock />;
  if (!items.length) return <Empty title={t("compare.empty")} action={<Link href="/packages" className="font-semibold text-teal-700">{t("nav.packages")} →</Link>} />;
  const list = (a: string[]) => a.length ? <ul className="space-y-1">{a.map((x) => <li key={x}>{x}</li>)}</ul> : null;
  return (
    <>
      <p className="mb-4 text-xs text-ink-muted">{t("common.disclaimerPrice")}</p>
      <Table base="packages" items={items} onRemove={(id) => router.replace(`/packages/compare?ids=${items.filter((x) => x.id !== id).map((x) => x.id).join(",")}`)}
        rows={[
          { label: t("common.estimate"), render: (x) => <div><div className="font-display text-xl font-extrabold">{money(x.price, x.currency, locale)}</div><div className="text-xs text-ink-muted">{x.price_type === "confirmed" ? t("common.confirmed") : t("common.estimate")}</div></div> },
          { label: t("common.hospital"), render: (x) => `${x.hospital.name}${x.hospital.country ? ` · ${x.hospital.country.flag}` : ""}` },
          { label: t("common.treatment"), render: (x) => x.treatment.name },
          { label: t("detail.duration"), render: (x) => x.duration_days ? `${x.duration_days} ${t("common.days")}` : null },
          { label: t("detail.hospitalStay"), render: (x) => x.hospital_stay_days ? `${x.hospital_stay_days} ${t("common.days")}` : null },
          { label: t("detail.included"), render: (x) => list(x.included) },
          { label: t("detail.excluded"), render: (x) => list(x.excluded) },
          { label: t("detail.extraCosts"), render: (x) => x.additional_expenses_note },
          { label: t("detail.validUntil"), render: (x) => x.valid_until },
        ]} />
    </>
  );
}
