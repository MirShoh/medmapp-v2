"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, CalendarClock, CheckCircle2, ChevronRight, FileText, FolderHeart, HeartPulse, Hotel, Lock, MessageCircle, Phone, Plane, Plus, Receipt,
  Send, ShieldCheck, Sparkles, Stethoscope, Trash2, Upload, UserRound,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/portal/shell";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, LoadingBlock, Modal, Select, Stat, Tabs, Textarea } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { ApiError, api, openSignedLink, type Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRefFilters } from "@/lib/hooks";
import { cn, date, fileSize, initials, money } from "@/lib/utils";

type Step = { key: string; label: string; done: boolean; current: boolean };
/** System history entries are stored as event keys and translated here; `note` holds only text staff typed. */
export function caseEventText(t: (k: string, v?: Record<string, string>) => string, h: { event?: string; event_arg?: string }) {
  if (!h.event) return "";
  const key = h.event === "sent_to_hospital" && !h.event_arg ? "sent_to_hospitalGeneric" : h.event;
  return t(`caseEvent.${key}`, { name: h.event_arg || "" });
}

type Case = {
  id: number; reference: string; case_type: string; title: string; status: string; status_label: string; specialty_name: string | null;
  destination_name: string | null; hospital_name: string | null; coordinator_name: string | null; description: string; patient_visible_note: string;
  journey: Step[]; created_at: string; updated_at: string;
};
type Doc = { id: number; title: string; category: string; description: string; document_date: string | null; original_name: string; size: number; uploaded_at: string; case_reference: string | null };
type Quote = { id: number; case: number; case_reference: string; hospital_name: string; treatment_plan: string; amount_min: string; amount_max: string | null; currency: string; quote_type: string; quote_type_label: string; status: string; includes: string; excludes: string; additional_expenses: string; valid_until: string | null; hospital_stay_days: number | null; total_stay_days: number | null };
type Overview = { patient: { full_name: string }; cases: Case[]; counts: { documents: number; quotations: number; requests: number; unread_notifications: number } };

const CATS = ["report", "blood_test", "mri", "ct", "xray", "ultrasound", "prescription", "discharge", "diagnosis", "opinion", "passport", "other"];

