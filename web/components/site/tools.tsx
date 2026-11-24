"use client";

import {
  ArrowRightLeft, BadgeCheck, BedDouble, Calculator, CalendarRange, ClipboardCheck, Compass, GitCompareArrows, Globe2,
  HeartHandshake, Languages, Sparkles, Stamp,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Field, Input, Select } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { ApiError, api } from "@/lib/api";
import { cn, date, money } from "@/lib/utils";
import { Prose } from "./section";

type Filters = { countries: { id: number; name: string; slug: string; flag: string }[]; specialties: { id: number; title: string }[]; treatments: { id: number; name: string; slug: string; specialty: number }[]; languages: string[] };
type ToolKey = "finder" | "destination" | "cost" | "currency" | "checklist" | "planner" | "visa" | "phrasebook" | "accommodation" | "recovery" | "compare";

const TOOLS: { key: ToolKey; icon: typeof Sparkles; label: string }[] = [
  { key: "finder", icon: Sparkles, label: "tools.finder" }, { key: "destination", icon: Compass, label: "tools.destination" },
  { key: "compare", icon: GitCompareArrows, label: "tools.compareHospitals" }, { key: "cost", icon: Calculator, label: "tools.cost" },
  { key: "currency", icon: ArrowRightLeft, label: "tools.currency" }, { key: "checklist", icon: ClipboardCheck, label: "tools.checklist" },
  { key: "planner", icon: CalendarRange, label: "tools.planner" }, { key: "visa", icon: Stamp, label: "tools.visa" },
  { key: "phrasebook", icon: Languages, label: "tools.phrasebook" }, { key: "accommodation", icon: BedDouble, label: "tools.accommodation" },
  { key: "recovery", icon: HeartHandshake, label: "tools.recovery" },
];

export function ToolsHub() {
  const t = useTranslations();
  const [tool, setTool] = useState<ToolKey>("finder");
  const [filters, setFilters] = useState<Filters | null>(null);
  useEffect(() => {
    const h = window.location.hash.slice(1) as ToolKey;
    if (TOOLS.some((x) => x.key === h)) setTool(h);
    api<Filters>("/public/filters/", { auth: false }).then(setFilters).catch(() => null);
  }, []);
  const pick = (k: ToolKey) => { setTool(k); history.replaceState(null, "", `#${k}`); };
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <nav className="scrollbar-thin flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {TOOLS.map(({ key, icon: I, label }) => (
          <button key={key} onClick={() => pick(key)}
            className={cn("flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition",
              tool === key ? "bg-navy-900 text-white shadow-card" : "bg-white text-ink-soft hover:bg-teal-50 hover:text-teal-700")}>
            <I className={cn("size-[18px]", tool === key ? "text-teal-300" : "text-teal-600")} />{t(label)}
          </button>
        ))}
      </nav>
      <div className="card min-h-[28rem] p-6 sm:p-8">
        {tool === "finder" && <Finder f={filters} />}
        {tool === "destination" && <DestinationFinder f={filters} />}
        {tool === "compare" && <CompareInfo />}
        {tool === "cost" && <CostCompare f={filters} />}
        {tool === "currency" && <Currency />}
        {tool === "checklist" && <Checklist />}
        {tool === "planner" && <Planner />}
        {tool === "visa" && <VisaGuide f={filters} />}
        {tool === "phrasebook" && <Phrasebook />}
        {tool === "accommodation" && <Guide slug="guide-accommodation" fallback="accommodation" />}
        {tool === "recovery" && <Guide slug="guide-recovery" fallback="recovery" />}
      </div>
    </div>
  );
}

