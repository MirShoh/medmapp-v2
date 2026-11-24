import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Block({ title, children, id, className }: { title: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={cn("card scroll-mt-32 p-6 sm:p-7", className)}>
      <h2 className="mb-4 font-display text-xl font-bold text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

export function Bullets({ items, cols }: { items: string[]; cols?: boolean }) {
  if (!items?.length) return null;
  return (
    <ul className={cn("grid gap-2", cols && "sm:grid-cols-2")}>
      {items.map((x) => <li key={x} className="flex gap-2 text-sm text-ink"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-500" />{x}</li>)}
    </ul>
  );
}

export function KeyFacts({ items }: { items: { label: string; value: ReactNode }[] }) {
  const shown = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== "" && i.value !== 0);
  if (!shown.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/10 sm:flex sm:flex-wrap">
      {shown.map((i) => (
        <div key={i.label} className="bg-navy-900/40 px-5 py-3.5 backdrop-blur sm:min-w-40 sm:flex-1">
          <dt className="text-[11px] uppercase tracking-wider text-white/55">{i.label}</dt>
          <dd className="mt-0.5 font-display text-lg font-bold text-white">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type PriceRow = {
  id: number; treatment_name?: string; country?: { name: string; flag: string }; hospital_name?: string | null;
  price_from: string; price_to: string | null; currency: string; source: string; updated_on: string | null;
};

export function PriceTable({ rows, locale, labels }: { rows: PriceRow[]; locale: string; labels: { source: string; updated: string } }) {
  if (!rows.length) return null;
  const fmt = (v: string, c: string) => {
    try {
      return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(Number(v));
    } catch {
      return `${v} ${c}`;
    }
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-3 pr-4 font-medium text-navy-900">
                {r.treatment_name}
                {r.country ? <span className="ml-1 text-ink-muted">{r.country.flag} {r.country.name}</span> : null}
                {r.hospital_name ? <div className="text-xs text-ink-muted">{r.hospital_name}</div> : null}
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-right font-display font-bold text-navy-900">
                {fmt(r.price_from, r.currency)}{r.price_to ? ` – ${fmt(r.price_to, r.currency)}` : ""}
              </td>
              <td className="py-3 text-right text-[11px] text-ink-muted">
                {r.source && <div>{labels.source}: {r.source}</div>}
                {r.updated_on && <div>{labels.updated}: {r.updated_on}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