/* ---------------- Journey tracker ---------------- */
/** Progress through the treatment journey: numbered steps, the current one highlighted and named. */
export function Journey({ steps, compact }: { steps: Step[]; compact?: boolean }) {
  const t = useTranslations("dashUi");
  const idx = Math.max(0, steps.findIndex((s) => s.current));
  const current = steps[idx];
  return (
    <div>
      {!compact && current && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-bold text-navy-900">{current.label}</span>
          <span className="text-xs font-semibold text-ink-muted">{t("stepOf", { n: idx + 1, total: steps.length })}</span>
        </div>
      )}
      <ol className="flex items-center gap-1" aria-label={current?.label}>
        {steps.map((s, i) => (
          <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1" title={`${i + 1}. ${s.label}`}>
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold transition",
              s.current ? "bg-teal-500 text-white ring-4 ring-teal-100" : s.done ? "bg-teal-500/90 text-white" : "bg-mist text-ink-muted")}>
              {s.done && !s.current ? "✓" : i + 1}
            </span>
            {i < steps.length - 1 && <span className={cn("h-1 flex-1 rounded-full", s.done && !s.current ? "bg-teal-400" : "bg-line")} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** What the patient should do now, by the case's current journey step. */
const NEXT: Record<string, { href: string; icon: typeof Upload }> = {
  request_received: { href: "/dashboard/documents", icon: Upload },
  coordinator_assigned: { href: "/dashboard/documents", icon: Upload },
  documents_review: { href: "/dashboard/documents", icon: FolderHeart },
  hospital_consultation: { href: "", icon: Stethoscope },
  opinion_received: { href: "", icon: FileText },
  quotation_available: { href: "/dashboard/quotations", icon: Receipt },
  treatment_confirmed: { href: "/dashboard/travel", icon: CalendarClock },
  travel_preparation: { href: "/dashboard/travel", icon: Plane },
  in_treatment: { href: "/dashboard/support", icon: MessageCircle },
  follow_up: { href: "/dashboard/documents", icon: Upload },
};

type SiteContacts = { settings: { phone: string; email: string; socials: Record<string, string> } };

function CoordinatorCard({ name }: { name: string | null }) {
  const t = useTranslations("dashUi");
  const site = useQuery({ queryKey: ["site-contacts"], queryFn: () => api<SiteContacts>("/public/site/", { auth: false }), staleTime: 600_000 });
  const s = site.data?.settings;
  const tel = s?.phone?.replace(/[^\d+]/g, "");
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-navy-900 text-white"><UserRound className="size-5" /></span>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("coordinator")}</div>
          <div className="truncate font-display text-lg font-bold text-navy-900">{name || t("coordinatorSoon")}</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-soft">{t("coordinatorText")}</p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        {tel && <a href={`tel:${tel}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-500 text-sm font-semibold text-white hover:bg-teal-600"><Phone className="size-4" />{t("call")}</a>}
        {s?.socials?.telegram && <a href={s.socials.telegram} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800"><Send className="size-4" />Telegram</a>}
        <Link href="/dashboard/support" className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line-strong text-sm font-semibold text-navy-900 hover:bg-mist", !(tel && s?.socials?.telegram) ? "" : "col-span-2")}><MessageCircle className="size-4" />{t("write")}</Link>
      </div>
    </div>
  );
}

/* ---------------- Overview ---------------- */
export function PatientOverview() {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ["me-overview"], queryFn: () => api<Overview>("/me/overview/") });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorBox message={(q.error as Error)?.message || t("common.error")} onRetry={() => q.refetch()} />;
  const d = q.data;
  const active = d.cases.filter((c) => !["closed", "cancelled"].includes(c.status));
  const focus = [...active].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  return (
    <>
      <PageTitle title={`${t("dash.hello")}, ${user?.first_name || d.patient.full_name.split(" ")[0]}`} subtitle={t("dashUi.helloSub")}
        actions={<>
          <Link href="/dashboard/documents" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold"><Upload className="size-4" />{t("dash.uploadDocs")}</Link>
          <Button onClick={() => setCreating(true)}><Plus className="size-4" />{t("dash.newRequest")}</Button>
        </>} />
      {/* next step + coordinator */}
      {focus ? (() => {
        const step = focus.journey.find((x) => x.current) || focus.journey[0];
        const n = NEXT[step?.key] || { href: "", icon: Sparkles };
        const I = n.icon;
        const href = n.href || `/dashboard/cases/${focus.id}`;
        return (
          <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="bg-hero relative overflow-hidden rounded-3xl p-6 text-white sm:p-7">
              <div className="bg-grid pointer-events-none absolute inset-0" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-green-300"><Sparkles className="size-3.5" />{t("dashUi.nextStep")}</div>
                <div className="mt-3 flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-500 shadow-glow"><I className="size-6" /></span>
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-extrabold leading-snug text-white sm:text-2xl">{t(`dashUi.next_${step?.key}`)}</h2>
                    <p className="mt-1 text-sm text-white/70">{focus.title} · <span className="font-mono">{focus.reference}</span></p>
                  </div>
                </div>
                <Link href={href} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-navy-900 transition hover:bg-teal-50">
                  {t(`dashUi.cta_${step?.key}`)}<ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <CoordinatorCard name={focus.coordinator_name} />
          </div>
        );
      })() : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([["/dashboard/cases", <HeartPulse key="a" className="size-5" />, t("dash.cases"), active.length, "teal"],
          ["/dashboard/documents", <FolderHeart key="b" className="size-5" />, t("dash.documents"), d.counts.documents, "navy"],
          ["/dashboard/quotations", <Receipt key="c" className="size-5" />, t("dash.quotations"), d.counts.quotations, "sand"],
          ["/dashboard/requests", <Stethoscope key="d" className="size-5" />, t("dash.requests"), d.counts.requests, "navy"]] as const).map(([href, icon, label, value, tone]) => (
          <Link key={href} href={href} className="rounded-2xl transition hover:-translate-y-0.5 hover:shadow-lift">
            <Stat icon={icon} label={label} value={value} tone={tone === "teal" ? undefined : tone} />
          </Link>
        ))}
      </div>
      {d.cases.length === 0 ? (
        <div className="card flex flex-col items-center p-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-600"><HeartPulse className="size-6" /></span>
          <h2 className="mt-4 font-display text-xl font-bold">{t("dashUi.emptyTitle")}</h2>
          <p className="mt-1 max-w-md text-sm text-ink-soft">{t("dash.noCases")}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setCreating(true)}><Plus className="size-4" />{t("dash.newRequest")}</Button>
            <Link href="/dashboard/documents" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold"><Upload className="size-4" />{t("dash.uploadDocs")}</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold">{t("dash.cases")}</h2>
          {d.cases.map((c) => (
            <Link key={c.id} href={`/dashboard/cases/${c.id}`} className="card card-hover block p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs font-bold text-teal-700">{c.reference}</div>
                  <h3 className="mt-1 font-display text-lg font-bold">{c.title}</h3>
                  <p className="text-xs text-ink-muted">{[c.specialty_name, c.hospital_name || c.destination_name].filter(Boolean).join(" · ")}</p>
                </div>
                <Badge tone={["closed", "cancelled"].includes(c.status) ? "neutral" : "teal"}>{t(`case.${c.status}`)}</Badge>
              </div>
              <div className="mt-5"><Journey steps={c.journey.map((s) => ({ ...s, label: t(`case.${s.key}`) }))} /></div>
              {c.patient_visible_note && <p className="mt-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900"><b>{t("dash.latestUpdate")}:</b> {c.patient_visible_note}</p>}
              <p className="mt-3 flex items-center justify-between text-[11px] text-ink-muted"><span>{t("common.updated")} {date(c.updated_at, locale, true)}</span><span className="inline-flex items-center gap-1 font-semibold text-teal-700">{t("common.learnMore")}<ChevronRight className="size-3.5" /></span></p>
            </Link>
          ))}
        </div>
      )}
      <NewRequestModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function NewRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const qc = useQueryClient();
  const ref = useRefFilters();
  const [spec, setSpec] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      await api("/me/cases/", { body: fd });
      toast.success(t("form.success"));
      qc.invalidateQueries({ queryKey: ["me-overview"] });
      qc.invalidateQueries({ queryKey: ["me-cases"] });
      onClose();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t("dash.newRequest")}>
      <form onSubmit={submit} className="grid gap-3">
        <Field label={t("ui.type")}><Select name="case_type" defaultValue="treatment">
          <option value="treatment">{t("common.treatment")}</option><option value="second_opinion">{t("nav.secondOpinion")}</option>
          <option value="consultation">{t("nav.consult")}</option><option value="diagnostics">{t("ui.diagnostics")}</option>
        </Select></Field>
        <Field label={t("dash.title")}><Input name="title" required maxLength={200} /></Field>
        <Field label={t("common.specialty")}><Select name="specialty" value={spec} onChange={(e) => setSpec(e.target.value)}><option value="">—</option>{ref?.specialties.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</Select></Field>
        <Field label={t("common.treatment")}><Select name="treatment"><option value="">—</option>{ref?.treatments.filter((x) => !spec || String(x.specialty) === spec).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={t("form.destination")}><Select name="destination"><option value="">{t("home.searchCountry")}</option>{ref?.countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}</Select></Field>
        <Field label={t("form.message")}><Textarea name="description" rows={4} maxLength={4000} /></Field>
        <p className="text-xs text-ink-muted">{t("common.disclaimerMedical")}</p>
        <Button type="submit" loading={busy}>{t("form.submit")}</Button>
      </form>
    </Modal>
  );
}