function H({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return <div className="mb-6"><h2 className="font-display text-2xl font-bold">{children}</h2>{sub && <p className="mt-1 text-sm text-ink-muted">{sub}</p>}</div>;
}

type Match = { score: number; reasons: string[]; hospital: { id: number; name: string; slug: string; city: { name: string; country: { flag: string; name: string } } | null; is_verified: boolean; min_price_usd: string | null } };

function Finder({ f }: { f: Filters | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const [form, setForm] = useState({ specialty: "", treatment: "", country: "", budget_usd: "", language: "" });
  const [res, setRes] = useState<Match[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api<{ results: Match[] }>("/tools/match/", { body: { ...form, budget_usd: form.budget_usd || null }, auth: false });
      setRes(r.results);
    } catch (e) { setErr(e instanceof ApiError ? e.message : t("common.error")); } finally { setBusy(false); }
  };
  const treatments = (f?.treatments || []).filter((x) => !form.specialty || String(x.specialty) === form.specialty);
  return (
    <>
      <H sub={t("tools.matchDisclaimer")}>{t("tools.finder")}</H>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("common.specialty")}><Select value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value, treatment: "" })}><option value="">{t("form.selectPlaceholder")}</option>{f?.specialties.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</Select></Field>
        <Field label={t("common.treatment")}><Select value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })}><option value="">{t("form.selectPlaceholder")}</option>{treatments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={t("form.destination")}><Select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}><option value="">{t("home.searchCountry")}</option>{f?.countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}</Select></Field>
        <Field label={t("form.budget")}><Input type="number" min={0} value={form.budget_usd} onChange={(e) => setForm({ ...form, budget_usd: e.target.value })} /></Field>
        <Field label={t("common.language")}><Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="">{t("common.any")}</option>{f?.languages.map((l) => <option key={l} value={l}>{l}</option>)}</Select></Field>
        <div className="flex items-end"><Button className="w-full" size="lg" loading={busy} disabled={!form.specialty && !form.treatment} onClick={run}>{t("tools.match")}</Button></div>
      </div>
      {err && <p className="mt-4 text-sm text-danger">{err}</p>}
      {res && (res.length ? (
        <ol className="mt-8 space-y-3">
          {res.map((m, i) => (
            <li key={m.hospital.id} className="flex flex-col gap-3 rounded-2xl border border-line p-4 sm:flex-row sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-900 font-display font-bold text-teal-300">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/hospitals/${m.hospital.slug}`} className="font-display font-bold text-navy-900 hover:text-teal-700">{m.hospital.name}</Link>
                {m.hospital.is_verified && <BadgeCheck className="ml-1 inline size-4 text-teal-500" />}
                <div className="text-xs text-ink-muted">{m.hospital.city && `${m.hospital.city.country.flag} ${m.hospital.city.name}`}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">{m.reasons.map((r) => <span key={r} className="chip">{r}</span>)}</div>
              </div>
              {m.hospital.min_price_usd && <div className="text-right text-sm"><div className="text-xs text-ink-muted">{t("common.from")}</div><b>{money(m.hospital.min_price_usd, "USD", locale)}</b></div>}
            </li>
          ))}
        </ol>
      ) : <div className="mt-8"><Empty title={t("list.noResults")} text={t("home.emptyCatalog")} action={<Link href="/about#contact" className="font-semibold text-teal-700">{t("nav.consult")} →</Link>} /></div>)}
    </>
  );
}

function DestinationFinder({ f }: { f: Filters | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const [treatment, setTreatment] = useState("");
  const [res, setRes] = useState<{ destinations: { country: { slug: string; name: string; flag: string }; hospitals: number; price_from_usd: string | null; source: string | null; updated_on: string | null }[]; note: string } | null>(null);
  useEffect(() => {
    if (!treatment) return setRes(null);
    api<typeof res>(`/tools/destination-finder/?treatment=${treatment}`, { auth: false }).then(setRes).catch(() => setRes(null));
  }, [treatment]);
  return (
    <>
      <H sub={t("common.disclaimerPrice")}>{t("tools.destination")}</H>
      <Field label={t("common.treatment")} className="max-w-md"><Select value={treatment} onChange={(e) => setTreatment(e.target.value)}><option value="">{t("form.selectPlaceholder")}</option>{f?.treatments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      {res && (res.destinations.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {res.destinations.map((d, i) => (
            <Link key={d.country.slug} href={`/destinations/${d.country.slug}`} className={cn("rounded-2xl border p-5 transition hover:shadow-card", i === 0 ? "border-teal-400 bg-teal-50/50" : "border-line")}>
              <div className="flex items-center justify-between"><span className="text-3xl">{d.country.flag}</span>{d.price_from_usd && <span className="font-display text-xl font-extrabold">{money(d.price_from_usd, "USD", locale)}</span>}</div>
              <div className="mt-2 font-display font-bold">{d.country.name}</div>
              <div className="text-xs text-ink-muted">{d.hospitals} {t("nav.hospitals").toLowerCase()}{d.source && ` · ${t("common.source")}: ${d.source}`}{d.updated_on && ` · ${date(d.updated_on, locale)}`}</div>
            </Link>
          ))}
        </div>
      ) : <div className="mt-6"><Empty title={t("list.noResults")} /></div>)}
    </>
  );
}

function CompareInfo() {
  const t = useTranslations();
  return (
    <>
      <H sub={t("compare.onlyVerified")}>{t("tools.compareHospitals")}</H>
      <div className="flex flex-wrap gap-3">
        <Link href="/hospitals" className="rounded-xl bg-navy-900 px-5 py-3 text-sm font-semibold text-white">{t("nav.hospitals")} →</Link>
        <Link href="/hospitals/compare" className="rounded-xl border border-line-strong px-5 py-3 text-sm font-semibold">{t("compare.title")}</Link>
        <Link href="/packages/compare" className="rounded-xl border border-line-strong px-5 py-3 text-sm font-semibold">{t("compare.packagesTitle")}</Link>
      </div>
      <p className="mt-4 text-sm text-ink-muted">{t("compare.empty")}</p>
    </>
  );
}

function CostCompare({ f }: { f: Filters | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const [treatment, setTreatment] = useState("");
  const [rows, setRows] = useState<{ id: number; country: { name: string; flag: string }; hospital_name: string | null; price_from: string; price_to: string | null; currency: string; source: string; updated_on: string | null }[] | null>(null);
  useEffect(() => {
    if (!treatment) return setRows(null);
    api<{ prices: NonNullable<typeof rows> }>(`/tools/cost-compare/?treatment=${treatment}`, { auth: false }).then((r) => setRows(r.prices)).catch(() => setRows([]));
  }, [treatment]);
  const max = Math.max(1, ...(rows || []).filter((r) => r.currency === "USD").map((r) => Number(r.price_to || r.price_from)));
  return (
    <>
      <H sub={t("common.disclaimerPrice")}>{t("tools.cost")}</H>
      <Field label={t("common.treatment")} className="max-w-md"><Select value={treatment} onChange={(e) => setTreatment(e.target.value)}><option value="">{t("form.selectPlaceholder")}</option>{f?.treatments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      {rows && (rows.length ? (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="flex justify-between text-sm"><span className="font-semibold">{r.country.flag} {r.country.name}{r.hospital_name && <span className="font-normal text-ink-muted"> · {r.hospital_name}</span>}</span><span className="font-display font-bold">{money(r.price_from, r.currency, locale)}{r.price_to && ` – ${money(r.price_to, r.currency, locale)}`}</span></div>
              {r.currency === "USD" && <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600" style={{ width: `${(Number(r.price_from) / max) * 100}%` }} /></div>}
              <div className="mt-1 text-[11px] text-ink-muted">{r.source && `${t("common.source")}: ${r.source}`}{r.updated_on && ` · ${r.updated_on}`}</div>
            </li>
          ))}
        </ul>
      ) : <div className="mt-6"><Empty title={t("list.noResults")} /></div>)}
    </>
  );
}

function Currency() {
  const t = useTranslations();
  const locale = useLocale();
  const [rates, setRates] = useState<{ configured: boolean; rates: { code: string; rate: string; source: string; fetched_at: string }[] } | null>(null);
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("UZS");
  useEffect(() => { api<NonNullable<typeof rates>>("/tools/rates/", { auth: false }).then(setRates).catch(() => setRates({ configured: false, rates: [] })); }, []);
  const map = useMemo(() => Object.fromEntries([["USD", 1], ...(rates?.rates || []).map((r) => [r.code, Number(r.rate)])]), [rates]);
  const codes = ["USD", "UZS", "EUR", "INR", "TRY", "CNY", "KRW", "AED", "THB", "KZT"].filter((c) => map[c]);
  const result = map[from] && map[to] ? (Number(amount) / map[from]) * map[to] : null;
  const meta = rates?.rates.find((r) => r.code === (to === "USD" ? from : to));
  return (
    <>
      <H>{t("tools.currency")}</H>
      {!rates ? null : !rates.configured ? <Empty icon={<Globe2 className="size-5" />} title={t("tools.ratesMissing")} /> : (
        <>
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <Field label={t("tools.amount")}><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Select value={from} onChange={(e) => setFrom(e.target.value)}>{codes.map((c) => <option key={c}>{c}</option>)}</Select>
            <button onClick={() => { setFrom(to); setTo(from); }} className="grid size-11 place-items-center rounded-xl border border-line-strong" aria-label={t("ui.swap")}><ArrowRightLeft className="size-4" /></button>
            <Select value={to} onChange={(e) => setTo(e.target.value)}>{codes.map((c) => <option key={c}>{c}</option>)}</Select>
          </div>
          {result !== null && <div className="mt-8 rounded-2xl bg-navy-900 p-6 text-white"><div className="text-sm text-white/60">{amount} {from} =</div><div className="mt-1 font-display text-4xl font-extrabold">{money(result, to, locale)}</div></div>}
          {meta && <p className="mt-3 text-xs text-ink-muted">{t("common.source")}: {meta.source} · {t("common.updated")}: {date(meta.fetched_at, locale, true)}</p>}
        </>
      )}
    </>
  );
}

const CHECKLIST: Record<string, string[]> = {
  en: ["Passport valid for 6+ months", "Recent medical reports and discharge summaries", "Imaging (MRI/CT/X-ray) on disc + reports", "Recent blood tests (last 3 months)", "List of current medications and allergies", "Previous surgeries and diagnoses", "Hospital invitation letter (for visa)", "Travel insurance documents", "Contact details of your local doctor", "Copies of everything in your Health Suitcase"],
  ru: ["Паспорт, действующий 6+ месяцев", "Свежие медицинские заключения и выписки", "Снимки (МРТ/КТ/рентген) на диске + описания", "Свежие анализы крови (за 3 месяца)", "Список лекарств и аллергий", "Перенесённые операции и диагнозы", "Приглашение клиники (для визы)", "Документы медицинской страховки", "Контакты вашего лечащего врача", "Копии всех документов в «Медицинском чемодане»"],
  uz: ["Kamida 6 oy amal qiladigan pasport", "So‘nggi tibbiy xulosalar va ko‘chirmalar", "Tasvirlar (MRT/KT/rentgen) disk + tavsif bilan", "So‘nggi qon tahlillari (3 oy ichida)", "Dorilar va allergiyalar ro‘yxati", "O‘tkazilgan operatsiyalar va tashxislar", "Klinika taklifnomasi (viza uchun)", "Sug‘urta hujjatlari", "Shifokoringiz kontaktlari", "Sog‘liq chamadonidagi barcha hujjatlar nusxasi"],
};

function Checklist() {
  const t = useTranslations();
  const locale = useLocale();
  const items = CHECKLIST[locale] || CHECKLIST.en;
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem("medmapp.checklist") || "[]")); } catch { /* blocked */ } }, []);
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try { localStorage.setItem("medmapp.checklist", JSON.stringify(next)); } catch { /* blocked */ }
  };
  return (
    <>
      <H sub={`${done.length} / ${items.length} ${t("tools.ready")}`}>{t("tools.checklist")}</H>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-mist"><div className="h-full bg-teal-500 transition-all" style={{ width: `${(done.length / items.length) * 100}%` }} /></div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((x, i) => (
          <li key={x}><button onClick={() => toggle(i)} className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition", done.includes(i) ? "border-teal-300 bg-teal-50 text-teal-800" : "border-line hover:border-teal-300")}>
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", done.includes(i) ? "border-teal-500 bg-teal-500 text-white" : "border-line-strong")}>{done.includes(i) && "✓"}</span>{x}
          </button></li>
        ))}
      </ul>
      <Link href="/dashboard/documents" className="mt-6 inline-block text-sm font-semibold text-teal-700">{t("dash.documents")} →</Link>
    </>
  );
}

function Planner() {
  const t = useTranslations();
  const locale = useLocale();
  const [arrival, setArrival] = useState("");
  const [stay, setStay] = useState("14");
  const plan = useMemo(() => {
    if (!arrival) return [];
    const a = new Date(arrival);
    const add = (d: number) => new Date(a.getTime() + d * 86400000).toISOString();
    const s = Math.max(1, Number(stay) || 1);
    return [
      { when: add(-42), label: { en: "Send documents for medical review", ru: "Отправьте документы на оценку", uz: "Hujjatlarni baholashga yuboring" } },
      { when: add(-30), label: { en: "Receive opinion & quotation, choose hospital", ru: "Получите заключение и предложение, выберите клинику", uz: "Xulosa va taklifni oling, klinikani tanlang" } },
      { when: add(-21), label: { en: "Hospital invitation letter → apply for visa", ru: "Приглашение клиники → подача на визу", uz: "Klinika taklifnomasi → vizaga ariza" } },
      { when: add(-10), label: { en: "Book flights and accommodation", ru: "Забронируйте билеты и жильё", uz: "Chipta va turar joyni bron qiling" } },
      { when: add(0), label: { en: "Arrival, airport transfer, first consultation", ru: "Прилёт, трансфер, первая консультация", uz: "Kelish, transfer, birinchi konsultatsiya" } },
      { when: add(Math.round(s * 0.7)), label: { en: "Discharge & follow-up check", ru: "Выписка и контрольный осмотр", uz: "Ko‘chirma va nazorat ko‘rigi" } },
      { when: add(s), label: { en: "Return home with translated documents", ru: "Возвращение домой с переведёнными документами", uz: "Tarjima qilingan hujjatlar bilan uyga qaytish" } },
      { when: add(s + 30), label: { en: "Online follow-up with your doctor", ru: "Онлайн-наблюдение у врача", uz: "Shifokor bilan onlayn kuzatuv" } },
    ];
  }, [arrival, stay]);
  return (
    <>
      <H sub={t("tools.recoveryNote")}>{t("tools.planner")}</H>
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <Field label={t("tools.arrival")}><Input type="date" value={arrival} onChange={(e) => setArrival(e.target.value)} /></Field>
        <Field label={t("tools.stay")}><Input type="number" min={1} max={180} value={stay} onChange={(e) => setStay(e.target.value)} /></Field>
      </div>
      {plan.length > 0 && (
        <ol className="relative mt-8 space-y-4 border-l-2 border-dashed border-teal-300 pl-6">
          {plan.map((p) => (
            <li key={p.when} className="relative">
              <span className="absolute -left-[31px] top-1 size-3.5 rounded-full border-2 border-white bg-teal-500 ring-2 ring-teal-200" />
              <div className="text-xs font-semibold text-teal-700">{date(p.when, locale)}</div>
              <div className="text-sm font-medium text-navy-900">{p.label[locale as "en"] || p.label.en}</div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function VisaGuide({ f }: { f: Filters | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const [slug, setSlug] = useState("");
  const [c, setC] = useState<{ name: string; visa_info: string; visa_info_source: string; visa_info_updated: string | null } | null>(null);
  useEffect(() => {
    if (!slug) return setC(null);
    api<NonNullable<typeof c>>(`/public/destinations/${slug}/`, { auth: false }).then(setC).catch(() => setC(null));
  }, [slug]);
  return (
    <>
      <H sub={t("detail.visaNote")}>{t("tools.visa")}</H>
      <Field label={t("common.country")} className="max-w-md"><Select value={slug} onChange={(e) => setSlug(e.target.value)}><option value="">{t("form.selectPlaceholder")}</option>{f?.countries.map((x) => <option key={x.slug} value={x.slug}>{x.flag} {x.name}</option>)}</Select></Field>
      {c && (
        <div className="mt-6 rounded-2xl border border-line p-5">
          {c.visa_info ? <Prose text={c.visa_info} /> : <p className="text-sm text-ink-muted">{t("detail.noInfo")}</p>}
          <p className="mt-4 text-xs text-ink-muted">{c.visa_info_source && <a href={c.visa_info_source} target="_blank" rel="noopener noreferrer" className="underline">{t("common.source")}</a>}{c.visa_info_updated && ` · ${t("common.updated")}: ${date(c.visa_info_updated, locale)}`}</p>
        </div>
      )}
    </>
  );
}

const PHRASES: [string, string, string, string][] = [
  ["I need a doctor.", "Мне нужен врач.", "Menga shifokor kerak.", "Bir doktora ihtiyacım var."],
  ["I have an appointment.", "У меня назначен приём.", "Menda qabul belgilangan.", "Randevum var."],
  ["I am allergic to…", "У меня аллергия на…", "Menda … ga allergiya bor.", "… alerjim var."],
  ["Where is the pharmacy?", "Где аптека?", "Dorixona qayerda?", "Eczane nerede?"],
  ["It hurts here.", "Здесь болит.", "Shu yerim og‘riyapti.", "Burası ağrıyor."],
  ["Please call my coordinator.", "Пожалуйста, позвоните моему координатору.", "Iltimos, koordinatorimga qo‘ng‘iroq qiling.", "Lütfen koordinatörümü arayın."],
  ["I need an interpreter.", "Мне нужен переводчик.", "Menga tarjimon kerak.", "Tercümana ihtiyacım var."],
  ["What are the side effects?", "Какие побочные эффекты?", "Qanday nojo‘ya ta’sirlari bor?", "Yan etkileri nelerdir?"],
  ["When can I go home?", "Когда я смогу поехать домой?", "Qachon uyga ketishim mumkin?", "Ne zaman eve gidebilirim?"],
  ["Emergency!", "Срочно! Скорая помощь!", "Shoshilinch! Tez yordam!", "Acil durum!"],
];

function Phrasebook() {
  const t = useTranslations();
  return (
    <>
      <H sub="English · Русский · O‘zbekcha · Türkçe">{t("tools.phrasebook")}</H>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-muted"><th className="pb-2">EN</th><th className="pb-2">RU</th><th className="pb-2">UZ</th><th className="pb-2">TR</th></tr></thead>
          <tbody className="divide-y divide-line">{PHRASES.map((p) => <tr key={p[0]}>{p.map((x, i) => <td key={i} className={cn("py-2.5 pr-4", i === 0 && "font-semibold text-navy-900")}>{x}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

const GUIDES: Record<string, Record<string, string>> = {
  accommodation: {
    en: "• Stay within 15–20 minutes of the hospital; many partner hospitals have guest houses.\n• For stays over 2 weeks, serviced apartments are usually cheaper than hotels.\n• Ask for ground-floor or lift access after orthopaedic or cardiac surgery.\n• Check that halal food, a kitchen or a fridge for medications are available if you need them.\n• Your coordinator can book accommodation for you and your companions.",
    ru: "• Живите в 15–20 минутах от клиники; у многих клиник есть гостевые дома.\n• При пребывании дольше 2 недель апартаменты обычно дешевле отеля.\n• После ортопедических или кардиоопераций нужен лифт или первый этаж.\n• Уточните наличие халяльного питания, кухни или холодильника для лекарств.\n• Координатор может забронировать жильё для вас и сопровождающих.",
    uz: "• Klinikadan 15–20 daqiqa masofada joylashing; ko‘p klinikalarda mehmon uylari bor.\n• 2 haftadan ortiq qolsangiz, kvartira odatda mehmonxonadan arzon.\n• Ortopedik yoki yurak operatsiyasidan keyin lift yoki birinchi qavat kerak.\n• Halol taom, oshxona yoki dori uchun muzlatgich borligini aniqlang.\n• Koordinator siz va hamrohlaringiz uchun joy bron qilishi mumkin.",
  },
  recovery: {
    en: "• Follow the written discharge instructions from your treating doctor — they come first.\n• Plan rest days before flying; ask your doctor when flying is safe for you.\n• Keep all medications in hand luggage with prescriptions.\n• Arrange online follow-up appointments before you leave.\n• Contact your doctor or local emergency services if you notice warning signs your doctor listed.",
    ru: "• Следуйте письменным рекомендациям лечащего врача при выписке — они в приоритете.\n• Запланируйте дни отдыха перед перелётом; уточните у врача, когда можно лететь.\n• Держите лекарства в ручной клади вместе с рецептами.\n• Договоритесь об онлайн-контроле до отъезда.\n• При тревожных симптомах, указанных врачом, обращайтесь к врачу или в скорую.",
    uz: "• Davolovchi shifokorning yozma tavsiyalariga amal qiling — ular birinchi o‘rinda.\n• Parvozdan oldin dam olish kunlarini rejalang; qachon uchish mumkinligini shifokordan so‘rang.\n• Dorilarni retsept bilan qo‘l yukida saqlang.\n• Ketishdan oldin onlayn kuzatuvni kelishib oling.\n• Shifokor aytgan xavfli belgilar bo‘lsa, shifokorga yoki tez yordamga murojaat qiling.",
  },
};

function Guide({ slug, fallback }: { slug: string; fallback: "accommodation" | "recovery" }) {
  const t = useTranslations();
  const locale = useLocale();
  const [cms, setCms] = useState<{ title: string; body: string; source_note: string; updated_at: string } | null | undefined>(undefined);
  useEffect(() => { api<NonNullable<typeof cms>>(`/public/pages/${slug}/`, { auth: false }).then(setCms).catch(() => setCms(null)); }, [slug]);
  return (
    <>
      <H sub={fallback === "recovery" ? t("tools.recoveryNote") : t("tools.guideEditable")}>{cms?.title || t(fallback === "recovery" ? "tools.recovery" : "tools.accommodation")}</H>
      <Prose text={cms?.body || GUIDES[fallback][locale] || GUIDES[fallback].en} />
      {cms?.updated_at && <p className="mt-4 text-xs text-ink-muted">{t("common.updated")}: {date(cms.updated_at, locale)}</p>}
    </>
  );
}
