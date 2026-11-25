"use client";

import { ArrowRight, Building2, LayoutGrid, Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { mediaUrl } from "@/lib/media";
import type { Specialty, Treatment } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { ConsultButton } from "./hero-actions";
import { Icon } from "./icon";

const POPULAR = "__popular";
const ALL = "__all";

/**
 * Home "treatments" block: pick a specialty (or type what you need) and see the matching treatments with
 * how many hospitals offer them and the lowest published price. One click opens the treatment page.
 */
export function TreatmentExplorer({ specialties, treatments, locale, labels, page, initial }: {
  specialties: Specialty[]; treatments: Treatment[]; locale: string; page?: boolean; initial?: string;
  labels: { popular: string; search: string; hospitals: string; from: string; open: string; empty: string; ctaTitle: string; ctaText: string; all: string; advanced: string; everything?: string; hospitalsBy: string };
}) {
  // Home: starts on "Popular". Treatments page: starts on "All" (or the specialty from the URL).
  const [active, setActive] = useState(initial || (page ? ALL : POPULAR));
  const [q, setQ] = useState("");
  const withTreatments = useMemo(() => {
    const count = new Map<number, number>();
    treatments.forEach((x) => count.set(x.specialty.id, (count.get(x.specialty.id) || 0) + 1));
    return specialties.filter((s) => count.get(s.id)).map((s) => ({ ...s, n: count.get(s.id)! }));
  }, [specialties, treatments]);

  const shown = useMemo(() => {
    const s = q.trim().toLocaleLowerCase();
    if (s) return treatments.filter((x) => `${x.name} ${x.specialty.title} ${x.short_description}`.toLocaleLowerCase().includes(s));
    if (active === ALL) return treatments;
    if (active === POPULAR) {
      const top = treatments.filter((x) => x.is_featured || x.is_advanced);
      return (top.length ? top : treatments).slice().sort((a, b) => b.hospitals_count - a.hospitals_count).slice(0, 9);
    }
    return treatments.filter((x) => x.specialty.slug === active);
  }, [q, active, treatments]);

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* left: search + specialties */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.search}
            className="h-12 w-full rounded-2xl border border-line-strong bg-white pl-10 pr-10 text-sm text-navy-900 outline-none transition placeholder:text-ink-muted focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15" />
          {q && <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-mist"><X className="size-3.5" /></button>}
        </label>
        <nav className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-1 lg:max-h-[30rem] lg:flex-col lg:gap-1 lg:overflow-y-auto lg:overflow-x-visible lg:pb-0">
          {[...(page ? [{ slug: ALL, title: labels.everything || labels.all, icon: "list", n: treatments.length }] : []),
            { slug: POPULAR, title: labels.popular, icon: "sparkles", n: 0 }, ...withTreatments].map((s) => {
            const on = !q && active === s.slug;
            return (
              <button key={s.slug} onClick={() => { setActive(s.slug); setQ(""); }}
                className={cn("flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                  on ? "bg-navy-900 text-white shadow-lift" : "bg-white text-navy-900 ring-1 ring-line hover:ring-teal-300 lg:ring-0 lg:hover:bg-mist")}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", on ? "bg-teal-500 text-white" : "bg-teal-50 text-teal-600")}>
                  {s.slug === POPULAR ? <Sparkles className="size-4" /> : s.slug === ALL ? <LayoutGrid className="size-4" /> : <Icon name={s.icon} className="size-4" />}
                </span>
                <span className="min-w-0 flex-1 whitespace-nowrap lg:whitespace-normal">{s.title}</span>
                {s.n > 0 && <span className={cn("rounded-full px-2 py-0.5 text-[11px]", on ? "bg-white/15" : "bg-mist text-ink-muted")}>{s.n}</span>}
              </button>
            );
          })}
        </nav>
        {!page && <Link href="/treatments" className="mt-3 hidden items-center gap-1 px-3 text-sm font-semibold text-teal-700 hover:underline lg:inline-flex">{labels.all} <ArrowRight className="size-4" /></Link>}
      </aside>

      {/* right: treatments */}
      <div>
        {(() => {
          const sel = withTreatments.find((x) => x.slug === active);
          return sel && !q ? (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-teal-50 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-teal-500 text-white"><Icon name={sel.icon} className="size-4" /></span>
              <div className="min-w-0 text-sm"><span className="font-bold text-navy-900">{sel.title}</span>{sel.description && <span className="text-ink-soft"> — {sel.description}</span>}</div>
              <Link href={`/hospitals?specialty=${sel.slug}`} className="ml-auto shrink-0 text-xs font-semibold text-teal-700 hover:underline">{labels.hospitalsBy} →</Link>
            </div>
          ) : null;
        })()}
        {shown.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((x) => (
              <Link key={x.id} href={`/treatments/${x.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lift">
                {x.image && (
                  <div className="-mx-5 -mt-5 mb-4 aspect-[16/9] overflow-hidden bg-navy-800">
                    <img src={mediaUrl(x.image)!} alt={x.name} className="size-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600 transition group-hover:bg-teal-500 group-hover:text-white"><Icon name={x.specialty.icon} className="size-5" /></span>
                  <div className="min-w-0">
                    <h3 className="font-display text-[16px] font-bold leading-snug text-navy-900 group-hover:text-teal-700">{x.name}</h3>
                    <p className="mt-0.5 text-xs text-ink-muted">{x.specialty.title}{x.is_advanced && <span className="ml-1.5 rounded-full bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-sand-500">{labels.advanced}</span>}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[13px]">
                  <span className="flex items-center gap-1.5 text-ink-soft"><Building2 className="size-4 text-teal-600" />{x.hospitals_count} {labels.hospitals}</span>
                  {x.price_from_usd
                    ? <span className="font-semibold text-navy-900">{labels.from} {money(x.price_from_usd, "USD", locale)}</span>
                    : <span className="inline-flex items-center gap-1 font-semibold text-teal-700">{labels.open}<ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" /></span>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line-strong bg-white p-8 text-center text-sm text-ink-soft">{labels.empty}</div>
        )}
        <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl bg-navy-900 p-5 text-white sm:flex-row sm:items-center sm:p-6">
          <div>
            <div className="font-display text-lg font-bold">{labels.ctaTitle}</div>
            <p className="mt-0.5 text-sm text-white/70">{labels.ctaText}</p>
          </div>
          <ConsultButton icon className="shrink-0" source="home_treatments" />
        </div>
      </div>
    </div>
  );
}
