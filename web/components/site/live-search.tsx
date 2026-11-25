"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Building2, CornerDownLeft, Globe2, Loader2, Search, Stethoscope, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Result = {
  treatments: { name: string; slug: string; specialty: string }[];
  hospitals: { name: string; slug: string; city: string; country: string; flag: string }[];
  hospitals_total: number;
  doctors: { name: string; slug: string; specialty: string }[];
  destinations: { name: string; slug: string; flag: string }[];
};
type Item = { href: string; title: string; sub?: string; lead?: string; icon: typeof Search };
type Popular = { treatments: { name: string; slug: string }[]; countries: { name: string; slug: string; flag: string }[] };

/** Accent- and apostrophe-insensitive form used to find what to highlight (mirrors the backend's `fold`). */
const fold = (s: string) => s.toLowerCase().replace(/[ıİ]/g, "i").replace(/['`ʻʼ‘’]/g, "").normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Bold the parts of `text` that match any query word, ignoring accents and apostrophes. */
function Highlight({ text, q }: { text: string; q: string }) {
  const words = q.split(/\s+/).map(fold).filter((w) => w.length > 1);
  if (!words.length) return <>{text}</>;
  // map each folded character back to its index in the original text
  const map: number[] = [];
  let folded = "";
  [...text].forEach((ch, i) => { const f = fold(ch); for (let k = 0; k < f.length; k++) { folded += f[k]; map.push(i); } });
  const marks = new Array(text.length).fill(false);
  for (const w of words) {
    let from = 0;
    for (let at = folded.indexOf(w, from); at !== -1; at = folded.indexOf(w, from)) {
      for (let k = at; k < at + w.length; k++) marks[map[k]] = true;
      from = at + w.length;
    }
  }
  const parts: { s: string; m: boolean }[] = [];
  [...text].forEach((ch, i) => {
    const last = parts[parts.length - 1];
    if (last && last.m === marks[i]) last.s += ch; else parts.push({ s: ch, m: marks[i] });
  });
  return <>{parts.map((p, i) => p.m ? <mark key={i} className="rounded bg-teal-100 px-0.5 text-navy-900">{p.s}</mark> : <Fragment key={i}>{p.s}</Fragment>)}</>;
}

/** Header search: results appear as you type (debounced), ↑/↓ + Enter to open, Esc to close. */
export function LiveSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("ls");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [popular, setPopular] = useState<Popular | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const term = q.trim();

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    document.body.style.overflow = "hidden";
    if (!popular) {
      api<{ treatments: { name: string; slug: string }[]; countries: { name: string; slug: string; flag: string }[] }>("/public/filters/", { auth: false })
        .then((f) => setPopular({ treatments: f.treatments.slice(0, 6), countries: f.countries.slice(0, 8) })).catch(() => {});
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, popular, locale]);

  useEffect(() => {
    if (term.length < 2) { setRes(null); setLoading(false); return; }
    setLoading(true);
    const ctrl = { cancelled: false };
    const id = setTimeout(() => {
      api<Result>(`/public/search/?q=${encodeURIComponent(term)}`, { auth: false })
        .then((r) => { if (!ctrl.cancelled) { setRes(r); setActive(0); } })
        .catch(() => { if (!ctrl.cancelled) setRes(null); })
        .finally(() => { if (!ctrl.cancelled) setLoading(false); });
    }, 180);
    return () => { ctrl.cancelled = true; clearTimeout(id); };
  }, [term]);

  const groups = useMemo(() => {
    if (!res) return [] as { label: string; items: Item[] }[];
    return [
      { label: t("hospitals"), items: res.hospitals.map((x) => ({ href: `/hospitals/${x.slug}`, title: x.name, sub: [x.city, x.country].filter(Boolean).join(", "), lead: x.flag, icon: Building2 })) },
      { label: t("treatments"), items: res.treatments.map((x) => ({ href: `/treatments/${x.slug}`, title: x.name, sub: x.specialty, icon: Stethoscope })) },
      { label: t("doctors"), items: res.doctors.map((x) => ({ href: `/doctors/${x.slug}`, title: x.name, sub: x.specialty, icon: UserRound })) },
      { label: t("destinations"), items: res.destinations.map((x) => ({ href: `/destinations/${x.slug}`, title: x.name, lead: x.flag, icon: Globe2 })) },
    ].filter((g) => g.items.length);
  }, [res, t]);
  const flat = useMemo(() => {
    const items = groups.flatMap((g) => g.items);
    if (res && res.hospitals_total > res.hospitals.length) {
      items.push({ href: `/hospitals?search=${encodeURIComponent(term)}`, title: `${t("allResults")} (${res.hospitals_total})`, icon: ArrowRight });
    }
    return items;
  }, [groups, res, term, t]);

  const go = (href: string) => { onClose(); setQ(""); router.push(href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown" && flat.length) { e.preventDefault(); setActive((a) => (a + 1) % flat.length); }
    else if (e.key === "ArrowUp" && flat.length) { e.preventDefault(); setActive((a) => (a - 1 + flat.length) % flat.length); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[active]) go(flat[active].href);
      else if (term.length >= 2) go(`/hospitals?search=${encodeURIComponent(term)}`);
    }
  };
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let i = -1;
  const row = (it: Item) => {
    i += 1;
    const idx = i;
    const Icon = it.icon;
    return (
      <Link key={it.href} href={it.href} data-i={idx} onClick={() => { onClose(); setQ(""); }} onMouseMove={() => setActive(idx)}
        className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", active === idx ? "bg-teal-50" : "hover:bg-mist")}>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mist text-base text-teal-600">{it.lead || <Icon className="size-4" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-navy-900"><Highlight text={it.title} q={term} /></span>
          {it.sub && <span className="block truncate text-xs text-ink-muted"><Highlight text={it.sub} q={term} /></span>}
        </span>
        {active === idx && <CornerDownLeft className="hidden size-4 shrink-0 text-teal-600 sm:block" />}
      </Link>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] bg-navy-950/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={t("placeholder")}
            initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}
            className="mx-auto mt-3 flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-lift sm:mt-[10vh] sm:max-h-[75vh]"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              {loading ? <Loader2 className="size-5 shrink-0 animate-spin text-teal-600" /> : <Search className="size-5 shrink-0 text-ink-muted" />}
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={t("placeholder")}
                type="search" enterKeyHint="search" autoComplete="off" spellCheck={false} role="combobox" aria-expanded={flat.length > 0} aria-controls="live-search-results"
                className="h-14 min-w-0 flex-1 bg-transparent text-base text-navy-900 outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden" />
              {q ? (
                <button onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label="Clear" className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-mist"><X className="size-4" /></button>
              ) : (
                <button onClick={onClose} className="rounded-md border border-line px-1.5 text-[11px] text-ink-muted sm:block">Esc</button>
              )}
            </div>
            <div ref={listRef} id="live-search-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {term.length === 1 && <p className="px-3 py-4 text-sm text-ink-muted">{t("typeMore")}</p>}
              {!term && popular && (
                <div className="p-2">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t("popular")}</p>
                  <div className="flex flex-wrap gap-2">
                    {popular.treatments.map((x) => <button key={x.slug} onClick={() => setQ(x.name)} className="chip hover:border-teal-300 hover:text-teal-700">{x.name}</button>)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {popular.countries.map((c) => <Link key={c.slug} href={`/destinations/${c.slug}`} onClick={onClose} className="chip hover:border-teal-300 hover:text-teal-700">{c.flag} {c.name}</Link>)}
                  </div>
                </div>
              )}
              {groups.map((g) => (
                <div key={g.label} className="mb-1">
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.label}</div>
                  {g.items.map(row)}
                </div>
              ))}
              {res && res.hospitals_total > res.hospitals.length && row(flat[flat.length - 1])}
              {res && !groups.length && !loading && <p className="px-3 py-8 text-center text-sm text-ink-muted">{t("nothing", { q: term })}</p>}
            </div>
            <div className="hidden border-t border-line px-4 py-2 text-[11px] text-ink-muted sm:block">{t("hint")}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
