"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, HeartPulse, KeyRound, Mail, MessagesSquare, Pencil, Phone, Search, Send, ShieldCheck, Upload, UserPlus, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/portal/shell";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, LoadingBlock, Modal, Select, Tabs, Textarea } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError, api, openSignedLink, type Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRefFilters, useStaff } from "@/lib/hooks";
import { cn, date, fileSize, initials, money } from "@/lib/utils";
import { PRIORITY_TONE } from "./crm";
import { Timeline } from "./lead-drawer";

type Patient = {
  id: number; full_name: string; phone: string; email: string; date_of_birth: string | null; gender: string; country: number | null; country_name: string | null;
  city: string; address: string; preferred_language: string; blood_type: string; allergies: string; chronic_conditions: string; current_medications: string;
  medical_notes: string; emergency_contact: string; manager: { id: number; name: string } | null; assigned_manager: number | null; cases_count: number; leads_count: number;
  has_account: boolean; created_at: string;
};

export function PatientsList() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [demo, setDemo] = useState(false);
  useEffect(() => { const id = setTimeout(() => { setTerm(search); setPage(1); }, 300); return () => clearTimeout(id); }, [search]);
  const q = useQuery({ queryKey: ["patients", term, page, demo], queryFn: () => api<Paginated<Patient>>(`/admin/patients/?page=${page}&page_size=30${term ? `&search=${encodeURIComponent(term)}` : ""}${demo ? "&demo=1" : ""}`) });
  const pages = Math.ceil((q.data?.count || 0) / 30);
  return (
    <>
      <PageTitle title={t("admin.patients")} subtitle={q.data && `${q.data.count} ${t("common.results")}`}
        actions={can("patients.edit") && <Button onClick={() => setCreating(true)}><UserPlus className="size-4" />{t("walkIn.newPatient")}</Button>} />
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" /><Input className="h-9 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("adminUi.patientSearch")} /></div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-soft"><input type="checkbox" checked={demo} onChange={(e) => { setDemo(e.target.checked); setPage(1); }} className="accent-teal-500" />{t("adminUi.showDemo")}</label></div>
      {q.isLoading ? <LoadingBlock /> : q.error ? <ErrorBox message={(q.error as Error).message} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-mist/70 text-left text-xs font-semibold text-ink-muted"><tr><th className="p-3">{t("common.name")}</th><th className="p-3">{t("form.phone")}</th><th className="p-3">{t("common.country")}</th><th className="p-3">{t("admin.manager")}</th><th className="p-3">{t("admin.cases")}</th><th className="p-3">{t("admin.leads")}</th><th className="p-3">{t("common.date")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {q.data?.results.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-mist/50" onClick={() => router.push(`/admin/patients/${p.id}`)}>
                  <td className="p-3 font-semibold text-navy-900">{p.full_name}{p.has_account && <Badge tone="teal" className="ml-2">{t("adminUi.hasCabinet")}</Badge>}</td>
                  <td className="p-3">{p.phone}</td><td className="p-3">{p.country_name || p.city || "—"}</td><td className="p-3">{p.manager?.name || "—"}</td>
                  <td className="p-3">{p.cases_count}</td><td className="p-3">{p.leads_count}</td><td className="p-3 text-xs text-ink-muted">{date(p.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!q.data?.results.length && <p className="p-10 text-center text-sm text-ink-muted">{t("common.empty")}</p>}
          {pages > 1 && <div className="flex justify-end gap-2 border-t border-line p-3 text-sm"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.back")}</Button><span>{page}/{pages}</span><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("common.next")}</Button></div>}
        </div>
      )}
      {creating && <NewPatientModal open onClose={() => setCreating(false)} onSaved={(id, caseId) => { setCreating(false); router.push(caseId ? `/admin/cases/${caseId}` : `/admin/patients/${id}`); }} />}
    </>
  );
}