/* ---------------- Cases ---------------- */
export function PatientCases() {
  const t = useTranslations();
  const q = useQuery({ queryKey: ["me-cases"], queryFn: () => api<Case[]>("/me/cases/") });
  if (q.isLoading) return <LoadingBlock />;
  return (
    <>
      <PageTitle title={t("dash.cases")} />
      {!q.data?.length ? <Empty icon={<HeartPulse className="size-5" />} title={t("dash.noCases")} /> : (
        <div className="card divide-y divide-line">
          {q.data.map((c) => (
            <Link key={c.id} href={`/dashboard/cases/${c.id}`} className="flex items-center gap-4 p-4 hover:bg-mist/50">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs font-bold text-teal-700">{c.reference}</div>
                <div className="truncate font-semibold text-navy-900">{c.title}</div>
                <div className="mt-2 max-w-md"><Journey compact steps={c.journey} /></div>
              </div>
              <Badge tone="teal">{t(`case.${c.status}`)}</Badge>
              <ChevronRight className="size-4 text-ink-muted" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

type CaseDetail = Case & {
  history: { status: string; label: string; note: string; date: string; event?: string; event_arg?: string }[];
  documents: Doc[];
  opinions: { id: number; hospital_name: string | null; doctor_name: string; summary: string; recommended_treatment: string; has_file: boolean; released_at: string | null; created_at: string }[];
  quotations: Quote[];
  appointments: { id: number; title: string; kind: string; scheduled_at: string; hospital_name: string | null; doctor_name: string | null; location: string; status: string }[];
  travel_plan: { arrival_date: string | null; departure_date: string | null; hotel_name: string; hotel_details: string; flight_details: string; airport_transfer: string; interpreter: string; visa_status: string; notes: string } | null;
};

export function PatientCaseDetail({ id }: { id: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "opinions" | "quotations" | "appointments" | "travel" | "documents">("overview");
  const q = useQuery({ queryKey: ["me-case", id], queryFn: () => api<CaseDetail>(`/me/cases/${id}/`) });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorBox message={(q.error as Error)?.message || t("common.error")} />;
  const c = q.data;
  const respond = async (quote: Quote, accept: boolean) => {
    try {
      await api(`/me/cases/${id}/quotations/${quote.id}/respond/`, { body: { accept } });
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["me-case", id] });
      qc.invalidateQueries({ queryKey: ["me-quotes"] });
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <>
      <div className="card mb-5 p-5">
        <div className="font-mono text-xs font-bold text-teal-700">{c.reference}</div>
        <h1 className="mt-1 font-display text-2xl font-extrabold">{c.title}</h1>
        <p className="text-sm text-ink-muted">{[c.specialty_name, c.hospital_name || c.destination_name, c.coordinator_name && `${t("dash.coordinator")}: ${c.coordinator_name}`].filter(Boolean).join(" · ")}</p>
        <div className="mt-5"><Journey steps={c.journey.map((s) => ({ ...s, label: t(`case.${s.key}`) }))} /></div>
        {c.patient_visible_note && <p className="mt-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900"><b>{t("dash.latestUpdate")}:</b> {c.patient_visible_note}</p>}
      </div>
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[
        { value: "overview", label: t("dash.journey") }, { value: "opinions", label: t("dash.opinions"), count: c.opinions.length },
        { value: "quotations", label: t("dash.quotations"), count: c.quotations.length }, { value: "appointments", label: t("dash.appointments"), count: c.appointments.length },
        { value: "travel", label: t("dash.travel") }, { value: "documents", label: t("dash.documents"), count: c.documents.length },
      ]} />
      {tab === "overview" && (
        <Card>
          {c.description && <p className="mb-5 whitespace-pre-line text-sm text-ink">{c.description}</p>}
          <ol className="relative space-y-4 border-l border-line pl-5">
            {c.history.map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[25px] top-1 size-2.5 rounded-full bg-teal-500 ring-4 ring-white" />
                <div className="text-sm font-semibold">{t(`case.${h.status}`)}</div>
                {h.event && <div className="text-sm text-ink-soft">{caseEventText(t, h)}</div>}
                {h.note && <div className="text-sm text-ink-soft">{h.note}</div>}
                <div className="text-[11px] text-ink-muted">{date(h.date, locale, true)}</div>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {tab === "opinions" && (c.opinions.length ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-teal-50 px-4 py-3 text-xs text-teal-900">{t("so.notice")}</p>
          {c.opinions.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-display font-bold">{o.doctor_name}{o.hospital_name && <span className="font-normal text-ink-muted"> · {o.hospital_name}</span>}</div>
                <span className="text-xs text-ink-muted">{date(o.released_at || o.created_at, locale)}</span>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{o.summary}</p>
              {o.recommended_treatment && <p className="mt-3 text-sm"><b>{t("partner.recommended")}:</b> {o.recommended_treatment}</p>}
              {o.has_file && <Button size="sm" variant="outline" className="mt-4" onClick={() => openSignedLink(`/me/opinions/${o.id}/link/`).catch((e) => toast.error(e.message))}><FileText className="size-4" />{t("common.download")}</Button>}
            </Card>
          ))}
        </div>
      ) : <Empty title={t("common.empty")} text={t("so.notice")} />)}
      {tab === "quotations" && (c.quotations.length ? <div className="space-y-4">{c.quotations.map((x) => <QuoteCard key={x.id} q={x} onRespond={(a) => respond(x, a)} />)}</div> : <Empty title={t("common.empty")} />)}
      {tab === "appointments" && (c.appointments.length ? (
        <div className="card divide-y divide-line">{c.appointments.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
            <CalendarClock className="size-5 text-teal-600" />
            <div className="flex-1"><div className="font-semibold">{a.title}</div><div className="text-xs text-ink-muted">{[t(`ak.${a.kind}`), a.hospital_name, a.doctor_name, a.location].filter(Boolean).join(" · ")}</div></div>
            <div className="text-right text-sm font-semibold">{date(a.scheduled_at, locale, true)}<div><Badge>{t(`as.${a.status}`)}</Badge></div></div>
          </div>
        ))}</div>
      ) : <Empty title={t("common.empty")} />)}
      {tab === "travel" && (c.travel_plan ? <TravelCard p={c.travel_plan} /> : <Empty icon={<Plane className="size-5" />} title={t("common.empty")} />)}
      {tab === "documents" && <DocList docs={c.documents} />}
    </>
  );
}

function QuoteCard({ q, onRespond }: { q: Quote; onRespond?: (accept: boolean) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const confirmed = q.quote_type === "confirmed";
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold">{q.hospital_name}</div>
          <div className="text-xs text-ink-muted"><span className="font-mono">{q.case_reference}</span>{q.valid_until && ` · ${t("detail.validUntil")} ${date(q.valid_until, locale)}`}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-extrabold">{money(q.amount_min, q.currency, locale)}{q.amount_max && ` – ${money(q.amount_max, q.currency, locale)}`}</div>
          <Badge tone={confirmed ? "success" : "sand"}>{confirmed ? t("common.confirmed") : t("common.estimate")}</Badge>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm">{q.treatment_plan}</p>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        {q.includes && <div><div className="text-xs font-semibold text-ink-muted">{t("detail.included")}</div><p className="whitespace-pre-line">{q.includes}</p></div>}
        {q.excludes && <div><div className="text-xs font-semibold text-ink-muted">{t("detail.excluded")}</div><p className="whitespace-pre-line">{q.excludes}</p></div>}
        {q.additional_expenses && <div className="sm:col-span-2"><div className="text-xs font-semibold text-ink-muted">{t("detail.extraCosts")}</div><p className="whitespace-pre-line">{q.additional_expenses}</p></div>}
      </div>
      {!confirmed && <p className="mt-3 text-xs text-ink-muted">{t("common.disclaimerPrice")}</p>}
      {q.status === "sent" && onRespond ? (
        <div className="mt-4 flex gap-2">
          <Button onClick={() => onRespond(true)}><CheckCircle2 className="size-4" />{t("dash.accept")}</Button>
          <Button variant="outline" onClick={() => onRespond(false)}>{t("dash.decline")}</Button>
        </div>
      ) : <div className="mt-4"><Badge tone={q.status === "accepted" ? "success" : q.status === "rejected" ? "danger" : "neutral"}>{t(`qs.${q.status}`)}</Badge></div>}
    </Card>
  );
}

function TravelCard({ p }: { p: NonNullable<CaseDetail["travel_plan"]> }) {
  const t = useTranslations();
  const locale = useLocale();
  const rows: [React.ReactNode, string, string | null | undefined][] = [
    [<Plane key="a" className="size-4" />, t("ui.arrivalDeparture"), [date(p.arrival_date, locale), date(p.departure_date, locale)].join(" → ")],
    [<Plane key="f" className="size-4" />, t("ui.flight"), p.flight_details], [<Hotel key="h" className="size-4" />, t("detail.accommodation"), [p.hotel_name, p.hotel_details].filter(Boolean).join("\n")],
    [<Plane key="t" className="size-4" />, t("ui.transfer"), p.airport_transfer], [<Stethoscope key="i" className="size-4" />, t("ui.interpreter"), p.interpreter],
    [<ShieldCheck key="v" className="size-4" />, t("detail.visa"), p.visa_status ? t(`vs.${p.visa_status}`) : ""], [<FileText key="n" className="size-4" />, t("ui.notes"), p.notes],
  ];
  return (
    <Card>
      <dl className="grid gap-4 sm:grid-cols-2">
        {rows.filter(([, , v]) => v).map(([icon, k, v]) => (
          <div key={k} className="flex gap-3"><span className="mt-0.5 text-teal-600">{icon}</span><div><dt className="text-xs text-ink-muted">{k}</dt><dd className="whitespace-pre-line text-sm font-medium">{v}</dd></div></div>
        ))}
      </dl>
    </Card>
  );
}

function DocList({ docs, onDelete }: { docs: Doc[]; onDelete?: (d: Doc) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  if (!docs.length) return <Empty icon={<FolderHeart className="size-5" />} title={t("common.empty")} />;
  return (
    <ul className="card divide-y divide-line">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-3 p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600"><FileText className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{d.title}</div>
            <div className="text-[11px] text-ink-muted">{t(`doc.${d.category}`)} · {fileSize(d.size)} · {date(d.document_date || d.uploaded_at, locale)}{d.case_reference && ` · ${d.case_reference}`}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => openSignedLink(`/me/documents/${d.id}/link/`).catch((e) => toast.error(e.message))}>{t("common.open")}</Button>
          {onDelete && <button onClick={() => onDelete(d)} className="rounded-lg p-2 text-ink-muted hover:bg-danger-soft hover:text-danger" aria-label={t("common.delete")}><Trash2 className="size-4" /></button>}
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Health Suitcase ---------------- */
export function HealthSuitcase() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "timeline">("list");
  const [cat, setCat] = useState("");
  const [up, setUp] = useState({ category: "report", title: "", document_date: "", description: "", case: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const docs = useQuery({ queryKey: ["me-docs", cat], queryFn: () => api<Doc[]>(`/me/documents/${cat ? `?category=${cat}` : ""}`) });
  const timeline = useQuery({ queryKey: ["me-docs-tl"], queryFn: () => api<{ month: string; documents: Doc[] }[]>("/me/documents/timeline/"), enabled: view === "timeline" });
  const cases = useQuery({ queryKey: ["me-cases"], queryFn: () => api<Case[]>("/me/cases/") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["me-docs"] }); qc.invalidateQueries({ queryKey: ["me-docs-tl"] }); qc.invalidateQueries({ queryKey: ["me-overview"] }); };
  const upload = async () => {
    if (!files.length) return;
    const fd = new FormData();
    Object.entries(up).forEach(([k, v]) => v && fd.append(k, v));
    files.forEach((f) => fd.append("files", f));
    setBusy(true);
    try {
      await api("/me/documents/", { form: fd });
      toast.success(t("common.saved"));
      setFiles([]);
      setUp({ ...up, title: "", description: "" });
      refresh();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : t("common.error")); } finally { setBusy(false); }
  };
  const del = async (d: Doc) => {
    if (!confirm(t("admin.confirmDelete"))) return;
    try { await api(`/me/documents/${d.id}/`, { method: "DELETE" }); refresh(); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <>
      <PageTitle title={t("dash.documents")} subtitle={t("dash.privateNote")} />
      <Card className="mb-6">
        <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); setFiles(Array.from(e.dataTransfer.files || []).slice(0, 15)); }}
          className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
            drag ? "border-teal-500 bg-teal-50" : "border-line-strong bg-mist/50 hover:border-teal-400 hover:bg-teal-50/50")}>
          <span className="grid size-12 place-items-center rounded-2xl bg-teal-500 text-white shadow-glow"><Upload className="size-5" /></span>
          <span className="mt-3 font-display font-bold text-navy-900">{files.length ? t("dashUi.filesChosen", { n: files.length }) : t("dashUi.dropTitle")}</span>
          <span className="mt-1 max-w-lg text-xs text-ink-muted">{files.length ? files.map((f) => f.name).join(", ").slice(0, 120) : t("dashUi.dropHint")}</span>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm,.doc,.docx,.zip" className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 15))} />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={t("dash.category")}><Select value={up.category} onChange={(e) => setUp({ ...up, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{t(`doc.${c}`)}</option>)}</Select></Field>
          <Field label={t("dash.cases")}><Select value={up.case} onChange={(e) => setUp({ ...up, case: e.target.value })}><option value="">{t("dashUi.noCase")}</option>{cases.data?.map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.title}</option>)}</Select></Field>
        </div>
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-teal-700 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1"><ChevronRight className="size-4 transition group-open:rotate-90" />{t("dashUi.moreDetails")}</span>
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label={t("dash.title")}><Input value={up.title} onChange={(e) => setUp({ ...up, title: e.target.value })} disabled={files.length > 1} /></Field>
            <Field label={t("dash.docDate")}><Input type="date" value={up.document_date} onChange={(e) => setUp({ ...up, document_date: e.target.value })} /></Field>
            <Field label={t("dash.description")}><Input value={up.description} onChange={(e) => setUp({ ...up, description: e.target.value })} /></Field>
          </div>
        </details>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={upload} loading={busy} disabled={!files.length}><Upload className="size-4" />{t("dash.uploadDocs")}</Button>
          {files.length > 0 && <button type="button" onClick={() => setFiles([])} className="text-sm text-ink-muted hover:text-danger">{t("common.cancel")}</button>}
          <span className="ml-auto flex items-center gap-1 text-xs text-ink-muted"><Lock className="size-3.5" />{t("form.filesHint")}</span>
        </div>
      </Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={view} onChange={setView} tabs={[{ value: "list", label: t("dash.documents") }, { value: "timeline", label: t("dash.timeline") }]} />
        {view === "list" && <Select className="ml-auto h-9 w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">{t("dash.category")}: {t("common.all")}</option>{CATS.map((c) => <option key={c} value={c}>{t(`doc.${c}`)}</option>)}</Select>}
      </div>
      {view === "list" ? (docs.isLoading ? <LoadingBlock /> : <DocList docs={docs.data || []} onDelete={del} />) : timeline.isLoading ? <LoadingBlock /> : (
        timeline.data?.length ? (
          <ol className="relative space-y-6 border-l-2 border-dashed border-teal-300 pl-6">
            {timeline.data.map((g) => (
              <li key={g.month} className="relative">
                <span className="absolute -left-[33px] top-0.5 size-4 rounded-full border-4 border-white bg-teal-500" />
                <div className="mb-2 font-display font-bold">{date(`${g.month}-01`, locale).replace(/^\d+\s/, "")}</div>
                <DocList docs={g.documents} />
              </li>
            ))}
          </ol>
        ) : <Empty title={t("common.empty")} />
      )}
    </>
  );
}

