"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CheckCircle2, ChevronRight, ExternalLink, FileText, Image as ImageIcon, Inbox, Loader2, MessageSquare, Receipt, Search, Send, Stethoscope, Trash2, Upload, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/portal/shell";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, LoadingBlock, Select, Stat, Tabs, Textarea } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { api, openSignedLink, type Paginated } from "@/lib/api";
import { cn, date, fileSize, money } from "@/lib/utils";

type Doc = { id: number; title: string; category: string; size: number; document_date: string | null; uploaded_at: string };
type Referral = {
  id: number; status: string; case_reference: string; case_title: string; case_type: string; description: string; specialty: string | null;
  patient: { display_name: string; age: number | null; gender: string; country: string | null; allergies: string; chronic_conditions: string };
  documents: Doc[]; message_to_hospital: string; created_at: string; updated_at: string;
};
type ReferralDetail = Referral & {
  messages: { id: number; text: string; created_at: string; author: string | null; mine: boolean }[];
  opinions: { id: number; doctor_name: string; summary: string; recommended_treatment: string; created_at: string; released_to_patient: boolean }[];
  quotations: { id: number; amount_min: string; amount_max: string | null; currency: string; quote_type: string; quote_type_label: string; status: string; treatment_plan: string; created_at: string }[];
};

const STATUS_TONE: Record<string, "neutral" | "teal" | "warning" | "success" | "danger" | "navy"> = {
  pending: "neutral", sent: "warning", reviewing: "teal", opinion_submitted: "navy", quoted: "navy", accepted: "success", declined: "danger",
};

/* ---------------- Overview ---------------- */
type Profile = {
  id: number; name: string; slug: string; is_verified: boolean; city: { name: string; country: { name: string; flag: string } } | null;
  translations: Record<"uz" | "ru" | "en", Record<string, string>>; shared: Record<string, string>; media: { image: string | null; logo: string | null };
  stats: { referrals: number; open: number; new: number; quotations: number; opinions: number };
};
const LANGS = ["uz", "ru", "en"] as const;
const TEXT_FIELDS: { key: string; area?: boolean }[] = [
  { key: "short_description" }, { key: "description", area: true }, { key: "address" },
  { key: "facilities", area: true }, { key: "equipment", area: true }, { key: "services_available", area: true },
];
const SHARED_FIELDS = ["phone", "email", "website", "languages"];

/** Share of profile fields filled in, and which languages still have no description. */
function completeness(p: Profile) {
  const checks = [...LANGS.map((l) => !!p.translations[l].description), ...LANGS.map((l) => !!p.translations[l].short_description),
    !!p.shared.phone, !!p.shared.email, !!p.shared.website, !!p.media.image, !!p.media.logo];
  return { pct: Math.round((checks.filter(Boolean).length / checks.length) * 100), missing: LANGS.filter((l) => !p.translations[l].description) };
}