function PatientFormModal({ open, onClose, onSaved, patient }: { open: boolean; onClose: () => void; onSaved: (id: number) => void; patient?: Patient }) {
  const t = useTranslations();
  const ref = useRefFilters();
  const staff = useStaff();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body = { ...fd, country: fd.country || null, assigned_manager: fd.assigned_manager || null, date_of_birth: fd.date_of_birth || null };
    setBusy(true);
    try {
      const r = await api<{ id: number }>(patient ? `/admin/patients/${patient.id}/` : "/admin/patients/", { method: patient ? "PATCH" : "POST", body });
      toast.success(t("common.saved"));
      onSaved(r.id);
    } catch (err) { setErrors(err instanceof ApiError ? err.fieldErrors() : {}); toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const p = patient;
  return (
    <Modal open={open} onClose={onClose} wide title={p ? `${t("common.edit")} · ${p.full_name}` : t("common.add")}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={t("form.fullName")} error={errors.full_name} required><Input name="full_name" defaultValue={p?.full_name} required /></Field>
        <Field label={t("form.phone")} error={errors.phone} required><Input name="phone" defaultValue={p?.phone} required /></Field>
        <Field label={t("form.email")}><Input name="email" type="email" defaultValue={p?.email} /></Field>
        <Field label={t("form.passport")}><Input name="passport_number" defaultValue={(p as { passport_number?: string } | undefined)?.passport_number} className="font-mono uppercase" maxLength={20} /></Field>
        <Field label={t("ui.dob")}><Input name="date_of_birth" type="date" defaultValue={p?.date_of_birth || ""} /></Field>
        <Field label={t("ui.gender")}><Select name="gender" defaultValue={p?.gender || ""}><option value="">—</option><option value="male">{t("ui.male")}</option><option value="female">{t("ui.female")}</option><option value="other">{t("ui.otherGender")}</option></Select></Field>
        <Field label={t("common.country")}><Select name="country" defaultValue={p?.country || ""}><option value="">—</option>{ref?.countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label={t("common.city")}><Input name="city" defaultValue={p?.city} /></Field>
        <Field label={t("admin.manager")}><Select name="assigned_manager" defaultValue={p?.assigned_manager || ""}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={t("ui.bloodType")}><Input name="blood_type" defaultValue={p?.blood_type} /></Field>
        <Field label={t("ui.emergency")}><Input name="emergency_contact" defaultValue={p?.emergency_contact} /></Field>
        <Field label={t("ui.allergies")} className="sm:col-span-2"><Textarea name="allergies" rows={2} defaultValue={p?.allergies} /></Field>
        <Field label={t("ui.chronic")} className="sm:col-span-2"><Textarea name="chronic_conditions" rows={2} defaultValue={p?.chronic_conditions} /></Field>
        <Field label={t("ui.meds")} className="sm:col-span-2"><Textarea name="current_medications" rows={2} defaultValue={p?.current_medications} /></Field>
        <Field label={t("p360.internalNotes")} className="sm:col-span-2"><Textarea name="medical_notes" rows={2} defaultValue={p?.medical_notes} /></Field>
        <Button type="submit" loading={busy} className="sm:col-span-2">{t("common.save")}</Button>
      </form>
    </Modal>
  );
}

/* ---------------- Walk-in patient: quick form for people who come to the office ---------------- */
type Dup = { id: number; full_name: string; phone: string; match: "phone" | "passport"; has_account: boolean };

/** Existing patients with the same phone / passport, checked while staff type (debounced). */
function useDuplicates(phone: string, passport: string) {
  const [dups, setDups] = useState<Dup[]>([]);
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    const pass = passport.replace(/\s/g, "");
    if (digits.length < 9 && pass.length < 5) { setDups([]); return; }
    const id = setTimeout(() => {
      api<Dup[]>(`/admin/patients/duplicates/?phone=${encodeURIComponent(phone)}&passport=${encodeURIComponent(pass)}`)
        .then(setDups).catch(() => setDups([]));
    }, 400);
    return () => clearTimeout(id);
  }, [phone, passport]);
  return dups;
}

function NewPatientModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: number, caseId?: number) => void }) {
  const t = useTranslations();
  const w = useTranslations("walkIn");
  const ref = useRefFilters();
  const staff = useStaff();
  const { user, can } = useAuth();
  const [phone, setPhone] = useState("+998 ");
  const [passport, setPassport] = useState("");
  const [cabinet, setCabinet] = useState(true);
  const [consent, setConsent] = useState(false);
  const [withCase, setWithCase] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const dups = useDuplicates(phone, passport);
  const me = staff.some((s) => s.id === user?.id) ? String(user?.id) : "";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cabinet && !consent) { setErrors({ consent: w("consentRequired") }); return; }
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body = { ...fd, country: fd.country || null, assigned_manager: fd.assigned_manager || null, date_of_birth: fd.date_of_birth || null };
    setBusy(true);
    setErrors({});
    try {
      const p = await api<{ id: number }>("/admin/patients/", { body });
      let msg = w("saved");
      if (cabinet) {
        try {
          const r = await api<{ login_phone: string }>(`/admin/patients/${p.id}/open_cabinet/`, { body: { consent: true } });
          msg = w("cabinetOpened", { phone: r.login_phone });
        } catch (err) { toast.error(`${w("cabinetFailed")}: ${(err as Error).message}`); }
      }
      let caseId: number | null = null;
      if (withCase) {
        try { caseId = (await api<{ id: number }>("/admin/cases/", { body: { patient: p.id, title: fd.full_name, case_type: "treatment" } })).id; }
        catch (err) { toast.error((err as Error).message); }
      }
      toast.success(msg, { duration: 8000 });
      onSaved(p.id, caseId ?? undefined);
    } catch (err) {
      setErrors(err instanceof ApiError ? err.fieldErrors() : {});
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide title={w("title")}>
      <p className="-mt-1 mb-4 text-sm text-ink-soft">{w("hint")}</p>
      <form onSubmit={submit} className="space-y-4">
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{w("main")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("form.fullName")} error={errors.full_name} required><Input name="full_name" required autoFocus autoComplete="off" /></Field>
            <Field label={t("form.phone")} error={errors.phone} required>
              <Input name="phone" required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
            </Field>
            <Field label={t("form.passport")} error={errors.passport_number}>
              <Input name="passport_number" value={passport} onChange={(e) => setPassport(e.target.value.toUpperCase())} className="font-mono uppercase" maxLength={20} placeholder="AA1234567" />
            </Field>
            <Field label={t("ui.dob")}><Input name="date_of_birth" type="date" /></Field>
            <Field label={t("ui.gender")}><Select name="gender" defaultValue=""><option value="">—</option><option value="male">{t("ui.male")}</option><option value="female">{t("ui.female")}</option></Select></Field>
            <Field label={w("language")}>
              <Select name="preferred_language" defaultValue="uz"><option value="uz">O‘zbekcha</option><option value="ru">Русский</option><option value="en">English</option></Select>
            </Field>
            <Field label={t("common.country")}><Select name="country" defaultValue=""><option value="">—</option>{ref?.countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label={t("common.city")}><Input name="city" /></Field>
            <Field label={t("admin.manager")} className="sm:col-span-2">
              <Select name="assigned_manager" defaultValue={me} key={me}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </Field>
          </div>
        </section>

        {dups.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-semibold text-amber-800">{w("dupTitle")}</p>
            <ul className="mt-1.5 space-y-1">
              {dups.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 text-amber-900">
                  <span className="font-semibold">{d.full_name}</span><span className="text-xs">{d.phone} · {d.match === "phone" ? w("dupPhone") : w("dupPassport")}</span>
                  <Link href={`/admin/patients/${d.id}`} onClick={onClose} className="ml-auto text-xs font-bold text-teal-700 hover:underline">{w("openCard")} →</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="group rounded-2xl border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-navy-900 [&::-webkit-details-marker]:hidden">
            {w("medical")}<span className="text-ink-muted transition group-open:rotate-45">+</span>
          </summary>
          <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
            <Field label={t("ui.bloodType")}><Input name="blood_type" /></Field>
            <Field label={t("ui.emergency")}><Input name="emergency_contact" /></Field>
            <Field label={t("ui.allergies")} className="sm:col-span-2"><Textarea name="allergies" rows={2} /></Field>
            <Field label={t("ui.chronic")} className="sm:col-span-2"><Textarea name="chronic_conditions" rows={2} /></Field>
            <Field label={t("ui.meds")} className="sm:col-span-2"><Textarea name="current_medications" rows={2} /></Field>
            <Field label={t("p360.internalNotes")} className="sm:col-span-2"><Textarea name="medical_notes" rows={2} /></Field>
          </div>
        </details>

        <div className="space-y-3 rounded-2xl bg-mist p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={cabinet} onChange={(e) => setCabinet(e.target.checked)} className="mt-0.5 size-4 accent-teal-500" />
            <span><span className="block text-sm font-semibold text-navy-900">{w("cabinet")}</span>
              <span className="block text-xs text-ink-muted">{w("cabinetHint", { phone: phone.trim() || "+998…" })}</span></span>
          </label>
          {cabinet && (
            <label className={cn("ml-7 flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3", errors.consent ? "border-danger" : "border-line")}>
              <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErrors((x) => ({ ...x, consent: "" })); }} className="mt-0.5 size-4 accent-teal-500" />
              <span className="text-xs leading-snug text-ink">{w("consent")}{errors.consent && <span className="mt-1 block font-semibold text-danger">{errors.consent}</span>}</span>
            </label>
          )}
          {can("medical.edit") && (
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={withCase} onChange={(e) => setWithCase(e.target.checked)} className="mt-0.5 size-4 accent-teal-500" />
              <span><span className="block text-sm font-semibold text-navy-900">{w("case")}</span><span className="block text-xs text-ink-muted">{w("caseHint")}</span></span>
            </label>
          )}
        </div>
        <Button type="submit" loading={busy} className="w-full">{w("save")}</Button>
      </form>
    </Modal>
  );
}

