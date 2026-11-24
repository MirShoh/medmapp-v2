"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Eye, Lightbulb, MessagesSquare, Phone, Send, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/portal/shell";
import { Badge, Button, Card, Checkbox, Empty, ErrorBox, Field, Input, LoadingBlock, Modal, Select, Tabs, Textarea } from "@/components/ui";
import { caseEventText } from "@/components/dashboard/patient";
import { Link, useRouter } from "@/i18n/navigation";
import { api, openSignedLink, type Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useHospitalsLite, useStaff } from "@/lib/hooks";
import { cn, date, money } from "@/lib/utils";
import { DocumentsPanel } from "./patients";

const JOURNEY = ["request_received", "coordinator_assigned", "documents_review", "hospital_consultation", "opinion_received", "quotation_available", "treatment_confirmed", "travel_preparation", "in_treatment", "follow_up"];
const ALL_STATUSES = [...JOURNEY, "closed", "cancelled"];

type CaseRow = { id: number; reference: string; title: string; case_type: string; status: string; patient: number; patient_name: string; patient_phone: string; coordinator: number | null; coordinator_name: string | null; destination_name: string | null; hospital_name: string | null; specialty_name: string | null; created_at: string; updated_at: string; journey_index: number; patient_visible_note: string; description: string };

export function CasesList() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") || "");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [unassigned, setUnassigned] = useState(sp.get("unassigned") === "1");
  const q = useQuery({ queryKey: ["cases", status, type, search, mine, unassigned], queryFn: () => api<Paginated<CaseRow>>(`/admin/cases/?page_size=50${status ? `&status=${status}` : ""}${type ? `&case_type=${type}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}${mine ? "&mine=1" : ""}${unassigned ? "&unassigned=1" : ""}`) });
  return (
    <>
      <PageTitle title={t("admin.cases")} subtitle={q.data && `${q.data.count} ${t("common.results")}`} />
      <div className="card mb-4 flex flex-wrap gap-2 p-3">
        <Input className="h-9 max-w-xs" placeholder={t("admin.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select className="h-9 w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t("common.status")}: {t("common.all")}</option>{ALL_STATUSES.map((s) => <option key={s} value={s}>{t(`case.${s}`)}</option>)}</Select>
        <Select className="h-9 w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">{t("adminUi.caseType")}: {t("common.all")}</option>{["treatment", "second_opinion", "consultation", "diagnostics"].map((s) => <option key={s} value={s}>{t(`caseType.${s}`)}</option>)}</Select>
        <button onClick={() => setMine(!mine)} className={cn("h-9 rounded-xl border px-3 text-xs font-semibold", mine ? "border-teal-500 bg-teal-50 text-teal-700" : "border-line-strong text-ink-soft")}>{t("adminUi.myCases")}</button>
        <button onClick={() => setUnassigned(!unassigned)} className={cn("h-9 rounded-xl border px-3 text-xs font-semibold", unassigned ? "border-amber-400 bg-amber-50 text-amber-700" : "border-line-strong text-ink-soft")}>{t("adminUi.noCoordinator")}</button>
      </div>
      {q.isLoading ? <LoadingBlock /> : !q.data?.results.length ? <Empty title={t("common.empty")} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-mist/70 text-left text-xs font-semibold text-ink-muted"><tr><th className="p-3">{t("adminUi.ref")}</th><th className="p-3">{t("common.name")}</th><th className="p-3">{t("common.status")}</th><th className="p-3">{t("dash.coordinator")}</th><th className="p-3">{t("common.hospital")}</th><th className="p-3">{t("common.updated")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {q.data.results.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-mist/50" onClick={() => router.push(`/admin/cases/${c.id}`)}>
                  <td className="p-3 font-mono text-xs font-bold">{c.reference}<div className="font-sans text-[11px] font-normal text-ink-muted">{t(`caseType.${c.case_type}`)}</div></td>
                  <td className="p-3"><div className="font-semibold text-navy-900">{c.patient_name}</div><div className="text-xs text-ink-muted">{c.title}</div></td>
                  <td className="p-3"><div className="text-xs font-semibold">{t(`case.${c.status}`)}</div><div className="mt-1 flex w-28 gap-0.5">{JOURNEY.map((_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i <= c.journey_index ? "bg-teal-500" : "bg-line")} />)}</div></td>
                  <td className="p-3 text-xs">{c.coordinator_name || <span className="font-semibold text-amber-600">{t("adminUi.noCoordinator")}</span>}</td><td className="p-3 text-xs">{c.hospital_name || c.destination_name || "—"}</td><td className="p-3 text-xs text-ink-muted">{date(c.updated_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type Doc = Parameters<typeof DocumentsPanel>[0]["docs"][number];
type CaseDetail = CaseRow & {
  history: { id: number; from_status: string; to_status: string; note: string; event?: string; event_arg?: string; actor_name: string | null; created_at: string; visible_to_patient: boolean }[];
  documents: Doc[]; patient_documents: Doc[];
  referrals: { id: number; hospital: number; hospital_name: string; status: string; shared_documents: Doc[]; message_to_hospital: string; messages: { id: number; author: string | null; text: string; created_at: string; from_partner: boolean }[] }[];
  opinions: { id: number; hospital_name: string | null; doctor_name: string; summary: string; recommended_treatment: string; released_to_patient: boolean; has_file: boolean; created_at: string }[];
  quotations: { id: number; hospital: number; hospital_name: string; treatment_plan: string; amount_min: string; amount_max: string | null; currency: string; quote_type: string; quote_type_label: string; status: string; includes: string; excludes: string; valid_until: string | null }[];
  appointments: { id: number; title: string; kind: string; scheduled_at: string; hospital_name: string | null; status: string; location: string }[];
  travel_plan: Record<string, string | number | null> | null;
  consents: { id: number; scope: string; hospital: number | null; hospital_name: string | null; active: boolean; granted_at: string }[];
};

type CTab = "overview" | "documents" | "referrals" | "opinions" | "quotations" | "appointments" | "travel" | "history";

/** What the coordinator should do next at each step, and which tab it happens in. */
const NEXT_ACTION: Record<string, CTab> = {
  request_received: "overview", coordinator_assigned: "documents", documents_review: "referrals", hospital_consultation: "opinions",
  opinion_received: "opinions", quotation_available: "quotations", treatment_confirmed: "travel", travel_preparation: "appointments",
  in_treatment: "appointments", follow_up: "history",
};

export function CaseWorkspace({ id }: { id: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const { can } = useAuth();
  const staff = useStaff();
  const hospitals = useHospitalsLite();
  const [tab, setTab] = useState<CTab>("overview");
  const [statusForm, setStatusForm] = useState<{ status: string; note: string; patient_note: string } | null>(null);
  const [referOpen, setReferOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [opinionOpen, setOpinionOpen] = useState(false);
  const q = useQuery({ queryKey: ["case", id], queryFn: () => api<CaseDetail>(`/admin/cases/${id}/`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["case", id] });
  const act = async (path: string, body: Record<string, unknown> = {}, ok?: () => void) => {
    try { await api(path, { body }); toast.success(t("common.saved")); refresh(); ok?.(); } catch (e) { toast.error((e as Error).message); }
  };
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorBox message={(q.error as Error)?.message || t("common.error")} />;
  const c = q.data;
  const edit = can("medical.edit");
  const next = c.journey_index >= 0 && c.journey_index < JOURNEY.length - 1 ? JOURNEY[c.journey_index + 1] : null;
  const hint = !c.coordinator ? "assign" : c.status;
  const hintTab: CTab = !c.coordinator ? "overview" : NEXT_ACTION[c.status] || "overview";
  const tabs: { value: CTab; label: string; count?: number }[] = [
    { value: "overview", label: t("admin.tab.overview") }, { value: "documents", label: t("admin.tab.documents"), count: c.documents.length + c.patient_documents.length },
    { value: "referrals", label: t("admin.referrals"), count: c.referrals.length }, { value: "opinions", label: t("dash.opinions"), count: c.opinions.length },
    { value: "quotations", label: t("admin.tab.quotations"), count: c.quotations.length }, { value: "appointments", label: t("dash.appointments"), count: c.appointments.length },
    { value: "travel", label: t("admin.tab.travel") }, { value: "history", label: t("admin.tab.timeline"), count: c.history.length },
  ];
  return (
    <>
      <div className="card mb-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-mono text-xs font-bold text-teal-700">{c.reference} · <span className="font-sans">{t(`caseType.${c.case_type}`)}</span></div>
            <h1 className="mt-1 font-display text-2xl font-extrabold">{c.title || c.patient_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link href={`/admin/patients/${c.patient}`} className="font-semibold text-navy-900 hover:text-teal-700">{c.patient_name}</Link>
              {c.patient_phone && <a href={`tel:${c.patient_phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-ink-soft hover:text-teal-700"><Phone className="size-3.5" />{c.patient_phone}</a>}
              <Link href={`/admin/chats?patient=${c.patient}`} className="inline-flex items-center gap-1 text-ink-soft hover:text-teal-700"><MessagesSquare className="size-3.5" />{t("p360.chat")}</Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {edit && <Select className="h-9 w-48" value={c.coordinator || ""} onChange={(e) => act(`/admin/cases/${id}/assign/`, { coordinator: e.target.value || null })}>
              <option value="">{t("dash.coordinator")}: —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>}
            {edit && next && <Button size="sm" onClick={() => setStatusForm({ status: next, note: "", patient_note: "" })}><ArrowRight className="size-3.5" />{t("caseUi.moveTo", { status: t(`case.${next}`) })}</Button>}
            {edit && <Button size="sm" variant="outline" onClick={() => setStatusForm({ status: c.status, note: "", patient_note: c.patient_visible_note })}>{t("caseUi.changeStatus")}</Button>}
          </div>
        </div>
        <ol className="scrollbar-thin mt-5 flex gap-1 overflow-x-auto pb-1">
          {JOURNEY.map((s, i) => (
            <li key={s} className="min-w-24 flex-1">
              <div className={cn("h-1.5 rounded-full", i <= c.journey_index ? "bg-teal-500" : "bg-line")} />
              <div className={cn("mt-1.5 text-[10px] leading-tight", i === c.journey_index ? "font-bold text-teal-700" : "text-ink-muted")}>{t(`case.${s}`)}</div>
            </li>
          ))}
        </ol>
        {["closed", "cancelled"].includes(c.status) && <Badge tone="danger" className="mt-3">{t(`case.${c.status}`)}</Badge>}
        {!["closed", "cancelled"].includes(c.status) && t.has(`caseHint.${hint}`) && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-teal-50 px-4 py-3">
            <Lightbulb className="size-5 shrink-0 text-teal-600" />
            <div className="min-w-0 flex-1"><div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">{t("caseUi.nextStep")}</div><div className="text-sm font-semibold text-navy-900">{t(`caseHint.${hint}`)}</div></div>
            {hintTab !== tab && hintTab !== "overview" && <Button size="sm" variant="outline" onClick={() => setTab(hintTab)}>{t("caseUi.open")}<ArrowRight className="size-3.5" /></Button>}
          </div>
        )}
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-5" />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><h3 className="mb-2 font-display font-bold">{t("dash.description")}</h3><p className="whitespace-pre-line text-sm text-ink">{c.description || "—"}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-ink-muted">{t("common.specialty")}</dt><dd>{c.specialty_name || "—"}</dd></div><div><dt className="text-xs text-ink-muted">{t("form.destination")}</dt><dd>{c.destination_name || "—"}</dd></div></dl></Card>
          <Card><h3 className="mb-2 font-display font-bold">{t("dash.latestUpdate")}</h3><p className="text-sm">{c.patient_visible_note || "—"}</p>
            <h3 className="mb-2 mt-5 flex items-center gap-1.5 font-display font-bold"><ShieldCheck className="size-4 text-teal-600" />{t("dash.consents")}</h3>
            <ul className="space-y-1.5 text-sm">{c.consents.map((x) => <li key={x.id} className="flex justify-between"><span>{t.has(`consentScope.${x.scope}`) ? t(`consentScope.${x.scope}`) : x.scope}{x.hospital_name && ` · ${x.hospital_name}`}</span><Badge tone={x.active ? "success" : "danger"}>{x.active ? t("dash.active") : t("dash.revoked")}</Badge></li>)}</ul>
            {!c.consents.length && <p className="text-sm text-ink-muted">—</p>}
          </Card>
        </div>
      )}
      {tab === "documents" && (
        <div className="space-y-4">
          <DocumentsPanel patientId={c.patient} caseId={c.id} docs={c.documents} onChange={refresh} />
          {c.patient_documents.length > 0 && <div><h3 className="mb-2 text-sm font-semibold text-ink-muted">{t("caseUi.otherDocs")}</h3><DocumentsPanel patientId={c.patient} docs={c.patient_documents} onChange={refresh} /></div>}
        </div>
      )}
      {tab === "referrals" && (
        <div className="space-y-4">
          {edit && <Button onClick={() => setReferOpen(true)}><Send className="size-4" />{t("caseUi.refer")}</Button>}
          {c.referrals.map((r) => <ReferralCard key={r.id} r={r} onMessage={(text) => act(`/admin/referrals/${r.id}/message/`, { text })} />)}
          {!c.referrals.length && <Empty title={t("common.empty")} />}
        </div>
      )}
      {tab === "opinions" && (
        <div className="space-y-4">
          {edit && <Button onClick={() => setOpinionOpen(true)}>{t("partner.submitOpinion")}</Button>}
          {c.opinions.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-display font-bold">{o.hospital_name || "—"} · {o.doctor_name}</div>
                {o.released_to_patient ? <Badge tone="success"><Eye className="size-3" />{t("caseUi.released")}</Badge> : edit && <Button size="sm" onClick={() => act(`/admin/cases/${id}/opinions/${o.id}/release/`)}>{t("caseUi.release")}</Button>}</div>
              <p className="mt-2 whitespace-pre-line text-sm">{o.summary}</p>
              {o.recommended_treatment && <p className="mt-2 text-sm"><b>{t("partner.recommended")}:</b> {o.recommended_treatment}</p>}
              <p className="mt-2 text-[11px] text-ink-muted">{date(o.created_at, locale, true)}</p>
            </Card>
          ))}
          {!c.opinions.length && <Empty title={t("common.empty")} text={t("so.notice")} />}
        </div>
      )}
      {tab === "quotations" && (
        <div className="space-y-4">
          {can("quotations.edit") && <Button onClick={() => setQuoteOpen(true)}>{t("partner.submitQuote")}</Button>}
          {c.quotations.map((x) => (
            <Card key={x.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><div className="font-display font-bold">{x.hospital_name}</div><div className="text-xs text-ink-muted">{x.quote_type_label}{x.valid_until && ` · ${t("detail.validUntil")} ${date(x.valid_until, locale)}`}</div></div>
                <div className="text-right"><div className="font-display text-xl font-extrabold">{money(x.amount_min, x.currency, locale)}{x.amount_max && ` – ${money(x.amount_max, x.currency, locale)}`}</div><Badge tone={x.status === "accepted" ? "success" : x.status === "rejected" ? "danger" : "neutral"}>{t(`quoteStatus.${x.status}`)}</Badge></div>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">{x.treatment_plan}</p>
              {can("quotations.edit") && ["draft", "submitted"].includes(x.status) && <Button size="sm" className="mt-3" onClick={() => act(`/admin/quotations/${x.id}/send/`)}><Send className="size-3.5" />{t("caseUi.sendToPatient")}</Button>}
            </Card>
          ))}
          {!c.quotations.length && <Empty title={t("common.empty")} />}
        </div>
      )}
      {tab === "appointments" && <Appointments caseId={c.id} items={c.appointments} hospitals={hospitals} onChange={refresh} />}
      {tab === "travel" && <TravelForm caseId={c.id} plan={c.travel_plan} onSaved={refresh} />}
      {tab === "history" && (
        <Card><ol className="relative space-y-4 border-l border-line pl-5">{c.history.map((h) => (
          <li key={h.id} className="relative"><span className="absolute -left-[25px] top-1 size-2.5 rounded-full bg-teal-500 ring-4 ring-white" />
            <div className="text-sm font-semibold">{h.from_status ? `${t(`case.${h.from_status}`)} → ` : ""}{t(`case.${h.to_status}`)}</div>
            {h.event && <div className="text-sm text-ink-soft">{caseEventText(t, h)}</div>}
            {h.note && <div className="text-sm text-ink-soft">{h.note}</div>}
            <div className="text-[11px] text-ink-muted">{h.actor_name || t("adminUi.system")} · {date(h.created_at, locale, true)}{!h.visible_to_patient && ` · ${t("adminUi.internal")}`}</div></li>
        ))}</ol></Card>
      )}

      {statusForm && (
        <Modal open onClose={() => setStatusForm(null)} title={t("common.status")}>
          <div className="space-y-3">
            <Select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>{ALL_STATUSES.map((s) => <option key={s} value={s}>{t(`case.${s}`)}</option>)}</Select>
            <Field label={t("caseUi.internalNote")} hint={t("caseUi.internalNoteHint")}><Textarea rows={2} value={statusForm.note} onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })} /></Field>
            <Field label={t("caseUi.patientNote")} hint={t("caseUi.patientNoteHint")}><Textarea rows={2} value={statusForm.patient_note} onChange={(e) => setStatusForm({ ...statusForm, patient_note: e.target.value })} /></Field>
            <Button className="w-full" onClick={() => act(`/admin/cases/${id}/status/`, statusForm, () => setStatusForm(null))}>{t("common.save")}</Button>
          </div>
        </Modal>
      )}
      {referOpen && <ReferModal c={c} hospitals={hospitals} onClose={() => setReferOpen(false)} onDone={() => { setReferOpen(false); refresh(); }} />}
      {quoteOpen && <QuoteModal caseId={c.id} hospitals={hospitals} onClose={() => setQuoteOpen(false)} onDone={() => { setQuoteOpen(false); refresh(); }} />}
      {opinionOpen && <OpinionModal caseId={c.id} hospitals={hospitals} onClose={() => setOpinionOpen(false)} onDone={() => { setOpinionOpen(false); refresh(); }} />}
    </>
  );
}