export function PartnerHome() {
  const t = useTranslations();
  const pt = useTranslations("partnerUi");
  const q = useQuery({ queryKey: ["partner-profile"], queryFn: () => api<Profile>("/partner/profile/") });
  const recent = useQuery({ queryKey: ["partner-refs", ""], queryFn: () => api<Paginated<Referral>>("/partner/referrals/?page_size=8"), refetchInterval: 60_000 });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorBox message={(q.error as Error)?.message || t("common.error")} />;
  const p = q.data;
  const c = completeness(p);
  const fresh = recent.data?.results.filter((r) => r.status === "sent") || [];
  return (
    <>
      <PageTitle title={p.name} subtitle={p.city ? `${p.city.country.flag} ${p.city.name}, ${p.city.country.name}` : undefined}
        actions={<Link href={`/hospitals/${p.slug}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold">{p.is_verified && <BadgeCheck className="size-4 text-teal-600" />}{pt("publicPage")} →</Link>} />
      {fresh.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 font-display font-bold text-amber-800"><Inbox className="size-5" />{pt("newReferrals", { n: fresh.length })}</div>
          <p className="mt-1 text-sm text-amber-800/80">{pt("newReferralsText")}</p>
          <div className="mt-3 flex flex-wrap gap-2">{fresh.map((r) => <Link key={r.id} href={`/partner/referrals/${r.id}`} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-navy-900 shadow-sm hover:text-teal-700"><span className="font-mono text-xs text-teal-700">{r.case_reference}</span> · {r.specialty || r.case_title}</Link>)}</div>
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Inbox className="size-5" />} label={t("partner.referrals")} value={p.stats.referrals} hint={pt("openCount", { n: p.stats.open })} />
        <Stat icon={<MessageSquare className="size-5" />} label={pt("awaiting")} value={p.stats.new} tone={p.stats.new ? "danger" : "sand"} />
        <Stat icon={<Stethoscope className="size-5" />} label={t("dash.opinions")} value={p.stats.opinions} tone="navy" />
        <Stat icon={<Receipt className="size-5" />} label={t("dash.quotations")} value={p.stats.quotations} tone="navy" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display font-bold">{t("partner.referrals")}</h2><Link href="/partner/referrals" className="text-sm font-semibold text-teal-700">{t("common.viewAll")} →</Link></div>
          {recent.data?.results.length ? <RefList items={recent.data.results} /> : (
            <div className="py-4">
              <p className="text-sm font-semibold text-navy-900">{pt("emptyTitle")}</p>
              <ol className="mt-4 space-y-3">{[pt("how1"), pt("how2"), pt("how3")].map((s, i) => (
                <li key={s} className="flex gap-3 text-sm text-ink-soft"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-500 text-xs font-bold text-white">{i + 1}</span><span className="pt-0.5">{s}</span></li>
              ))}</ol>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="font-display font-bold">{t("partner.profile")}</h2>
          <div className="mt-3 flex justify-between text-xs font-semibold"><span className="text-ink-muted">{pt("completeness")}</span><span className="text-teal-700">{c.pct}%</span></div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-teal-500" style={{ width: `${c.pct}%` }} /></div>
          {c.missing.length > 0 && <p className="mt-3 text-sm text-amber-700">{pt("missingLangs", { langs: c.missing.map((l) => l.toUpperCase()).join(", ") })}</p>}
          {!p.media.image && <p className="mt-1 text-sm text-amber-700">{pt("noPhoto")}</p>}
          <p className="mt-3 text-xs text-ink-muted">{pt("profileWhy")}</p>
          <Link href="/partner/profile" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white">{pt("editProfile")} →</Link>
        </Card>
      </div>
    </>
  );
}

/* ---------------- Hospital profile (per language) ---------------- */
export function PartnerProfilePage() {
  const t = useTranslations();
  const pt = useTranslations("partnerUi");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["partner-profile"], queryFn: () => api<Profile>("/partner/profile/") });
  const [lang, setLang] = useState<(typeof LANGS)[number]>("uz");
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorBox message={(q.error as Error)?.message || t("common.error")} />;
  const p = q.data;
  const reload = () => qc.invalidateQueries({ queryKey: ["partner-profile"] });
  const saveText = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/partner/profile/", { method: "PATCH", body: { ...Object.fromEntries(new FormData(e.currentTarget)), lang } });
      toast.success(t("common.saved")); reload();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const saveShared = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try { await api("/partner/profile/", { method: "PATCH", body: Object.fromEntries(new FormData(e.currentTarget)) }); toast.success(t("common.saved")); reload(); } catch (err) { toast.error((err as Error).message); }
  };
  const tr = p.translations[lang];
  return (
    <>
      <PageTitle title={t("partner.profile")} subtitle={pt("profileWhy")}
        actions={<Link href={`/hospitals/${p.slug}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold"><ExternalLink className="size-4" />{pt("publicPage")}</Link>} />

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="font-display font-bold">{pt("photos")}</h2><p className="text-xs text-ink-muted">{pt("imageRules")}</p></div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_10rem_minmax(0,1fr)]">
          <ImageDrop field="image" url={p.media.image} label={pt("image")} hint={pt("imageHint")} onDone={reload} />
          <ImageDrop field="logo" url={p.media.logo} label={pt("logo")} hint={pt("logoHint")} onDone={reload} square />
          <div>
            <div className="mb-1.5 text-[13px] font-medium">{pt("preview")}</div>
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="relative aspect-[16/9] bg-mist">
                {p.media.image ? <img src={p.media.image} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-ink-muted"><ImageIcon className="size-8" /></div>}
                {p.media.logo && <img src={p.media.logo} alt="" className="absolute bottom-2 left-2 size-10 rounded-lg bg-white object-contain p-1 shadow" />}
              </div>
              <div className="p-3">
                <div className="line-clamp-2 text-sm font-bold text-navy-900">{p.name}</div>
                {p.city && <div className="text-[11px] text-ink-muted">{p.city.country.flag} {p.city.name}</div>}
                <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{p.translations.uz.short_description || pt("noShort")}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display font-bold">{pt("texts")}</h2>
            <div className="flex rounded-xl border border-line p-1">
              {LANGS.map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)}
                  className={cn("relative rounded-lg px-4 py-1.5 text-xs font-bold uppercase transition", lang === l ? "bg-navy-900 text-white" : "text-ink-soft hover:text-navy-900")}>
                  {l}{!p.translations[l].description && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-400" />}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-4 rounded-xl bg-mist px-3 py-2 text-xs text-ink-soft">{pt(`langHint_${lang}`)}</p>
          <form key={lang} onSubmit={saveText} className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map((f) => (
              <Field key={f.key} label={t(`pf.${f.key}`)} className={f.area || f.key === "short_description" ? "sm:col-span-2" : ""}>
                {f.area ? <Textarea name={f.key} rows={f.key === "description" ? 6 : 3} defaultValue={tr[f.key] || ""} /> : <Input name={f.key} defaultValue={tr[f.key] || ""} />}
              </Field>
            ))}
            <Button type="submit" loading={busy} className="sm:col-span-2">{pt("saveLang", { lang: lang.toUpperCase() })}</Button>
          </form>
        </Card>
        <Card className="xl:self-start">
          <h2 className="mb-3 font-display font-bold">{pt("contacts")}</h2>
          <form onSubmit={saveShared} className="space-y-3">
            {SHARED_FIELDS.map((f) => <Field key={f} label={t(`pf.${f}`)}><Input name={f} defaultValue={p.shared[f] || ""} /></Field>)}
            <Button type="submit" variant="secondary" className="w-full">{t("common.save")}</Button>
          </form>
        </Card>
      </div>
    </>
  );
}

/** Drop or pick an image; the current one shows with Replace / Remove on hover (always visible on touch screens). */
function ImageDrop({ field, url, label, hint, onDone, square }: { field: "image" | "logo"; url: string | null; label: string; hint: string; onDone: () => void; square?: boolean }) {
  const t = useTranslations();
  const pt = useTranslations("partnerUi");
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async (body: FormData | Record<string, unknown>) => {
    setBusy(true);
    try {
      await api("/partner/profile/", body instanceof FormData ? { method: "PATCH", form: body } : { method: "PATCH", body });
      toast.success(t("common.saved")); onDone();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const upload = (file?: File) => {
    if (!file) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) return toast.error(pt("imageType"));
    if (file.size > 5 * 1024 * 1024) return toast.error(pt("imageSize"));
    const fd = new FormData();
    fd.append(field, file);
    void send(fd);
  };
  const remove = () => { if (confirm(pt("removeConfirm"))) void send({ [`${field}_clear`]: true }); };
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium">{label}</div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files?.[0]); }}
        className={cn("group relative overflow-hidden rounded-2xl border-2 border-dashed transition", square ? "aspect-square" : "aspect-[16/9]",
          over ? "border-teal-500 bg-teal-50" : url ? "border-transparent" : "border-line-strong bg-mist hover:border-teal-400")}>
        {url ? (
          <>
            <img src={url} alt="" className={cn("size-full", square ? "bg-white object-contain p-3" : "object-cover")} />
            <div className="absolute inset-0 flex items-end justify-center gap-2 bg-gradient-to-t from-navy-950/70 to-transparent p-3 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <button type="button" onClick={() => input.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-navy-900"><Upload className="size-3.5" />{pt("replace")}</button>
              <button type="button" onClick={remove} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/90 px-3 text-xs font-semibold text-danger"><Trash2 className="size-3.5" />{pt("remove")}</button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="grid size-11 place-items-center rounded-xl bg-white text-teal-600 shadow-sm"><Upload className="size-5" /></span>
            <span className="text-sm font-semibold text-navy-900">{pt("dropHere")}</span>
            <span className="text-[11px] text-ink-muted">{hint}</span>
          </button>
        )}
        {busy && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="size-6 animate-spin text-teal-600" /></div>}
      </div>
      <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp" className="sr-only" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

/* ---------------- Referral list ---------------- */
type Group = "new" | "work" | "answered" | "closed";
const GROUPS: Record<Group, string[]> = { new: ["sent", "pending"], work: ["reviewing"], answered: ["opinion_submitted", "quoted"], closed: ["accepted", "declined"] };
const groupOf = (s: string) => (Object.keys(GROUPS) as Group[]).find((g) => GROUPS[g].includes(s)) || "work";
const STRIPE: Record<Group, string> = { new: "bg-amber-500", work: "bg-teal-500", answered: "bg-navy-700", closed: "bg-line-strong" };

function daysAgo(iso: string, t: ReturnType<typeof useTranslations>) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? t("partnerUi.today") : d === 1 ? t("partnerUi.yesterday") : t("partnerUi.daysAgo", { n: d });
}

function RefList({ items }: { items: Referral[] }) {
  const t = useTranslations();
  return (
    <ul className="space-y-2.5">
      {items.map((r) => {
        const g = groupOf(r.status);
        return (
          <li key={r.id}>
            <Link href={`/partner/referrals/${r.id}`} className="group flex overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-card">
              <span className={cn("w-1.5 shrink-0", STRIPE[g])} />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-700">{r.case_reference}</span>
                    <Badge tone={STATUS_TONE[r.status]}>{t(`rs.${r.status}`)}</Badge>
                    <span className="text-[11px] text-ink-muted">{daysAgo(r.created_at, t)}</span>
                  </div>
                  <div className="mt-1 truncate font-semibold text-navy-900">{r.specialty || r.case_title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-muted">
                    <span>{[r.patient.display_name, r.patient.age && `${r.patient.age} ${t("common.years")}`, r.patient.country].filter(Boolean).join(" · ")}</span>
                    <span className="inline-flex items-center gap-1"><FileText className="size-3.5" />{t("partnerUi.docs", { n: r.documents.length })}</span>
                  </div>
                </div>
                <span className={cn("rounded-xl px-3 py-1.5 text-xs font-semibold", g === "new" ? "bg-amber-50 text-amber-800" : g === "closed" ? "bg-mist text-ink-muted" : "bg-teal-50 text-teal-800")}>{t(`partnerUi.next_${r.status}`)}</span>
                <ChevronRight className="size-5 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PartnerReferrals() {
  const t = useTranslations();
  const pt = useTranslations("partnerUi");
  const [tab, setTab] = useState<Group | "all">("all");
  const [search, setSearch] = useState("");
  const q = useQuery({ queryKey: ["partner-refs", "all"], queryFn: () => api<Paginated<Referral>>("/partner/referrals/?page_size=200"), refetchInterval: 60_000 });
  const all = q.data?.results || [];
  const count = (g: Group) => all.filter((r) => groupOf(r.status) === g).length;
  const s = search.trim().toLowerCase();
  const shown = all.filter((r) => (tab === "all" || groupOf(r.status) === tab)
    && (!s || [r.case_reference, r.specialty, r.case_title, r.patient.display_name].some((x) => x?.toLowerCase().includes(s))));
  const tabs: [Group | "all", string, number][] = [["all", t("common.all"), all.length], ["new", pt("g_new"), count("new")], ["work", pt("g_work"), count("work")],
    ["answered", pt("g_answered"), count("answered")], ["closed", pt("g_closed"), count("closed")]];
  return (
    <>
      <PageTitle title={t("partner.referrals")} subtitle={pt("listSub")} />
      {q.isLoading ? <LoadingBlock /> : !all.length ? (
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-600"><Inbox className="size-6" /></span>
          <h2 className="mt-4 font-display text-xl font-bold">{pt("emptyListTitle")}</h2>
          <p className="mt-1 text-sm text-ink-soft">{pt("emptyListText")}</p>
          <ol className="mx-auto mt-6 max-w-md space-y-3 text-left">{[pt("how1"), pt("how2"), pt("how3")].map((x, i) => (
            <li key={x} className="flex gap-3 text-sm text-ink-soft"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-500 text-xs font-bold text-white">{i + 1}</span><span className="pt-0.5">{x}</span></li>
          ))}</ol>
          <Link href="/partner/profile" className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white">{pt("fillProfile")} →</Link>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-2xl border border-line bg-white p-1">
              {tabs.map(([k, label, n]) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition", tab === k ? "bg-navy-900 text-white" : "text-ink-soft hover:text-navy-900")}>
                  {label}<span className={cn("min-w-5 rounded-full px-1.5 text-[11px]", tab === k ? "bg-white/20" : k === "new" && n ? "bg-amber-100 text-amber-800" : "bg-mist")}>{n}</span>
                </button>
              ))}
            </div>
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <Input className="h-10 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={pt("searchPh")} />
            </div>
          </div>
          {shown.length ? <RefList items={shown} /> : <Empty icon={<Inbox className="size-5" />} title={pt("emptyFilter")} />}
        </>
      )}
    </>
  );
}

/* ---------------- Referral workspace ---------------- */
export function PartnerReferral({ id }: { id: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"case" | "opinion" | "quotation" | "messages">("case");
  const [msg, setMsg] = useState("");
  const q = useQuery({ queryKey: ["partner-ref", id], queryFn: () => api<ReferralDetail>(`/partner/referrals/${id}/`), refetchInterval: tab === "messages" ? 10_000 : false });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["partner-ref", id] }); qc.invalidateQueries({ queryKey: ["partner-refs"] }); qc.invalidateQueries({ queryKey: ["partner-profile"] }); };
  const post = async (path: string, body: Record<string, unknown> | FormData, ok?: () => void) => {
    try {
      await api(`/partner/referrals/${id}/${path}/`, body instanceof FormData ? { form: body } : { body });
      toast.success(t("common.saved")); refresh(); ok?.();
    } catch (e) { toast.error((e as Error).message); }
  };
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorBox message={(q.error as Error)?.message || t("common.error")} />;
  const r = q.data;
  const closed = ["accepted", "declined"].includes(r.status);
  // The partner's work in order; the first unfinished step is "what to do now".
  const steps: { key: "case" | "opinion" | "quotation" | "accept"; done: boolean }[] = [
    { key: "case", done: r.status !== "sent" },
    { key: "opinion", done: r.opinions.length > 0 },
    { key: "quotation", done: r.quotations.length > 0 },
    { key: "accept", done: r.status === "accepted" },
  ];
  const current = r.status === "declined" ? null : steps.find((x) => !x.done) || null;
  const goTo = (k: (typeof steps)[number]["key"]) => { if (k !== "accept") setTab(k); };
  return (
    <>
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/partner/referrals" className="text-xs font-semibold text-ink-muted hover:text-teal-700">← {t("partner.referrals")}</Link>
            <div className="mt-1 font-mono text-xs font-bold text-teal-700">{r.case_reference} · <span className="font-sans">{t.has(`caseType.${r.case_type}`) ? t(`caseType.${r.case_type}`) : r.case_type}</span></div>
            <h1 className="mt-1 font-display text-2xl font-extrabold">{r.specialty || r.case_title}</h1>
            <p className="text-sm text-ink-muted">{[r.patient.display_name, r.patient.age && `${r.patient.age} ${t("common.years")}`, r.patient.country, date(r.created_at, locale, true)].filter(Boolean).join(" · ")}</p>
          </div>
          <Badge tone={STATUS_TONE[r.status]}>{t(`rs.${r.status}`)}</Badge>
        </div>
        <ol className="mt-5 grid gap-2 sm:grid-cols-4">
          {steps.map((x, i) => {
            const isNow = current?.key === x.key;
            return (
              <li key={x.key}>
                <button type="button" onClick={() => goTo(x.key)} disabled={x.key === "accept"}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-default",
                    x.done ? "border-teal-200 bg-teal-50" : isNow ? "border-amber-300 bg-amber-50" : "border-line bg-white hover:border-line-strong")}>
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                    x.done ? "bg-teal-500 text-white" : isNow ? "bg-amber-500 text-white" : "bg-mist text-ink-muted")}>
                    {x.done ? <CheckCircle2 className="size-4" /> : i + 1}
                  </span>
                  <span className="text-xs font-semibold leading-tight text-navy-900">{t(`partnerUi.step_${x.key}`)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {r.status === "declined" ? (
          <p className="mt-4 rounded-xl bg-mist px-4 py-3 text-sm text-ink-soft">{t("partnerUi.declinedText")}</p>
        ) : current ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">{t("partnerUi.nowTitle")}</div>
              <div className="text-sm font-semibold text-navy-900">{t(`partnerUi.now_${current.key}`)}</div>
            </div>
            {current.key === "accept" ? (
              <>
                <Button size="sm" onClick={() => post("status", { status: "accepted" })}><CheckCircle2 className="size-4" />{t("partner.accept")}</Button>
                <Button size="sm" variant="outline" onClick={() => confirm(t("partnerUi.declineConfirm")) && post("status", { status: "declined" })}><XCircle className="size-4" />{t("partner.declineCase")}</Button>
              </>
            ) : <Button size="sm" onClick={() => goTo(current.key)}>{t(`partnerUi.go_${current.key}`)} →</Button>}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{t("partnerUi.allDone")}</p>
        )}
        {!closed && current?.key !== "accept" && (
          <button type="button" onClick={() => confirm(t("partnerUi.declineConfirm")) && post("status", { status: "declined" })}
            className="mt-3 text-xs font-semibold text-ink-muted hover:text-danger">{t("partnerUi.cannotTake")}</button>
        )}
      </div>
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[
        { value: "case", label: `1. ${t("partnerUi.tab_case")}` }, { value: "opinion", label: `2. ${t("partnerUi.tab_opinion")}`, count: r.opinions.length },
        { value: "quotation", label: `3. ${t("partnerUi.tab_quotation")}`, count: r.quotations.length }, { value: "messages", label: t("partner.messages"), count: r.messages.length },
      ]} />
      {tab === "case" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-display font-bold">{t("partner.patientInfo")}</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-ink-muted">{t("common.name")}</dt><dd className="font-medium">{r.patient.display_name}</dd></div>
              <div><dt className="text-xs text-ink-muted">{t("ui.ageGender")}</dt><dd className="font-medium">{[r.patient.age, r.patient.gender && t(r.patient.gender === "other" ? "ui.otherGender" : `ui.${r.patient.gender}`)].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt className="text-xs text-ink-muted">{t("common.country")}</dt><dd className="font-medium">{r.patient.country || "—"}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-ink-muted">{t("ui.allergies")}</dt><dd className="whitespace-pre-line">{r.patient.allergies || "—"}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-ink-muted">{t("ui.chronic")}</dt><dd className="whitespace-pre-line">{r.patient.chronic_conditions || "—"}</dd></div>
            </dl>
            {(r.description || r.message_to_hospital) && <div className="mt-4 border-t border-line pt-4 text-sm"><p className="whitespace-pre-line">{r.description}</p>{r.message_to_hospital && <p className="mt-2 rounded-xl bg-mist p-3"><b>MedMapp:</b> {r.message_to_hospital}</p>}</div>}
          </Card>
          <Card>
            <h2 className="mb-1 font-display font-bold">{t("partner.sharedDocs")}</h2>
            <p className="mb-3 text-xs text-ink-muted">{t("dash.privateNote")}</p>
            {r.documents.length ? (
              <ul className="divide-y divide-line">{r.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <FileText className="size-5 text-teal-600" />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{d.title}</div><div className="text-[11px] text-ink-muted">{t(`doc.${d.category}`)} · {fileSize(d.size)} · {date(d.document_date || d.uploaded_at, locale)}</div></div>
                  <Button size="sm" variant="outline" onClick={() => openSignedLink(`/partner/referrals/${id}/documents/${d.id}/link/`).catch((e) => toast.error(e.message))}>{t("common.open")}</Button>
                </li>
              ))}</ul>
            ) : <p className="py-4 text-center text-sm text-ink-muted">{t("common.empty")}</p>}
          </Card>
        </div>
      )}
      {tab === "opinion" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="mb-4 rounded-xl bg-teal-50 p-3 text-xs text-teal-900">{t("so.notice")}</p>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); post("opinion", fd, () => (e.target as HTMLFormElement).reset()); }} className="space-y-3">
              <Field label={t("partner.doctorName")} required><Input name="doctor_name" required /></Field>
              <Field label={t("partner.summary")} required><Textarea name="summary" rows={6} required /></Field>
              <Field label={t("partner.recommended")}><Textarea name="recommended_treatment" rows={3} /></Field>
              <Field label="PDF"><input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" /></Field>
              <Button type="submit" className="w-full"><Send className="size-4" />{t("partner.send")}</Button>
            </form>
          </Card>
          <div className="space-y-3">{r.opinions.map((o) => (
            <Card key={o.id}><div className="flex justify-between"><b>{o.doctor_name}</b><span className="text-xs text-ink-muted">{date(o.created_at, locale)}</span></div><p className="mt-2 whitespace-pre-line text-sm">{o.summary}</p>{o.recommended_treatment && <p className="mt-2 text-sm"><b>{t("partner.recommended")}:</b> {o.recommended_treatment}</p>}</Card>
          ))}</div>
        </div>
      )}
      {tab === "quotation" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
              post("quotation", { ...fd, amount_max: fd.amount_max || null, valid_until: fd.valid_until || null, hospital_stay_days: fd.hospital_stay_days || null, total_stay_days: fd.total_stay_days || null }, () => (e.target as HTMLFormElement).reset());
            }} className="grid gap-3 sm:grid-cols-2">
              <Field label={t("partner.plan")} required className="sm:col-span-2"><Textarea name="treatment_plan" rows={4} required /></Field>
              <Field label={t("partner.amountMin")} required><Input name="amount_min" type="number" step="any" min={0} required /></Field>
              <Field label={t("partner.amountMax")}><Input name="amount_max" type="number" step="any" min={0} /></Field>
              <Field label={t("ui.currency")}><Select name="currency">{["USD", "EUR", "INR", "TRY", "CNY", "KRW", "AED", "THB"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label={t("ui.type")}><Select name="quote_type"><option value="estimate">{t("common.estimate")}</option><option value="confirmed">{t("common.confirmed")}</option></Select></Field>
              <Field label={t("detail.hospitalStay")}><Input name="hospital_stay_days" type="number" min={0} /></Field>
              <Field label={`${t("detail.duration")} (${t("common.days")})`}><Input name="total_stay_days" type="number" min={0} /></Field>
              <Field label={t("detail.included")} className="sm:col-span-2"><Textarea name="includes" rows={2} /></Field>
              <Field label={t("detail.excluded")} className="sm:col-span-2"><Textarea name="excludes" rows={2} /></Field>
              <Field label={t("detail.extraCosts")} className="sm:col-span-2"><Textarea name="additional_expenses" rows={2} /></Field>
              <Field label={t("detail.validUntil")}><Input name="valid_until" type="date" /></Field>
              <Button type="submit" className="self-end"><Send className="size-4" />{t("partner.send")}</Button>
            </form>
          </Card>
          <div className="space-y-3">{r.quotations.map((x) => (
            <Card key={x.id}><div className="flex items-center justify-between"><b className="font-display text-lg">{money(x.amount_min, x.currency, locale)}{x.amount_max && ` – ${money(x.amount_max, x.currency, locale)}`}</b><Badge tone={x.status === "accepted" ? "success" : x.status === "rejected" ? "danger" : "neutral"}>{t(`quoteStatus.${x.status}`)}</Badge></div><div className="text-xs text-ink-muted">{x.quote_type === "confirmed" ? t("common.confirmed") : t("common.estimate")} · {date(x.created_at, locale)}</div><p className="mt-2 whitespace-pre-line text-sm">{x.treatment_plan}</p></Card>
          ))}</div>
        </div>
      )}
      {tab === "messages" && (
        <Card className="max-w-3xl">
          <div className="mb-4 space-y-2">
            {r.messages.map((m) => (
              <div key={m.id} className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm", m.mine ? "ml-auto rounded-br-md bg-navy-900 text-white" : "rounded-bl-md bg-mist")}>
                <p className="whitespace-pre-line">{m.text}</p>
                <p className={cn("mt-1 text-[10px]", m.mine ? "text-white/60" : "text-ink-muted")}>{m.author} · {date(m.created_at, locale, true)}</p>
              </div>
            ))}
            {!r.messages.length && <p className="py-6 text-center text-sm text-ink-muted">{t("common.empty")}</p>}
          </div>
          <div className="flex gap-2">
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("partner.messages")} onKeyDown={(e) => e.key === "Enter" && msg.trim() && post("message", { text: msg }, () => setMsg(""))} />
            <Button disabled={!msg.trim()} onClick={() => post("message", { text: msg }, () => setMsg(""))}><Send className="size-4" /></Button>
          </div>
        </Card>
      )}
    </>
  );
}