/** Open a personal cabinet for an existing patient who has none (office visit). */
function CabinetModal({ patient, onClose, onDone }: { patient: { id: number; full_name: string; phone: string }; onClose: () => void; onDone: () => void }) {
  const w = useTranslations("walkIn");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const r = await api<{ login_phone: string }>(`/admin/patients/${patient.id}/open_cabinet/`, { body: { consent: true } });
      toast.success(w("cabinetOpened", { phone: r.login_phone }), { duration: 8000 });
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={w("cabinetTitle")}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-mist p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-500 text-white"><KeyRound className="size-5" /></span>
          <div className="min-w-0 text-sm"><p className="font-bold text-navy-900">{patient.full_name}</p><p className="text-ink-soft">{patient.phone}</p></div>
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">{w("cabinetHint", { phone: patient.phone })}</p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-teal-500" />
          <span className="text-xs leading-snug text-ink">{w("consent")}</span>
        </label>
        <Button className="w-full" loading={busy} disabled={!consent} onClick={go}><KeyRound className="size-4" />{w("openCabinet")}</Button>
      </div>
    </Modal>
  );
}

type Doc = { id: number; title: string; category: string; category_label: string; original_name: string; size: number; document_date: string | null; uploaded_at: string; uploaded_by_name: string | null; case_reference: string | null };
type Profile = {
  patient: Patient & { has_account?: boolean; passport_number?: string; created_at?: string };
  leads: { id: number; stage: string; priority: string; treatment_name: string | null; destination_name: string | null; created_at: string; assigned: { name: string } | null }[];
  notes: { id: number; text: string; author_name: string; created_at: string; is_pinned: boolean }[];
  communications: { id: number; channel: string; direction: string; summary: string; author_name: string; occurred_at: string }[];
  tasks: { id: number; title: string; status: string; due_at: string | null; assignee_name: string | null; is_overdue: boolean }[];
  timeline: Parameters<typeof Timeline>[0]["items"];
  consents: { id: number; scope: string; scope_label: string; hospital: string | null; granted: boolean; granted_at: string; revoked_at: string | null }[];
  chat?: { total: number; unread: number };
  cases?: { id: number; reference: string; title: string; case_type: string; status: string; journey_index: number; hospital_name: string | null; coordinator_name: string | null; created_at: string }[];
  quotations?: { id: number; hospital_name: string; amount_min: string; amount_max: string | null; currency: string; status: string; quote_type_label: string; case_reference: string }[];
  travel?: { case: number; arrival_date: string | null; departure_date: string | null; hotel_name: string; visa_status: string; flight_details: string }[];
  documents?: Doc[];
  payments?: { id: number; uid: string; amount: string; currency: string; status: string; kind: string; direction: string; created_at: string }[];
};

type TabKey = "overview" | "documents" | "cases" | "contact" | "tasks" | "payments" | "timeline";
const CLOSED_STAGES = ["completed", "lost"];