function ReferralCard({ r, onMessage }: { r: CaseDetail["referrals"][number]; onMessage: (text: string) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const [text, setText] = useState("");
  return (
    <Card>
      <div className="flex items-center justify-between"><div className="font-display font-bold">{r.hospital_name}</div><Badge tone={r.status === "accepted" ? "success" : r.status === "declined" ? "danger" : "teal"}>{t(`refStatus.${r.status}`)}</Badge></div>
      {r.message_to_hospital && <p className="mt-2 text-sm text-ink-soft">{r.message_to_hospital}</p>}
      <div className="mt-3 text-xs text-ink-muted">{t("partner.sharedDocs")}: {r.shared_documents.map((d) => d.title).join(", ") || "—"}</div>
      <div className="mt-4 space-y-2 rounded-xl bg-mist p-3">
        {r.messages.map((m) => <div key={m.id} className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm", m.from_partner ? "bg-white" : "ml-auto bg-navy-900 text-white")}><div>{m.text}</div><div className={cn("mt-0.5 text-[10px]", m.from_partner ? "text-ink-muted" : "text-white/60")}>{m.author} · {date(m.created_at, locale, true)}</div></div>)}
        <div className="flex gap-2"><Input className="h-9" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("partner.messages")} /><Button size="sm" disabled={!text.trim()} onClick={() => { onMessage(text); setText(""); }}>{t("partner.send")}</Button></div>
      </div>
    </Card>
  );
}

function ReferModal({ c, hospitals, onClose, onDone }: { c: CaseDetail; hospitals: { id: number; name: string }[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations();
  const [hospital, setHospital] = useState("");
  const [docs, setDocs] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [needConsent, setNeedConsent] = useState(false);
  const [confirmConsent, setConfirmConsent] = useState(false);
  const all = [...c.documents, ...c.patient_documents];
  const hasConsent = c.consents.some((x) => x.scope === "share_with_hospital" && x.active && String(x.hospital) === hospital);
  const submit = async () => {
    try {
      if (docs.length && !hasConsent) {
        if (!confirmConsent) { setNeedConsent(true); return; }
        await api(`/admin/cases/${c.id}/consent/`, { body: { scope: "share_with_hospital", hospital: Number(hospital) } });
      }
      await api(`/admin/cases/${c.id}/refer/`, { body: { hospital: Number(hospital), documents: docs, message } });
      toast.success(t("common.saved"));
      onDone();
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Modal open onClose={onClose} title={t("caseUi.referTitle")}>
      <div className="space-y-4">
        <Select value={hospital} onChange={(e) => setHospital(e.target.value)}><option value="">{t("common.hospital")}…</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select>
        <Field label={t("partner.messages")}><Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <div><div className="mb-1.5 text-[13px] font-medium">{t("partner.sharedDocs")}</div>
          <div className="max-h-48 space-y-1 overflow-y-auto">{all.map((d) => <Checkbox key={d.id} label={`${d.title} (${t(`doc.${d.category}`)})`} checked={docs.includes(d.id)} onChange={(e) => setDocs(e.target.checked ? [...docs, d.id] : docs.filter((x) => x !== d.id))} />)}</div>
          {!all.length && <p className="text-xs text-ink-muted">—</p>}</div>
        {hospital && docs.length > 0 && (hasConsent
          ? <p className="flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="size-4" />{t("caseUi.consentOnFile")}</p>
          : <div className={cn("rounded-xl border p-3 text-xs", needConsent ? "border-warning bg-warning-soft" : "border-line")}>
              <Checkbox checked={confirmConsent} onChange={(e) => setConfirmConsent(e.target.checked)} label={t("caseUi.confirmConsent")} />
            </div>)}
        <Button className="w-full" disabled={!hospital} onClick={submit}><Send className="size-4" />{t("partner.send")}</Button>
      </div>
    </Modal>
  );
}

function QuoteModal({ caseId, hospitals, onClose, onDone }: { caseId: number; hospitals: { id: number; name: string }[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try { await api("/admin/quotations/", { body: { ...fd, case: caseId, amount_max: fd.amount_max || null, valid_until: fd.valid_until || null } }); toast.success(t("common.saved")); onDone(); } catch (err) { toast.error((err as Error).message); }
  };
  return (
    <Modal open onClose={onClose} title={t("partner.submitQuote")}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={t("common.hospital")} className="sm:col-span-2"><Select name="hospital" required>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select></Field>
        <Field label={t("partner.plan")} className="sm:col-span-2"><Textarea name="treatment_plan" rows={3} required /></Field>
        <Field label={t("partner.amountMin")}><Input name="amount_min" type="number" step="any" required /></Field>
        <Field label={t("partner.amountMax")}><Input name="amount_max" type="number" step="any" /></Field>
        <Field label={t("caseUi.currency")}><Select name="currency">{["USD", "EUR", "INR", "TRY", "CNY", "UZS"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label={t("adminUi.caseType")}><Select name="quote_type"><option value="estimate">{t("common.estimate")}</option><option value="confirmed">{t("common.confirmed")}</option></Select></Field>
        <Field label={t("detail.included")} className="sm:col-span-2"><Textarea name="includes" rows={2} /></Field>
        <Field label={t("detail.excluded")} className="sm:col-span-2"><Textarea name="excludes" rows={2} /></Field>
        <Field label={t("detail.validUntil")}><Input name="valid_until" type="date" /></Field>
        <Button type="submit" className="sm:col-span-2">{t("common.save")}</Button>
      </form>
    </Modal>
  );
}

function OpinionModal({ caseId, hospitals, onClose, onDone }: { caseId: number; hospitals: { id: number; name: string }[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try { await api(`/admin/cases/${caseId}/opinion/`, { form: new FormData(e.currentTarget) }); toast.success(t("common.saved")); onDone(); } catch (err) { toast.error((err as Error).message); }
  };
  return (
    <Modal open onClose={onClose} title={t("partner.submitOpinion")}>
      <form onSubmit={submit} className="space-y-3">
        <p className="rounded-xl bg-teal-50 p-3 text-xs text-teal-800">{t("so.notice")}</p>
        <Field label={t("common.hospital")}><Select name="hospital"><option value="">—</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select></Field>
        <Field label={t("partner.doctorName")}><Input name="doctor_name" required /></Field>
        <Field label={t("partner.summary")}><Textarea name="summary" rows={4} required /></Field>
        <Field label={t("partner.recommended")}><Textarea name="recommended_treatment" rows={2} /></Field>
        <Field label="PDF"><input type="file" name="file" accept=".pdf,.jpg,.png" className="text-sm" /></Field>
        <Button type="submit" className="w-full">{t("common.save")}</Button>
      </form>
    </Modal>
  );
}

function Appointments({ caseId, items, hospitals, onChange }: { caseId: number; items: CaseDetail["appointments"]; hospitals: { id: number; name: string }[]; onChange: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try { await api("/admin/appointments/", { body: { ...fd, case: caseId, hospital: fd.hospital || null, scheduled_at: new Date(fd.scheduled_at).toISOString() } }); (e.target as HTMLFormElement).reset(); onChange(); } catch (err) { toast.error((err as Error).message); }
  };
  return (
    <Card>
      <form onSubmit={submit} className="mb-5 grid gap-2 sm:grid-cols-[1fr_140px_200px_180px_auto]">
        <Input name="title" placeholder={t("dash.title")} required className="h-10" />
        <Select name="kind" className="h-10">{["video", "in_person", "procedure", "follow_up"].map((k) => <option key={k} value={k}>{t(`apptKind.${k}`)}</option>)}</Select>
        <Select name="hospital" className="h-10"><option value="">{t("common.hospital")}</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select>
        <Input name="scheduled_at" type="datetime-local" required className="h-10" />
        <Button type="submit">{t("common.add")}</Button>
      </form>
      <ul className="divide-y divide-line">{items.map((a) => <li key={a.id} className="flex justify-between py-2.5 text-sm"><span><b>{a.title}</b> · {t.has(`apptKind.${a.kind}`) ? t(`apptKind.${a.kind}`) : a.kind}{a.hospital_name && ` · ${a.hospital_name}`}</span><span className="text-ink-muted">{date(a.scheduled_at, locale, true)}</span></li>)}</ul>
      {!items.length && <p className="text-center text-sm text-ink-muted">{t("common.empty")}</p>}
    </Card>
  );
}

function TravelForm({ caseId, plan, onSaved }: { caseId: number; plan: Record<string, string | number | null> | null; onSaved: () => void }) {
  const t = useTranslations();
  const { can } = useAuth();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try { await api(`/admin/cases/${caseId}/travel/`, { body: { ...fd, arrival_date: fd.arrival_date || null, departure_date: fd.departure_date || null } }); toast.success(t("common.saved")); onSaved(); } catch (err) { toast.error((err as Error).message); }
  };
  const v = (k: string) => (plan?.[k] ?? "") as string;
  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={t("travelUi.arrival")}><Input name="arrival_date" type="date" defaultValue={v("arrival_date")} /></Field>
        <Field label={t("travelUi.departure")}><Input name="departure_date" type="date" defaultValue={v("departure_date")} /></Field>
        <Field label={t("travelUi.companions")}><Input name="companions" type="number" min={0} defaultValue={v("companions") || 0} /></Field>
        <Field label={t("travelUi.visa")}><Select name="visa_status" defaultValue={v("visa_status") || "pending"}>{["not_required", "pending", "invitation_sent", "applied", "approved", "rejected"].map((s) => <option key={s} value={s}>{t(`visa.${s}`)}</option>)}</Select></Field>
        <Field label={t("travelUi.hotel")}><Input name="hotel_name" defaultValue={v("hotel_name")} /></Field>
        <Field label={t("travelUi.interpreter")}><Input name="interpreter" defaultValue={v("interpreter")} /></Field>
        <Field label={t("travelUi.flight")} className="sm:col-span-2"><Textarea name="flight_details" rows={2} defaultValue={v("flight_details")} /></Field>
        <Field label={t("travelUi.hotelDetails")} className="sm:col-span-2"><Textarea name="hotel_details" rows={2} defaultValue={v("hotel_details")} /></Field>
        <Field label={t("travelUi.transfer")} className="sm:col-span-2"><Textarea name="airport_transfer" rows={2} defaultValue={v("airport_transfer")} /></Field>
        <Field label={t("travelUi.notes")} className="sm:col-span-2"><Textarea name="notes" rows={2} defaultValue={v("notes")} /></Field>
        {can("travel.edit") && <Button type="submit" className="sm:col-span-2">{t("common.save")}</Button>}
      </form>
    </Card>
  );
}

export { openSignedLink };