/* ---------------- Quotations (all cases) ---------------- */
export function PatientQuotations() {
  const t = useTranslations();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me-quotes"], queryFn: () => api<Quote[]>("/me/quotations/") });
  const respond = async (x: Quote, accept: boolean) => {
    try { await api(`/me/cases/${x.case}/quotations/${x.id}/respond/`, { body: { accept } }); toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["me-quotes"] }); } catch (e) { toast.error((e as Error).message); }
  };
  if (q.isLoading) return <LoadingBlock />;
  return (
    <>
      <PageTitle title={t("dash.quotations")} subtitle={t("common.disclaimerPrice")} />
      {q.data?.length ? <div className="space-y-4">{q.data.map((x) => <QuoteCard key={x.id} q={x} onRespond={(a) => respond(x, a)} />)}</div> : <Empty icon={<Receipt className="size-5" />} title={t("common.empty")} />}
    </>
  );
}

/* ---------------- Appointments & travel (all cases) ---------------- */
export function PatientTravel() {
  const t = useTranslations();
  const cases = useQuery({ queryKey: ["me-cases"], queryFn: () => api<Case[]>("/me/cases/") });
  const ids = (cases.data || []).map((c) => c.id);
  const details = useQuery({ queryKey: ["me-case-details", ids.join(",")], enabled: ids.length > 0, queryFn: () => Promise.all(ids.map((id) => api<CaseDetail>(`/me/cases/${id}/`))) });
  if (cases.isLoading || (ids.length && details.isLoading)) return <LoadingBlock />;
  const withData = (details.data || []).filter((c) => c.travel_plan || c.appointments.length);
  return (
    <>
      <PageTitle title={`${t("dash.appointments")} · ${t("dash.travel")}`} />
      {!withData.length ? <Empty icon={<Plane className="size-5" />} title={t("common.empty")} /> : (
        <div className="space-y-6">
          {withData.map((c) => (
            <section key={c.id}>
              <Link href={`/dashboard/cases/${c.id}`} className="mb-2 inline-block font-mono text-xs font-bold text-teal-700">{c.reference} · {c.title}</Link>
              {c.travel_plan && <TravelCard p={c.travel_plan} />}
              {c.appointments.length > 0 && <AppointmentsList items={c.appointments} />}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function AppointmentsList({ items }: { items: CaseDetail["appointments"] }) {
  const locale = useLocale();
  const t = useTranslations();
  return (
    <ul className="card mt-3 divide-y divide-line">
      {items.map((a) => <li key={a.id} className="flex justify-between gap-3 p-3 text-sm"><span><b>{a.title}</b> · {t(`ak.${a.kind}`)}{a.hospital_name && ` · ${a.hospital_name}`}</span><span className="text-ink-muted">{date(a.scheduled_at, locale, true)}</span></li>)}
    </ul>
  );
}

/* ---------------- Requests ---------------- */
export function PatientRequests() {
  const t = useTranslations();
  const locale = useLocale();
  const q = useQuery({ queryKey: ["me-requests"], queryFn: () => api<{ id: number; reference: string; created_at: string; treatment: string | null; specialty: string | null; destination: string | null; service: string | null; status: string; message: string }[]>("/me/requests/") });
  if (q.isLoading) return <LoadingBlock />;
  return (
    <>
      <PageTitle title={t("dash.requests")} />
      {!q.data?.length ? <Empty title={t("common.empty")} action={<Link href="/about#contact" className="font-semibold text-teal-700">{t("nav.consult")} →</Link>} /> : (
        <div className="card divide-y divide-line">
          {q.data.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex-1">
                <div className="font-mono text-xs font-bold text-teal-700">{r.reference}</div>
                <div className="text-sm font-semibold">{[r.service, r.treatment || r.specialty, r.destination].filter(Boolean).join(" · ") || t("nav.consult")}</div>
                {r.message && <p className="line-clamp-2 text-xs text-ink-muted">{r.message}</p>}
              </div>
              <span className="text-xs text-ink-muted">{date(r.created_at, locale)}</span>
              <Badge tone={r.status === "active" ? "teal" : "neutral"}>{r.status === "active" ? t("dash.active") : t("case.closed")}</Badge>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Profile ---------------- */
type Profile = { full_name: string; phone: string; email: string; passport_number: string; date_of_birth: string | null; gender: string; country: number | null; city: string; address: string; preferred_language: string; blood_type: string; allergies: string; chronic_conditions: string; current_medications: string; emergency_contact: string };
const BLOOD = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

function Section({ id, icon: Icon, title, hint, children }: { id: string; icon: typeof UserRound; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600"><Icon className="size-5" /></span>
        <div><h2 className="font-display text-lg font-bold">{title}</h2>{hint && <p className="text-xs text-ink-muted">{hint}</p>}</div>
      </div>
      {children}
    </Card>
  );
}

export function PatientProfile() {
  const t = useTranslations();
  const pu = useTranslations("profileUi");
  const qc = useQueryClient();
  const ref = useRefFilters();
  const q = useQuery({ queryKey: ["me-profile"], queryFn: () => api<Profile>("/me/profile/") });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  if (q.isLoading || !q.data) return <LoadingBlock />;
  const p = q.data;
  const checks = [p.full_name, p.phone, p.email, p.passport_number, p.date_of_birth, p.gender, p.country, p.city, p.blood_type, p.emergency_contact];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      await api("/me/profile/", { method: "PATCH", body: { ...fd, country: fd.country || null, date_of_birth: fd.date_of_birth || null } });
      toast.success(t("common.saved"));
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["me-profile"] });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const changePw = async () => {
    try { await api("/auth/change-password/", { body: pw }); setPw({ old_password: "", new_password: "" }); toast.success(t("common.saved")); } catch (e) { toast.error((e as Error).message); }
  };
  const jump = [["personal", pu("personal")], ["medical", pu("medical")], ["security", pu("security")], ["privacy", pu("privacy")]] as const;
  return (
    <>
      <div className="mb-6 overflow-hidden rounded-3xl bg-navy-950 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 font-display text-xl font-extrabold">{initials(p.full_name)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-extrabold text-white">{p.full_name}</h1>
            <p className="mt-0.5 text-sm text-white/60">{[p.phone, p.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="w-full sm:w-64">
            <div className="flex justify-between text-xs font-semibold"><span className="text-white/70">{pu("completeness")}</span><span className="text-teal-300">{pct}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${pct}%` }} /></div>
            {pct < 100 && <p className="mt-2 text-[11px] text-white/50">{pu("completeHint")}</p>}
          </div>
        </div>
        <nav className="mt-6 flex flex-wrap gap-2">
          {jump.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/20 hover:text-white">{label}</a>)}
        </nav>
      </div>
      <div className="max-w-4xl space-y-6">
        <form onSubmit={save} onChange={() => setDirty(true)} className="space-y-6">
          <Section id="personal" icon={UserRound} title={pu("personal")} hint={pu("personalHint")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("form.fullName")} required><Input name="full_name" defaultValue={p.full_name} required /></Field>
              <Field label={t("form.phone")} required><Input name="phone" type="tel" defaultValue={p.phone} required /></Field>
              <Field label={t("form.email")}><Input name="email" type="email" defaultValue={p.email} /></Field>
              <Field label={t("form.passport")} hint={pu("passportHint")}><Input name="passport_number" defaultValue={p.passport_number} className="font-mono uppercase" placeholder="AA1234567" maxLength={20} autoComplete="off" /></Field>
              <Field label={t("ui.dob")}><Input name="date_of_birth" type="date" defaultValue={p.date_of_birth || ""} /></Field>
              <Field label={t("ui.gender")}><Select name="gender" defaultValue={p.gender}><option value="">—</option><option value="male">{t("ui.male")}</option><option value="female">{t("ui.female")}</option><option value="other">{t("ui.otherGender")}</option></Select></Field>
              <Field label={t("common.country")}><Select name="country" defaultValue={p.country || ""}><option value="">—</option>{ref?.countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
              <Field label={t("common.city")}><Input name="city" defaultValue={p.city} /></Field>
              <Field label={t("ui.address")} className="sm:col-span-2"><Input name="address" defaultValue={p.address} /></Field>
              <Field label={t("common.language")}><Select name="preferred_language" defaultValue={p.preferred_language}><option value="uz">O‘zbekcha</option><option value="ru">Русский</option><option value="en">English</option></Select></Field>
              <Field label={t("ui.emergency")} hint={pu("emergencyHint")}><Input name="emergency_contact" defaultValue={p.emergency_contact} /></Field>
            </div>
          </Section>
          <Section id="medical" icon={HeartPulse} title={pu("medical")} hint={t("dash.privateNote")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("ui.bloodType")}><Select name="blood_type" defaultValue={p.blood_type}><option value="">{pu("unknown")}</option>{BLOOD.map((b) => <option key={b} value={b}>{b}</option>)}{p.blood_type && !BLOOD.includes(p.blood_type) && <option value={p.blood_type}>{p.blood_type}</option>}</Select></Field>
              <div className="hidden sm:block" />
              <Field label={t("ui.allergies")} className="sm:col-span-2"><Textarea name="allergies" rows={2} defaultValue={p.allergies} placeholder={pu("allergiesPh")} /></Field>
              <Field label={t("ui.chronic")} className="sm:col-span-2"><Textarea name="chronic_conditions" rows={2} defaultValue={p.chronic_conditions} /></Field>
              <Field label={t("ui.meds")} className="sm:col-span-2"><Textarea name="current_medications" rows={2} defaultValue={p.current_medications} /></Field>
            </div>
          </Section>
          <div className={cn("flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/95 p-3 pl-5 backdrop-blur transition", dirty && "sticky bottom-4 z-20 shadow-lift")}>
            <span className="text-xs text-ink-muted">{dirty ? pu("unsaved") : pu("saved")}</span>
            <Button type="submit" loading={busy} disabled={!dirty}>{t("common.save")}</Button>
          </div>
        </form>
        <Section id="security" icon={Lock} title={pu("security")} hint={pu("securityHint")}>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input type="password" autoComplete="current-password" placeholder={t("ui.currentPassword")} value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} />
            <Input type="password" autoComplete="new-password" placeholder={t("ui.newPassword")} minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            <Button variant="secondary" disabled={!pw.old_password || pw.new_password.length < 8} onClick={changePw}>{t("common.save")}</Button>
          </div>
        </Section>
        <Section id="privacy" icon={ShieldCheck} title={pu("privacy")} hint={t("dash.privateNote")}><PatientConsents embedded /></Section>
      </div>
    </>
  );
}

/* ---------------- Consents (shown inside the profile) ---------------- */
type Consent = { id: number; scope: string; scope_label: string; hospital: number | null; hospital_name: string | null; granted_at: string; revoked_at: string | null; active: boolean };
export function PatientConsents({ embedded }: { embedded?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me-consents"], queryFn: () => api<Consent[]>("/me/consents/") });
  const hospitals = useQuery({ queryKey: ["pub-hospitals"], queryFn: () => api<Paginated<{ id: number; name: string }>>("/public/hospitals/?page_size=200") }).data?.results || [];
  const [hospital, setHospital] = useState("");
  const grant = async () => {
    try { await api("/me/consents/", { body: { scope: "share_with_hospital", hospital: Number(hospital) } }); setHospital(""); qc.invalidateQueries({ queryKey: ["me-consents"] }); toast.success(t("common.saved")); } catch (e) { toast.error((e as Error).message); }
  };
  const revoke = async (c: Consent) => {
    try { await api(`/me/consents/${c.id}/revoke/`, { method: "POST" }); qc.invalidateQueries({ queryKey: ["me-consents"] }); toast.success(t("common.saved")); } catch (e) { toast.error((e as Error).message); }
  };
  const body = (
    <>
      <div className="mb-4 rounded-2xl bg-mist p-4">
        <div className="text-sm font-semibold">{t("dash.grantShare")}</div>
        <p className="mb-3 text-xs text-ink-muted">{t("partner.sharedDocs")}</p>
        <div className="flex flex-wrap gap-2">
          <Select className="max-w-sm" value={hospital} onChange={(e) => setHospital(e.target.value)}><option value="">{t("common.hospital")}…</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select>
          <Button disabled={!hospital} onClick={grant}>{t("common.add")}</Button>
        </div>
      </div>
      {q.isLoading ? <LoadingBlock /> : !q.data?.length ? <p className="text-sm text-ink-muted">{t("common.empty")}</p> : (
        <div className="divide-y divide-line rounded-2xl border border-line">
          {q.data.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex-1"><div className="text-sm font-semibold">{t.has(`consentScope.${c.scope}`) ? t(`consentScope.${c.scope}`) : c.scope_label}{c.hospital_name && ` · ${c.hospital_name}`}</div>
                <div className="text-[11px] text-ink-muted">{date(c.granted_at, locale, true)}{c.revoked_at && ` → ${date(c.revoked_at, locale, true)}`}</div></div>
              <Badge tone={c.active ? "success" : "danger"}>{c.active ? t("dash.active") : t("dash.revoked")}</Badge>
              {c.active && c.scope !== "data_processing" && <Button size="sm" variant="outline" onClick={() => revoke(c)}>{t("dash.revoke")}</Button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
  if (embedded) return body;
  return <><PageTitle title={t("dash.consents")} subtitle={t("dash.privateNote")} />{body}</>;
}

/* ---------------- Support: direct chat with the MedMapp team ---------------- */
export { PatientChat as PatientSupport } from "@/components/chat";