function ageOf(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

/** Label + value rows for the side panels. */
function Facts({ items }: { items: [string, React.ReactNode, boolean?][] }) {
  return (
    <dl className="space-y-2.5">{items.map(([k, v, alert]) => (
      <div key={k}>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{k}</dt>
        <dd className={cn("mt-0.5 whitespace-pre-line text-sm", v ? (alert ? "font-semibold text-danger" : "font-medium text-navy-900") : "text-ink-muted")}>{v || "—"}</dd>
      </div>
    ))}</dl>
  );
}

export function Patient360({ id }: { id: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  const { can } = useAuth();
  const [tab, setTab] = useState<TabKey>("overview");
  const [editing, setEditing] = useState(false);
  const [cabinetFor, setCabinetFor] = useState(false);
  const [note, setNote] = useState("");
  const q = useQuery({ queryKey: ["patient360", id], queryFn: () => api<Profile>(`/admin/patients/${id}/profile/`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["patient360", id] });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorBox message={(q.error as Error)?.message || t("common.error")} />;
  const d = q.data;
  const p = d.patient;
  const digits = p.phone.replace(/\D/g, "");
  const age = ageOf(p.date_of_birth);
  const openTasks = d.tasks.filter((x) => !["done", "cancelled"].includes(x.status));
  const activeCases = (d.cases || []).filter((c) => !["closed", "cancelled"].includes(c.status));
  const openLeads = d.leads.filter((l) => !CLOSED_STAGES.includes(l.stage));
  const tabs: { value: TabKey; label: string; count?: number }[] = [
    { value: "overview", label: t("admin.tab.overview") },
    ...(d.cases ? [{ value: "cases" as const, label: t("p360.casesTab"), count: d.cases.length }] : []),
    ...(d.documents ? [{ value: "documents" as const, label: t("admin.tab.documents"), count: d.documents.length }] : []),
    { value: "contact", label: t("p360.contactTab"), count: d.communications.length + d.notes.length },
    { value: "tasks", label: t("admin.tab.tasks"), count: openTasks.length },
    ...(d.payments ? [{ value: "payments" as const, label: t("admin.tab.payments"), count: d.payments.length }] : []),
    { value: "timeline", label: t("admin.tab.timeline") },
  ];
  const openCase = async () => {
    try {
      const c = await api<{ id: number }>("/admin/cases/", { body: { patient: p.id, title: p.full_name, case_type: "treatment" } });
      router.push(`/admin/cases/${c.id}`);
    } catch (e) { toast.error((e as Error).message); }
  };
  const addNote = async () => {
    try { await api("/admin/notes/", { body: { patient: p.id, text: note } }); setNote(""); refresh(); toast.success(t("common.saved")); } catch (e) { toast.error((e as Error).message); }
  };
  const consentLabel = (c: Profile["consents"][number]) => (t.has(`consentScope.${c.scope}`) ? t(`consentScope.${c.scope}`) : c.scope_label);
  const quick = "inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong bg-white px-3 text-xs font-semibold text-navy-900 transition hover:border-teal-400 hover:text-teal-700";

  return (
    <>
      <div className="card mb-5 p-5">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-navy-700 font-display text-xl font-extrabold text-white">{initials(p.full_name)}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold">{p.full_name}</h1>
                {p.has_account && <Badge tone="teal">{t("adminUi.hasCabinet")}</Badge>}
                {d.chat && d.chat.unread > 0 && <Badge tone="danger">{t("p360.unreadChat", { n: d.chat.unread })}</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-ink-muted">{[age !== null ? t("p360.age", { n: age }) : null, p.country_name || p.city, p.manager ? `${t("admin.manager")}: ${p.manager.name}` : t("p360.noManager"),
                p.created_at ? `${t("p360.since")} ${date(p.created_at, locale)}` : null].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {digits && <a href={`tel:+${digits}`} className={quick}><Phone className="size-3.5" />{p.phone}</a>}
            {digits && <a href={`https://t.me/+${digits}`} target="_blank" rel="noopener noreferrer" className={quick}><Send className="size-3.5" />Telegram</a>}
            {p.email && <a href={`mailto:${p.email}`} className={quick}><Mail className="size-3.5" />Email</a>}
            <Link href={`/admin/chats?patient=${p.id}`} className={quick}><MessagesSquare className="size-3.5" />{t("p360.chat")}{d.chat?.total ? ` (${d.chat.total})` : ""}</Link>
            {can("patients.edit") && !p.has_account && <Button size="sm" variant="outline" className="h-9" onClick={() => setCabinetFor(true)}><KeyRound className="size-3.5" />{t("walkIn.openCabinet")}</Button>}
            {can("patients.edit") && <Button size="sm" variant="outline" className="h-9" onClick={() => setEditing(true)}><Pencil className="size-3.5" />{t("common.edit")}</Button>}
            {can("medical.edit") && <Button size="sm" variant="secondary" className="h-9" onClick={openCase}><HeartPulse className="size-3.5" />{t("admin.createCase")}</Button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-5" />

          {tab === "overview" && (
            <div className="space-y-4">
              <Card>
                <div className="mb-3 flex items-center justify-between"><h3 className="font-display font-bold">{t("p360.activeCases")}</h3>{(d.cases?.length || 0) > activeCases.length && <button onClick={() => setTab("cases")} className="text-xs font-semibold text-teal-700">{t("common.viewAll")} →</button>}</div>
                {activeCases.length ? <div className="grid gap-3 md:grid-cols-2">{activeCases.map((c) => (
                  <Link key={c.id} href={`/admin/cases/${c.id}`} className="rounded-2xl border border-line p-4 transition hover:border-teal-300 hover:shadow-card">
                    <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-bold text-teal-700">{c.reference}</span><span className="text-[11px] text-ink-muted">{t(`caseType.${c.case_type}`)}</span></div>
                    <div className="mt-1 truncate font-semibold text-navy-900">{c.title || "—"}</div>
                    <div className="mt-2 text-xs font-semibold">{t(`case.${c.status}`)}</div>
                    <div className="mt-1.5 flex gap-0.5">{Array.from({ length: 10 }).map((_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i <= c.journey_index ? "bg-teal-500" : "bg-line")} />)}</div>
                    <div className="mt-2 text-[11px] text-ink-muted">{c.coordinator_name || <span className="font-semibold text-amber-600">{t("adminUi.noCoordinator")}</span>}{c.hospital_name && ` · ${c.hospital_name}`}</div>
                  </Link>
                ))}</div> : <p className="text-sm text-ink-muted">{t("p360.noActiveCases")}</p>}
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <h3 className="mb-3 font-display font-bold">{t("p360.openLeads")}</h3>
                  {openLeads.length ? openLeads.map((l) => (
                    <Link key={l.id} href={`/admin/crm?lead=${l.id}`} className="mb-2 block rounded-xl border border-line p-3 text-sm hover:border-teal-300">
                      <div className="flex justify-between gap-2"><b>{t(`stage.${l.stage}`)}</b><Badge tone={PRIORITY_TONE[l.priority]}>{t(`priority.${l.priority}`)}</Badge></div>
                      <div className="text-xs text-ink-muted">{[l.treatment_name, l.destination_name, l.assigned?.name, date(l.created_at, locale)].filter(Boolean).join(" · ")}</div>
                    </Link>
                  )) : <p className="text-sm text-ink-muted">—</p>}
                </Card>
                <Card>
                  <div className="mb-3 flex items-center justify-between"><h3 className="font-display font-bold">{t("p360.openTasks")}</h3><button onClick={() => setTab("tasks")} className="text-xs font-semibold text-teal-700">{t("common.add")} →</button></div>
                  {openTasks.length ? <ul className="space-y-2">{openTasks.slice(0, 5).map((x) => (
                    <li key={x.id} className="flex items-start justify-between gap-2 text-sm"><span className={cn("font-medium", x.is_overdue && "text-danger")}>{x.title}</span><span className={cn("shrink-0 text-[11px]", x.is_overdue ? "font-semibold text-danger" : "text-ink-muted")}>{x.due_at ? date(x.due_at, locale, true) : "—"}</span></li>
                  ))}</ul> : <p className="text-sm text-ink-muted">—</p>}
                </Card>
              </div>
              <Card>
                <h3 className="mb-3 font-display font-bold">{t("admin.tab.notes")}</h3>
                {can("crm.edit") && <div className="mb-3 flex gap-2"><Input className="h-10" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("admin.addNote")} onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) void addNote(); }} /><Button disabled={!note.trim()} onClick={addNote}>{t("common.add")}</Button></div>}
                {d.notes.length ? <ul className="divide-y divide-line">{d.notes.slice(0, 4).map((n) => <li key={n.id} className="py-2.5"><p className="whitespace-pre-line text-sm">{n.text}</p><p className="mt-0.5 text-[11px] text-ink-muted">{n.author_name} · {date(n.created_at, locale, true)}</p></li>)}</ul> : <p className="text-sm text-ink-muted">—</p>}
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between"><h3 className="font-display font-bold">{t("p360.recent")}</h3><button onClick={() => setTab("timeline")} className="text-xs font-semibold text-teal-700">{t("common.viewAll")} →</button></div>
                <Timeline items={d.timeline.slice(0, 6)} />
              </Card>
            </div>
          )}

          {tab === "cases" && (
            <div className="space-y-4">
              <Card>
                {(d.cases || []).length ? <table className="w-full text-sm"><thead className="text-left text-xs text-ink-muted"><tr><th className="pb-2">{t("adminUi.ref")}</th><th className="pb-2">{t("dash.title")}</th><th className="pb-2">{t("common.status")}</th><th className="pb-2">{t("common.hospital")}</th><th className="pb-2">{t("dash.coordinator")}</th></tr></thead>
                  <tbody className="divide-y divide-line">{d.cases!.map((c) => <tr key={c.id} className="cursor-pointer hover:bg-mist/50" onClick={() => router.push(`/admin/cases/${c.id}`)}><td className="py-2.5 font-mono text-xs font-bold">{c.reference}<div className="font-sans text-[11px] font-normal text-ink-muted">{t(`caseType.${c.case_type}`)}</div></td><td>{c.title}</td><td className="text-xs font-semibold">{t(`case.${c.status}`)}</td><td className="text-xs">{c.hospital_name || "—"}</td><td className="text-xs">{c.coordinator_name || "—"}</td></tr>)}</tbody></table>
                  : <Empty title={t("common.empty")} />}
              </Card>
              <Card>
                <h3 className="mb-3 font-display font-bold">{t("admin.tab.quotations")}</h3>
                {d.quotations?.length ? <table className="w-full text-sm"><tbody className="divide-y divide-line">{d.quotations.map((x) => <tr key={x.id}><td className="py-2.5 font-semibold">{x.hospital_name}</td><td className="font-mono text-xs">{x.case_reference}</td><td>{money(x.amount_min, x.currency, locale)}{x.amount_max && ` – ${money(x.amount_max, x.currency, locale)}`}</td><td className="text-xs">{x.quote_type_label}</td><td><Badge tone={x.status === "accepted" ? "success" : x.status === "rejected" ? "danger" : "neutral"}>{t(`quoteStatus.${x.status}`)}</Badge></td></tr>)}</tbody></table> : <p className="text-sm text-ink-muted">—</p>}
              </Card>
              {!!d.travel?.length && <Card><h3 className="mb-3 font-display font-bold">{t("admin.tab.travel")}</h3>{d.travel.map((x) => (
                <div key={x.case} className="grid gap-3 text-sm sm:grid-cols-4">
                  <Facts items={[[t("travelUi.arrival"), x.arrival_date && date(x.arrival_date, locale)]]} /><Facts items={[[t("travelUi.departure"), x.departure_date && date(x.departure_date, locale)]]} />
                  <Facts items={[[t("travelUi.hotel"), x.hotel_name]]} /><Facts items={[[t("travelUi.visa"), t(`visa.${x.visa_status}`)]]} />
                </div>
              ))}</Card>}
            </div>
          )}
          {tab === "documents" && d.documents && <DocumentsPanel patientId={p.id} docs={d.documents} onChange={refresh} />}
          {tab === "contact" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div><h3 className="mb-2 font-display font-bold">{t("admin.tab.communication")}</h3><ChildList kind="communications" patientId={p.id} items={d.communications.map((c) => ({ id: c.id, text: c.summary, tag: `${t(`channel.${c.channel}`)} · ${t(`direction.${c.direction}`)}`, meta: `${c.author_name || ""} · ${date(c.occurred_at, locale, true)}` }))} onChange={refresh} /></div>
              <div><h3 className="mb-2 font-display font-bold">{t("admin.tab.notes")}</h3><ChildList kind="notes" patientId={p.id} items={d.notes.map((n) => ({ id: n.id, text: n.text, meta: `${n.author_name || ""} · ${date(n.created_at, locale, true)}` }))} onChange={refresh} /></div>
            </div>
          )}
          {tab === "tasks" && <ChildList kind="tasks" patientId={p.id} items={d.tasks.map((x) => ({ id: x.id, text: x.title, tag: t.has(`taskStatus.${x.status}`) ? t(`taskStatus.${x.status}`) : x.status, meta: `${x.assignee_name || "—"} · ${x.due_at ? date(x.due_at, locale, true) : "—"}`, danger: x.is_overdue }))} onChange={refresh} />}
          {tab === "payments" && <Card>{d.payments?.length ? <table className="w-full text-sm"><tbody className="divide-y divide-line">{d.payments.map((x) => <tr key={x.id}><td className="py-2.5 font-mono text-xs">{x.uid}</td><td className="text-xs">{t(`payKind.${x.kind}`)}</td><td className="text-xs">{t(`payDirection.${x.direction}`)}</td><td className="font-semibold">{money(x.amount, x.currency, locale)}</td><td><Badge tone={x.status === "confirmed" ? "success" : x.status === "pending" ? "warning" : "danger"}>{t(`payStatus.${x.status}`)}</Badge></td><td className="text-xs text-ink-muted">{date(x.created_at, locale)}</td></tr>)}</tbody></table> : <Empty title={t("common.empty")} action={<Link href="/admin/finance" className="font-semibold text-teal-700">{t("admin.finance")} →</Link>} />}</Card>}
          {tab === "timeline" && <Card><Timeline items={d.timeline} /></Card>}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-display font-bold"><UserRound className="size-4 text-teal-600" />{t("admin.tab.personal")}</h3>
            <Facts items={[
              [t("ui.dob"), p.date_of_birth ? `${date(p.date_of_birth, locale)}${age !== null ? ` (${t("p360.age", { n: age })})` : ""}` : ""],
              [t("ui.gender"), p.gender ? t(p.gender === "male" ? "ui.male" : p.gender === "female" ? "ui.female" : "ui.otherGender") : ""],
              [t("form.passport"), p.passport_number ? <span className="font-mono">{p.passport_number}</span> : ""],
              [t("common.language"), ({ uz: "O‘zbekcha", ru: "Русский", en: "English" } as Record<string, string>)[p.preferred_language] || p.preferred_language],
              [t("ui.address"), [p.city, p.address].filter(Boolean).join(", ")],
              [t("ui.emergency"), p.emergency_contact],
            ]} />
          </Card>
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-display font-bold"><HeartPulse className="size-4 text-teal-600" />{t("admin.tab.medical")}</h3>
            <Facts items={[
              [t("ui.bloodType"), p.blood_type],
              [t("ui.allergies"), p.allergies, true],
              [t("ui.chronic"), p.chronic_conditions],
              [t("ui.meds"), p.current_medications],
              [t("p360.internalNotes"), p.medical_notes],
            ]} />
          </Card>
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-display font-bold"><ShieldCheck className="size-4 text-teal-600" />{t("dash.consents")}</h3>
            {d.consents.length ? <ul className="space-y-2 text-sm">{d.consents.map((c) => <li key={c.id} className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block">{consentLabel(c)}</span>{c.hospital && <span className="block truncate text-[11px] text-ink-muted">{c.hospital}</span>}</span><Badge tone={c.revoked_at ? "danger" : "success"}>{c.revoked_at ? t("dash.revoked") : t("dash.active")}</Badge></li>)}</ul> : <p className="text-sm text-ink-muted">—</p>}
          </Card>
        </aside>
      </div>
      {editing && <PatientFormModal open patient={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }} />}
      {cabinetFor && <CabinetModal patient={p} onClose={() => setCabinetFor(false)} onDone={() => { setCabinetFor(false); refresh(); }} />}
    </>
  );
}

