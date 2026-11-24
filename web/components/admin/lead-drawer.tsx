"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, HeartPulse, MessageSquare, Phone, StickyNote, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input, LoadingBlock, Modal, Select, Tabs, Textarea } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRefFilters, useStaff } from "@/lib/hooks";
import { date } from "@/lib/utils";
import type { Lead } from "./crm";

type Activity = { id: number; type: string; message: string; actor: { name: string } | null; from_stage: string; to_stage: string; created_at: string; meta?: Record<string, string> };

/** System entries carry meta.key (+ arguments) and are shown in the selected language; typed notes stay as written. */
function activityText(t: ReturnType<typeof useTranslations>, a: Activity) {
  const m = a.meta || {};
  if (!m.key || !t.has(`activityMsg.${m.key}`)) return a.message;
  const v = { ...m, source: m.source && t.has(`leadSource.${m.source}`) ? t(`leadSource.${m.source}`) : m.source || "",
    from: m.from && t.has(`case.${m.from}`) ? t(`case.${m.from}`) : m.key === "payment_status" && m.from ? t(`payStatus.${m.from}`) : m.from || "",
    to: m.to && t.has(`case.${m.to}`) ? t(`case.${m.to}`) : m.key === "payment_status" && m.to ? t(`payStatus.${m.to}`) : m.to || "" };
  return t(`activityMsg.${m.key}`, v);
}
const STAGES = ["new", "contacted", "qualification", "documents_pending", "medical_review", "quotation_sent", "negotiation", "confirmed", "travel_preparation", "in_treatment", "completed", "lost"];