function ChildList({ kind, patientId, items, onChange }: { kind: "notes" | "communications" | "tasks"; patientId: number; items: { id: number; text: string; meta: string; tag?: string; danger?: boolean }[]; onChange: () => void }) {
  const t = useTranslations();
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("phone");
  const [direction, setDirection] = useState("out");
  const add = async () => {
    const body = kind === "notes" ? { patient: patientId, text } : kind === "communications" ? { patient: patientId, summary: text, channel, direction } : { patient: patientId, title: text };
    try { await api(`/admin/${kind}/`, { body }); setText(""); onChange(); toast.success(t("common.saved")); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-2">
        {kind === "communications" && <>
          <Select className="h-10 w-36" value={channel} onChange={(e) => setChannel(e.target.value)}>{["phone", "telegram", "whatsapp", "email", "sms", "meeting"].map((c) => <option key={c} value={c}>{t(`channel.${c}`)}</option>)}</Select>
          <Select className="h-10 w-32" value={direction} onChange={(e) => setDirection(e.target.value)}>{["out", "in"].map((c) => <option key={c} value={c}>{t(`direction.${c}`)}</option>)}</Select>
        </>}
        <Input className="h-10 min-w-48 flex-1" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) void add(); }}
          placeholder={kind === "notes" ? t("admin.addNote") : kind === "communications" ? t("admin.logCall") : t("p360.newTask")} />
        <Button disabled={!text.trim()} onClick={add}>{t("common.add")}</Button>
      </div>
      <ul className="divide-y divide-line">{items.map((i) => <li key={i.id} className="py-3">
        {i.tag && <span className="mb-1 inline-block rounded bg-mist px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">{i.tag}</span>}
        <p className={cn("whitespace-pre-line text-sm", i.danger && "text-danger")}>{i.text}</p><p className="mt-0.5 text-[11px] text-ink-muted">{i.meta}</p></li>)}</ul>
      {!items.length && <p className="text-center text-sm text-ink-muted">{t("common.empty")}</p>}
    </Card>
  );
}

const CATS = ["report", "blood_test", "mri", "ct", "xray", "ultrasound", "prescription", "discharge", "diagnosis", "opinion", "passport", "other"];

export function DocumentsPanel({ patientId, caseId, docs, onChange }: { patientId: number; caseId?: number; docs: Doc[]; onChange: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const { can } = useAuth();
  const [category, setCategory] = useState("report");
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const fd = new FormData();
    fd.append("patient", String(patientId));
    if (caseId) fd.append("case", String(caseId));
    fd.append("category", category);
    Array.from(files).forEach((f) => fd.append("files", f));
    setBusy(true);
    try { await api("/admin/documents/", { form: fd }); toast.success(t("common.saved")); onChange(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const del = async (d: Doc) => {
    if (!confirm(t("admin.confirmDelete"))) return;
    try { await api(`/admin/documents/${d.id}/`, { method: "DELETE" }); onChange(); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Card>
      {can("documents.upload") && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select className="h-10 w-48" value={category} onChange={(e) => setCategory(e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{t(`doc.${c}`)}</option>)}</Select>
          <label className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white", busy && "opacity-60")}>
            <Upload className="size-4" />{t("dash.uploadDocs")}<input type="file" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
          </label>
          <span className="text-xs text-ink-muted">{t("dash.privateNote")}</span>
        </div>
      )}
      {docs.length ? (
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <FileText className="size-5 shrink-0 text-teal-600" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-navy-900">{d.title}</div>
                <div className="text-[11px] text-ink-muted">{t(`doc.${d.category}`)} · {fileSize(d.size)} · {date(d.document_date || d.uploaded_at, locale)}{d.case_reference && ` · ${d.case_reference}`}{d.uploaded_by_name && ` · ${d.uploaded_by_name}`}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => openSignedLink(`/admin/documents/${d.id}/link/`).catch((e) => toast.error(e.message))}>{t("common.open")}</Button>
              {can("documents.delete") && <Button size="sm" variant="ghost" onClick={() => del(d)}>{t("common.delete")}</Button>}
            </li>
          ))}
        </ul>
      ) : <p className="py-6 text-center text-sm text-ink-muted">{t("common.empty")}</p>}
    </Card>
  );
}