function toLocalInput(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function LeadDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  const { can } = useAuth();
  const staff = useStaff();
  const ref = useRefFilters();
  const [tab, setTab] = useState<"details" | "activity">("details");
  const lead = useQuery({ queryKey: ["lead", id], queryFn: () => api<Lead>(`/admin/leads/${id}/`), enabled: !!id });
  const acts = useQuery({ queryKey: ["lead-acts", id], queryFn: () => api<Activity[]>(`/admin/leads/${id}/activities/`), enabled: !!id });
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [comm, setComm] = useState({ channel: "phone", summary: "" });
  const [task, setTask] = useState({ title: "", due_at: "" });

  useEffect(() => {
    const l = lead.data;
    if (!l) return;
    setForm({
      stage: l.stage, priority: l.priority, assigned_to: l.assigned_to ? String(l.assigned_to) : "", next_follow_up: toLocalInput(l.next_follow_up),
      destination: l.destination ? String(l.destination) : "", specialty: l.specialty ? String(l.specialty) : "", treatment: l.treatment ? String(l.treatment) : "",
      budget: l.budget || "", budget_currency: l.budget_currency, email: l.email, message: l.message, lost_reason: l.lost_reason || "",
    });
  }, [lead.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["lead", id] });
    qc.invalidateQueries({ queryKey: ["lead-acts", id] });
    qc.invalidateQueries({ queryKey: ["board"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api(`/admin/leads/${id}/`, { method: "PATCH", body: {
        ...form, assigned_to: form.assigned_to ? Number(form.assigned_to) : null, destination: form.destination || null, specialty: form.specialty || null,
        treatment: form.treatment || null, budget: form.budget || null, next_follow_up: form.next_follow_up ? new Date(form.next_follow_up).toISOString() : null,
      } });
      toast.success(t("common.saved"));
      refresh();
    } catch (e) { toast.error((e as ApiError).message); } finally { setSaving(false); }
  };
  const post = async (path: string, body: Record<string, unknown>, reset: () => void) => {
    try { await api(path, { body }); reset(); refresh(); toast.success(t("common.saved")); } catch (e) { toast.error((e as Error).message); }
  };
  const openCase = async () => {
    const l = lead.data!;
    try {
      const c = await api<{ id: number }>("/admin/cases/", { body: { patient: l.patient, lead: l.id, title: l.treatment_name || l.specialty_name || l.full_name,
        specialty: l.specialty, treatment: l.treatment, preferred_destination: l.destination, description: l.message } });
      router.push(`/admin/cases/${c.id}`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const l = lead.data;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const treatments = (ref?.treatments || []).filter((x) => !form.specialty || String(x.specialty) === form.specialty);
  return (
    <Modal open={!!id} onClose={onClose} side title={l ? <span>{l.full_name} <span className="ml-1 text-sm font-normal text-ink-muted">#{l.id}</span></span> : "…"}>
      {!l ? <LoadingBlock /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-mist px-3 py-1.5 font-semibold text-navy-900"><Phone className="size-4" />{l.phone}</a>
            {l.source_name && <span className="chip">{t("admin.source")}: {l.source_name}</span>}
            <span className="chip">{date(l.created_at, locale, true)}</span>
            <div className="ml-auto flex gap-2">
              {l.patient && <Link href={`/admin/patients/${l.patient}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-mist"><UserRound className="size-3.5" />{t("admin.openProfile")}</Link>}
              {can("medical.edit") && l.patient && <Button size="sm" variant="secondary" onClick={openCase}><HeartPulse className="size-3.5" />{t("admin.createCase")}</Button>}
            </div>
          </div>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "details", label: t("detail.overview") }, { value: "activity", label: t("admin.activity"), count: acts.data?.length }]} />
          {tab === "details" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("admin.stage")}><Select value={form.stage} onChange={set("stage")} disabled={!can("crm.edit")}>{STAGES.map((s) => <option key={s} value={s}>{t(`stage.${s}`)}</option>)}</Select></Field>
                <Field label={t("admin.priority")}><Select value={form.priority} onChange={set("priority")}>{["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}</Select></Field>
                <Field label={t("admin.manager")}><Select value={form.assigned_to} onChange={set("assigned_to")}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
                <Field label={t("admin.followUp")}><Input type="datetime-local" value={form.next_follow_up} onChange={set("next_follow_up")} /></Field>
                <Field label={t("form.destination")}><Select value={form.destination} onChange={set("destination")}><option value="">—</option>{ref?.countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}</Select></Field>
                <Field label={t("common.specialty")}><Select value={form.specialty} onChange={set("specialty")}><option value="">—</option>{ref?.specialties.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</Select></Field>
                <Field label={t("common.treatment")}><Select value={form.treatment} onChange={set("treatment")}><option value="">—</option>{treatments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <Field label={t("admin.budget")}><Input type="number" min={0} value={form.budget} onChange={set("budget")} /></Field>
                  <Field label="&nbsp;"><Select value={form.budget_currency} onChange={set("budget_currency")}>{["USD", "UZS", "EUR", "INR", "TRY", "CNY"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
                </div>
                <Field label={t("form.email")} className="sm:col-span-2"><Input value={form.email} onChange={set("email")} /></Field>
                <Field label={t("form.message")} className="sm:col-span-2"><Textarea rows={3} value={form.message} onChange={set("message")} /></Field>
                {form.stage === "lost" && <Field label="Lost reason" className="sm:col-span-2"><Input value={form.lost_reason} onChange={set("lost_reason")} /></Field>}
              </div>
              {can("crm.edit") && <Button onClick={save} loading={saving} className="w-full">{t("common.save")}</Button>}
              <div className="grid gap-4 border-t border-line pt-5">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold"><StickyNote className="size-4 text-teal-600" />{t("admin.addNote")}</div>
                  <div className="flex gap-2"><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-10" />
                    <Button disabled={!note.trim()} onClick={() => post("/admin/notes/", { lead: l.id, patient: l.patient, text: note }, () => setNote(""))}>{t("common.add")}</Button></div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold"><MessageSquare className="size-4 text-teal-600" />{t("admin.logCall")}</div>
                  <div className="flex gap-2">
                    <Select className="h-10 w-32" value={comm.channel} onChange={(e) => setComm({ ...comm, channel: e.target.value })}>{["phone", "telegram", "whatsapp", "email", "sms", "meeting"].map((c) => <option key={c}>{c}</option>)}</Select>
                    <Input className="h-10" value={comm.summary} onChange={(e) => setComm({ ...comm, summary: e.target.value })} />
                    <Button disabled={!comm.summary.trim()} onClick={() => post("/admin/communications/", { lead: l.id, patient: l.patient, ...comm }, () => setComm({ ...comm, summary: "" }))}>{t("common.add")}</Button>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[13px] font-semibold">{t("admin.tab.tasks")}</div>
                  <div className="flex gap-2">
                    <Input className="h-10" placeholder={t("dash.title")} value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
                    <Input className="h-10 w-48" type="datetime-local" value={task.due_at} onChange={(e) => setTask({ ...task, due_at: e.target.value })} />
                    <Button disabled={!task.title.trim()} onClick={() => post("/admin/tasks/", { lead: l.id, patient: l.patient, title: task.title, assignee: l.assigned_to, due_at: task.due_at ? new Date(task.due_at).toISOString() : null }, () => setTask({ title: "", due_at: "" }))}>{t("common.add")}</Button>
                  </div>
                </div>
              </div>
            </>
          ) : <Timeline items={acts.data || []} />}
        </div>
      )}
    </Modal>
  );
}

export function Timeline({ items }: { items: Activity[] }) {
  const t = useTranslations();
  const locale = useLocale();
  if (!items.length) return <p className="py-8 text-center text-sm text-ink-muted">{t("common.empty")}</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[25px] top-1 size-2.5 rounded-full bg-teal-500 ring-4 ring-white" />
          <div className="text-[13px] text-ink">
            {a.type === "stage_changed" ? <span className="inline-flex flex-wrap items-center gap-1.5">{t(`stage.${a.from_stage}`)} <ArrowRight className="size-3.5 text-ink-muted" /> <b>{t(`stage.${a.to_stage}`)}</b></span> : activityText(t, a)}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-muted"><span className="rounded bg-mist px-1">{t.has(`activityType.${a.type}`) ? t(`activityType.${a.type}`) : a.type}</span> · {a.actor?.name || t("adminUi.system")} · {date(a.created_at, locale, true)}</div>
        </li>
      ))}
    </ol>
  );
}

export function NewLeadModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const t = useTranslations();
  const qc = useQueryClient();
  const ref = useRefFilters();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      const r = await api<{ id: number }>("/admin/leads/", { body: { ...fd, destination: fd.destination || null, specialty: fd.specialty || null } });
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      onCreated(r.id);
    } catch (err) { setErrors(err instanceof ApiError ? err.fieldErrors() : {}); toast.error((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t("admin.newLead")}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={t("form.fullName")} error={errors.full_name} required><Input name="full_name" required /></Field>
        <Field label={t("form.phone")} error={errors.phone} required><Input name="phone" required /></Field>
        <Field label={t("form.email")}><Input name="email" type="email" /></Field>
        <Field label={t("admin.priority")}><Select name="priority" defaultValue="normal">{["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}</Select></Field>
        <Field label={t("form.destination")}><Select name="destination"><option value="">—</option>{ref?.countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}</Select></Field>
        <Field label={t("common.specialty")}><Select name="specialty"><option value="">—</option>{ref?.specialties.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</Select></Field>
        <Field label={t("form.message")} className="sm:col-span-2"><Textarea name="message" rows={3} /></Field>
        <Button type="submit" loading={busy} className="sm:col-span-2">{t("common.create")}</Button>
      </form>
    </Modal>
  );
}
