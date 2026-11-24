"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Plus, RefreshCw, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/portal/shell";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, LoadingBlock, Modal, Select, Stat, Tabs, Textarea } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { api, openSignedLink, type Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStaff } from "@/lib/hooks";
import { cn, date, fileSize, money } from "@/lib/utils";
import { BarChart } from "./charts";
import { auditHref, auditLabel } from "./dashboard";

function usePaged<T>(key: unknown[], path: string) {
  return useQuery({ queryKey: key, queryFn: () => api<Paginated<T>>(path) });
}

/* ---------------- Tasks ---------------- */
type Task = { id: number; title: string; description: string; status: string; priority: string; due_at: string | null; assignee: number | null; assignee_name: string | null; lead: number | null; lead_name: string | null; patient: number | null; patient_name: string | null; is_overdue: boolean };
export function TasksPage() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const staff = useStaff();
  const [filter, setFilter] = useState<"mine" | "overdue" | "open" | "all">("mine");
  const [creating, setCreating] = useState(false);
  const qs = filter === "mine" ? "mine=1&status=open" : filter === "overdue" ? "overdue=1" : filter === "open" ? "status=open" : "";
  const q = usePaged<Task>(["tasks", filter], `/admin/tasks/?page_size=100&ordering=due_at&${qs}`);
  const update = async (task: Task, status: string) => {
    try { await api(`/admin/tasks/${task.id}/`, { method: "PATCH", body: { status } }); qc.invalidateQueries({ queryKey: ["tasks"] }); } catch (e) { toast.error((e as Error).message); }
  };
  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      await api("/admin/tasks/", { body: { ...fd, assignee: fd.assignee || null, due_at: fd.due_at ? new Date(fd.due_at).toISOString() : null } });
      setCreating(false); qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success(t("common.saved"));
    } catch (err) { toast.error((err as Error).message); }
  };
  return (
    <>
      <PageTitle title={t("admin.tasks")} actions={<Button onClick={() => setCreating(true)}><Plus className="size-4" />{t("common.add")}</Button>} />
      <Tabs className="mb-4" value={filter} onChange={setFilter} tabs={[{ value: "mine", label: t("adminUi.myTasks") }, { value: "overdue", label: t("admin.overdue") }, { value: "open", label: t("adminUi.openTasks") }, { value: "all", label: t("common.all") }]} />
      {q.isLoading ? <LoadingBlock /> : !q.data?.results.length ? <Empty title={t("common.empty")} /> : (
        <div className="card divide-y divide-line">
          {q.data.results.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center gap-3 p-4">
              <button onClick={() => update(x, x.status === "done" ? "open" : "done")} aria-label="toggle">{x.status === "done" ? <CheckCircle2 className="size-5 text-success" /> : <CircleDashed className="size-5 text-ink-muted" />}</button>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-semibold", x.status === "done" && "text-ink-muted line-through")}>{x.title}</div>
                <div className="text-xs text-ink-muted">
                  {x.lead && <Link href={`/admin/crm?lead=${x.lead}`} className="hover:text-teal-700">{x.lead_name}</Link>}
                  {x.patient && !x.lead && <Link href={`/admin/patients/${x.patient}`} className="hover:text-teal-700">{x.patient_name}</Link>}
                  {x.assignee_name && ` · ${x.assignee_name}`}
                </div>
              </div>
              <span className={cn("text-xs", x.is_overdue ? "font-semibold text-danger" : "text-ink-muted")}>{date(x.due_at, locale, true)}</span>
              <Badge tone={x.status === "done" ? "success" : x.status === "cancelled" ? "danger" : "neutral"}>{t.has(`taskStatus.${x.status}`) ? t(`taskStatus.${x.status}`) : x.status}</Badge>
            </div>
          ))}
        </div>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title={t("common.add")}>
        <form onSubmit={create} className="space-y-3">
          <Field label={t("dash.title")}><Input name="title" required /></Field>
          <Field label={t("dash.description")}><Textarea name="description" rows={2} /></Field>
          <Field label={t("admin.manager")}><Select name="assignee"><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label={t("adminUi.dueAt")}><Input name="due_at" type="datetime-local" /></Field>
          <Field label={t("admin.priority")}><Select name="priority" defaultValue="normal">{["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}</Select></Field>
          <Button type="submit" className="w-full">{t("common.save")}</Button>
        </form>
      </Modal>
    </>
  );
}

/* ---------------- Documents ---------------- */
type DocRow = { id: number; title: string; category: string; patient: number; original_name: string; size: number; uploaded_at: string; uploaded_by_name: string | null; case_reference: string | null };
export function DocumentsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [cat, setCat] = useState("");
  const [search, setSearch] = useState("");
  const q = usePaged<DocRow>(["docs", cat, search], `/admin/documents/?page_size=50${cat ? `&category=${cat}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
  return (
    <>
      <PageTitle title={t("admin.documents")} subtitle={t("dash.privateNote")} />
      <div className="card mb-4 flex flex-wrap gap-2 p-3">
        <Input className="h-9 max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.searchPlaceholder")} />
        <Select className="h-9 w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">{t("dash.category")}: {t("common.all")}</option>{["report", "blood_test", "mri", "ct", "xray", "ultrasound", "prescription", "discharge", "diagnosis", "opinion", "passport", "other"].map((c) => <option key={c} value={c}>{t(`doc.${c}`)}</option>)}</Select>
      </div>
      {q.isLoading ? <LoadingBlock /> : !q.data?.results.length ? <Empty title={t("common.empty")} /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><tbody className="divide-y divide-line">
          {q.data.results.map((d) => (
            <tr key={d.id}><td className="p-3 font-semibold">{d.title}</td><td className="p-3 text-xs">{t(`doc.${d.category}`)}</td>
              <td className="p-3 text-xs"><Link href={`/admin/patients/${d.patient}`} className="text-teal-700">#{d.patient}</Link>{d.case_reference && ` · ${d.case_reference}`}</td>
              <td className="p-3 text-xs text-ink-muted">{fileSize(d.size)} · {date(d.uploaded_at, locale)}</td>
              <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => openSignedLink(`/admin/documents/${d.id}/link/`).catch((e) => toast.error(e.message))}>{t("common.open")}</Button></td></tr>
          ))}
        </tbody></table></div>
      )}
    </>
  );
}

/* ---------------- Quotations ---------------- */
type Quote = { id: number; case: number; case_reference: string; patient_name: string; hospital_name: string; amount_min: string; amount_max: string | null; currency: string; quote_type_label: string; status: string; created_at: string };
export function QuotationsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const q = usePaged<Quote>(["quotes", status], `/admin/quotations/?page_size=50${status ? `&status=${status}` : ""}`);
  return (
    <>
      <PageTitle title={t("admin.quotations")} subtitle={t("common.disclaimerPrice")} />
      <Select className="mb-4 h-9 w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t("common.status")}: {t("common.all")}</option>{["draft", "submitted", "sent", "accepted", "rejected", "expired"].map((s) => <option key={s} value={s}>{t(`quoteStatus.${s}`)}</option>)}</Select>
      {q.isLoading ? <LoadingBlock /> : !q.data?.results.length ? <Empty title={t("common.empty")} /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><tbody className="divide-y divide-line">
          {q.data.results.map((x) => (
            <tr key={x.id} className="cursor-pointer hover:bg-mist/50" onClick={() => router.push(`/admin/cases/${x.case}`)}>
              <td className="p-3 font-mono text-xs font-bold">{x.case_reference}</td><td className="p-3">{x.patient_name}</td><td className="p-3 font-semibold">{x.hospital_name}</td>
              <td className="p-3">{money(x.amount_min, x.currency, locale)}{x.amount_max && ` – ${money(x.amount_max, x.currency, locale)}`}</td><td className="p-3 text-xs">{x.quote_type_label}</td>
              <td className="p-3"><Badge tone={x.status === "accepted" ? "success" : x.status === "rejected" ? "danger" : "neutral"}>{t(`quoteStatus.${x.status}`)}</Badge></td><td className="p-3 text-xs text-ink-muted">{date(x.created_at, locale)}</td></tr>
          ))}
        </tbody></table></div>
      )}
    </>
  );
}

/* ---------------- Travel ---------------- */
type Travel = { id: number; case: number; case_reference: string; patient_name: string; arrival_date: string | null; departure_date: string | null; hotel_name: string; visa_status: string; interpreter: string };
export function TravelPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const q = useQuery({ queryKey: ["travel"], queryFn: () => api<Travel[]>("/admin/travel/") });
  return (
    <>
      <PageTitle title={t("admin.travel")} />
      {q.isLoading ? <LoadingBlock /> : !q.data?.length ? <Empty title={t("common.empty")} text={t("admin.cases")} /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead className="bg-mist/70 text-left text-xs text-ink-muted"><tr><th className="p-3">Ref</th><th className="p-3">{t("common.name")}</th><th className="p-3">Arrival</th><th className="p-3">Departure</th><th className="p-3">Visa</th><th className="p-3">Hotel</th></tr></thead>
          <tbody className="divide-y divide-line">{q.data.map((x) => (
            <tr key={x.id} className="cursor-pointer hover:bg-mist/50" onClick={() => router.push(`/admin/cases/${x.case}`)}>
              <td className="p-3 font-mono text-xs font-bold">{x.case_reference}</td><td className="p-3">{x.patient_name}</td><td className="p-3">{date(x.arrival_date, locale)}</td><td className="p-3">{date(x.departure_date, locale)}</td>
              <td className="p-3"><Badge tone={x.visa_status === "approved" ? "success" : x.visa_status === "rejected" ? "danger" : "warning"}>{x.visa_status}</Badge></td><td className="p-3 text-xs">{x.hotel_name || "—"}</td></tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}

/* ---------------- Finance ---------------- */
type Pay = { id: number; uid: string; patient: number | null; patient_name: string | null; case: number | null; case_reference: string | null; hospital_name: string | null; direction: string; kind: string; amount: string; currency: string; amount_usd: string | null; status: string; status_label: string; method: string; provider_reference: string; notes: string; created_at: string; due_date: string | null };
type Summary = Record<string, string> & { monthly: { month: string; total: string }[]; note: string; unconverted_count: number };
export function FinancePage() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [tab, setTab] = useState<"payments" | "expenses" | "commissions">("payments");
  const [form, setForm] = useState<Pay | "new" | null>(null);
  const sum = useQuery({ queryKey: ["fin-summary"], queryFn: () => api<Summary>("/admin/payments/summary/") });
  const list = usePaged<Pay>(["payments"], "/admin/payments/?page_size=100");
  const exp = usePaged<{ id: number; category: string; description: string; amount: string; currency: string; spent_on: string; case_reference: string | null }>(["expenses"], "/admin/expenses/?page_size=100");
  const com = usePaged<{ id: number; case_reference: string; hospital_name: string; amount: string; currency: string; status: string; rate_percent: string | null }>(["commissions"], "/admin/commissions/?page_size=100");
  const s = sum.data;
  const usd = (v?: string) => money(v ?? 0, "USD", locale);
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body = { ...fd, case: fd.case || null, patient: fd.patient || null, due_date: fd.due_date || null, paid_at: fd.status === "confirmed" ? new Date().toISOString() : null };
    try {
      await api(form === "new" ? "/admin/payments/" : `/admin/payments/${(form as Pay).id}/`, { method: form === "new" ? "POST" : "PATCH", body });
      toast.success(t("common.saved")); setForm(null);
      qc.invalidateQueries({ queryKey: ["payments"] }); qc.invalidateQueries({ queryKey: ["fin-summary"] });
    } catch (err) { toast.error((err as Error).message); }
  };
  const simpleAdd = async (path: string, e: React.FormEvent<HTMLFormElement>, key: string) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try { await api(path, { body: { ...fd, case: fd.case || null } }); (e.target as HTMLFormElement).reset(); qc.invalidateQueries({ queryKey: [key] }); qc.invalidateQueries({ queryKey: ["fin-summary"] }); toast.success(t("common.saved")); } catch (err) { toast.error((err as Error).message); }
  };
  const p = form && form !== "new" ? form : null;
  return (
    <>
      <PageTitle title={t("admin.finance")} actions={can("finance.edit") && tab === "payments" && <Button onClick={() => setForm("new")}><Plus className="size-4" />{t("common.add")}</Button>} />
      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Revenue (fees + commission received)" value={usd(s.revenue)} /><Stat label="Income (confirmed, incoming)" value={usd(s.income)} tone="navy" />
          <Stat label={t("admin.kpi.outstanding")} value={usd(s.outstanding)} tone="sand" /><Stat label="Paid to hospitals" value={usd(s.paid_to_hospitals)} tone="navy" />
          <Stat label="Commission expected" value={usd(s.commission_expected)} tone="sand" /><Stat label="Expenses" value={usd(s.expenses)} tone="danger" />
          <Stat label="Net" value={usd(s.net)} /><Stat label="Service fees" value={usd(s.service_fees)} />
        </div>
      )}
      {s?.note && <p className="mb-4 rounded-xl bg-warning-soft px-4 py-2 text-xs text-warning">{s.note}</p>}
      {s?.monthly?.length ? <Card className="mb-6"><h3 className="mb-3 font-display font-bold">{t("admin.chart.revenue")}</h3><BarChart data={s.monthly.map((m) => ({ label: m.month, value: Number(m.total) }))} format={(v) => usd(String(v))} empty={t("admin.noData")} /></Card> : null}
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: "payments", label: "Payments" }, { value: "expenses", label: "Expenses" }, { value: "commissions", label: "Commissions" }]} />
      {tab === "payments" && (list.isLoading ? <LoadingBlock /> : !list.data?.results.length ? <Empty title={t("common.empty")} /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead className="bg-mist/70 text-left text-xs text-ink-muted"><tr><th className="p-3">ID</th><th className="p-3">{t("common.name")}</th><th className="p-3">Kind</th><th className="p-3">Direction</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">USD</th><th className="p-3">{t("common.status")}</th><th className="p-3">Method</th><th className="p-3">{t("common.date")}</th></tr></thead>
          <tbody className="divide-y divide-line">{list.data.results.map((x) => (
            <tr key={x.id} className={cn(can("finance.edit") && "cursor-pointer hover:bg-mist/50")} onClick={() => can("finance.edit") && setForm(x)}>
              <td className="p-3 font-mono text-xs">{x.uid}</td><td className="p-3">{x.patient_name || x.hospital_name || "—"}<div className="text-xs text-ink-muted">{x.case_reference}</div></td>
              <td className="p-3 text-xs">{x.kind}</td><td className="p-3 text-xs">{x.direction}</td><td className="p-3 text-right font-semibold">{money(x.amount, x.currency, locale)}</td>
              <td className="p-3 text-right text-xs">{x.amount_usd ? usd(x.amount_usd) : <span className="text-warning" title="No stored exchange rate">—</span>}</td>
              <td className="p-3"><Badge tone={x.status === "confirmed" ? "success" : x.status === "pending" ? "warning" : "danger"}>{x.status_label}</Badge></td><td className="p-3 text-xs">{x.method}</td><td className="p-3 text-xs text-ink-muted">{date(x.created_at, locale)}</td></tr>
          ))}</tbody></table></div>
      ))}
      {tab === "expenses" && (
        <Card>
          {can("finance.edit") && <form onSubmit={(e) => simpleAdd("/admin/expenses/", e, "expenses")} className="mb-4 grid gap-2 sm:grid-cols-[150px_1fr_120px_100px_150px_auto]">
            <Select name="category" className="h-10">{["travel", "hotel", "interpreter", "marketing", "operations", "other"].map((c) => <option key={c}>{c}</option>)}</Select>
            <Input name="description" className="h-10" placeholder={t("dash.description")} required /><Input name="amount" type="number" step="any" className="h-10" required placeholder="0" />
            <Select name="currency" className="h-10">{["USD", "UZS", "EUR", "INR", "TRY", "CNY"].map((c) => <option key={c}>{c}</option>)}</Select>
            <Input name="spent_on" type="date" className="h-10" required /><Button type="submit">{t("common.add")}</Button>
          </form>}
          <ul className="divide-y divide-line text-sm">{exp.data?.results.map((x) => <li key={x.id} className="flex justify-between py-2.5"><span><Badge>{x.category}</Badge> {x.description}</span><span className="font-semibold">{money(x.amount, x.currency, locale)} <span className="text-xs font-normal text-ink-muted">{date(x.spent_on, locale)}</span></span></li>)}</ul>
          {!exp.data?.results.length && <p className="text-center text-sm text-ink-muted">{t("common.empty")}</p>}
        </Card>
      )}
      {tab === "commissions" && (
        <Card>
          <ul className="divide-y divide-line text-sm">{com.data?.results.map((x) => <li key={x.id} className="flex justify-between py-2.5"><span><b>{x.hospital_name}</b> · <span className="font-mono text-xs">{x.case_reference}</span>{x.rate_percent && ` · ${x.rate_percent}%`}</span><span><b>{money(x.amount, x.currency, locale)}</b> <Badge>{x.status}</Badge></span></li>)}</ul>
          {!com.data?.results.length && <p className="text-center text-sm text-ink-muted">{t("common.empty")}</p>}
          <p className="mt-3 text-xs text-ink-muted">Commissions are created per case via the API (POST /api/v2/admin/commissions/).</p>
        </Card>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={p ? p.uid : t("common.add")}>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field label="Patient ID"><Input name="patient" type="number" defaultValue={p?.patient ?? ""} /></Field>
          <Field label="Case ID"><Input name="case" type="number" defaultValue={p?.case ?? ""} /></Field>
          <Field label="Direction"><Select name="direction" defaultValue={p?.direction || "incoming"}><option value="incoming">incoming</option><option value="outgoing">outgoing</option></Select></Field>
          <Field label="Kind"><Select name="kind" defaultValue={p?.kind || "treatment"}>{["treatment", "service_fee", "deposit", "hospital_payment", "refund"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <Field label="Amount"><Input name="amount" type="number" step="any" required defaultValue={p?.amount} /></Field>
          <Field label="Currency"><Select name="currency" defaultValue={p?.currency || "USD"}>{["USD", "UZS", "EUR", "INR", "TRY", "CNY"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label={t("common.status")}><Select name="status" defaultValue={p?.status || "pending"}>{["pending", "confirmed", "failed", "refunded", "cancelled"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <Field label="Method"><Select name="method" defaultValue={p?.method || "bank_transfer"}>{["bank_transfer", "card", "cash", "payme", "click", "stripe", "other"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <Field label="Provider / bank reference (required to confirm)" className="sm:col-span-2"><Input name="provider_reference" defaultValue={p?.provider_reference} /></Field>
          <Field label="Due date"><Input name="due_date" type="date" defaultValue={p?.due_date || ""} /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" rows={2} defaultValue={p?.notes} /></Field>
          <Button type="submit" className="sm:col-span-2">{t("common.save")}</Button>
        </form>
      </Modal>
    </>
  );
}

/* ---------------- Notifications ---------------- */
type Notif = { id: number; type: string; title: string; body: string; link: string; read_at: string | null; created_at: string };
export function NotificationsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  const q = usePaged<Notif>(["notifications-page"], "/notifications/?page_size=100");
  const readAll = async () => { await api("/notifications/read_all/", { method: "POST" }); qc.invalidateQueries({ queryKey: ["notifications-page"] }); qc.invalidateQueries({ queryKey: ["notif-count"] }); };
  return (
    <>
      <PageTitle title={t("dash.notifications")} actions={<Button variant="outline" onClick={readAll}>{t("dash.markAllRead")}</Button>} />
      {q.isLoading ? <LoadingBlock /> : !q.data?.results.length ? <Empty title={t("common.empty")} /> : (
        <div className="card divide-y divide-line">{q.data.results.map((n) => (
          <button key={n.id} onClick={async () => { await api(`/notifications/${n.id}/read/`, { method: "POST" }); qc.invalidateQueries({ queryKey: ["notif-count"] }); if (n.link) router.push(n.link); }}
            className={cn("flex w-full items-start gap-3 p-4 text-left hover:bg-mist/50", !n.read_at && "bg-teal-50/40")}>
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-line-strong" : "bg-teal-500")} />
            <div className="flex-1"><div className="text-sm font-semibold">{n.title}</div>{n.body && <div className="text-sm text-ink-soft">{n.body}</div>}<div className="mt-1 text-[11px] text-ink-muted"><span className="rounded bg-mist px-1.5 py-0.5 font-semibold">{t.has(`notifType.${n.type}`) ? t(`notifType.${n.type}`) : n.type}</span> · {date(n.created_at, locale, true)}</div></div>
          </button>
        ))}</div>
      )}
    </>
  );
}

/* ---------------- Users & roles ---------------- */
type U = { id: number; username: string; email: string; first_name: string; last_name: string; is_active: boolean; role: string; phone: string; hospital: number | null; hospital_name: string | null; is_approved: boolean; last_login: string | null };
type RoleDef = { value: string; label: string; is_staff: boolean; permissions: string[] };
export function UsersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [role, setRole] = useState(useSearchParams().get("role") || "");
  const [editing, setEditing] = useState<U | "new" | null>(null);
  const roleName = (r: string, fallback?: string) => (t.has(`roles.${r}`) ? t(`roles.${r}`) : fallback || r);
  const q = usePaged<U>(["users", role], `/admin/users/?page_size=200${role ? `&account__role=${role}` : ""}`);
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<RoleDef[]>("/admin/users/roles/") }).data || [];
  const hospitals = useQuery({ queryKey: ["hospitals-lite"], queryFn: () => api<Paginated<{ id: number; name: string }>>("/admin/hospitals/?page_size=500") }).data?.results || [];
  const approve = async (u: U) => { try { await api(`/admin/users/${u.id}/approve/`, { method: "POST" }); qc.invalidateQueries({ queryKey: ["users"] }); toast.success(t("common.saved")); } catch (e) { toast.error((e as Error).message); } };
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body: Record<string, unknown> = { ...fd, hospital: fd.hospital ? Number(fd.hospital) : null, is_active: fd.is_active === "on", is_approved: true };
    if (!fd.password) delete body.password;
    if (editing === "new") body.username = fd.email;
    try {
      await api(editing === "new" ? "/admin/users/" : `/admin/users/${(editing as U).id}/`, { method: editing === "new" ? "POST" : "PATCH", body });
      toast.success(t("common.saved")); setEditing(null); qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err) { toast.error((err as Error).message); }
  };
  const u = editing && editing !== "new" ? editing : null;
  return (
    <>
      <PageTitle title={t("admin.users")} actions={can("users.edit") && <Button onClick={() => setEditing("new")}><Plus className="size-4" />{t("common.add")}</Button>} />
      <Select className="mb-4 h-9 w-auto" value={role} onChange={(e) => setRole(e.target.value)}><option value="">{t("adminUi.role")}: {t("common.all")}</option>{roles.map((r) => <option key={r.value} value={r.value}>{roleName(r.value, r.label)}</option>)}</Select>
      {q.isLoading ? <LoadingBlock /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead className="bg-mist/70 text-left text-xs text-ink-muted"><tr><th className="p-3">{t("common.name")}</th><th className="p-3">Email</th><th className="p-3">{t("adminUi.role")}</th><th className="p-3">{t("common.hospital")}</th><th className="p-3">{t("common.status")}</th><th className="p-3">{t("adminUi.lastLogin")}</th><th /></tr></thead>
          <tbody className="divide-y divide-line">{q.data?.results.map((x) => (
            <tr key={x.id} className="hover:bg-mist/50">
              <td className="p-3 font-semibold">{`${x.first_name} ${x.last_name}`.trim() || x.username}</td><td className="p-3 text-xs">{x.email}</td>
              <td className="p-3"><Badge tone="navy">{roleName(x.role, roles.find((r) => r.value === x.role)?.label)}</Badge></td><td className="p-3 text-xs">{x.hospital_name || "—"}</td>
              <td className="p-3">{!x.is_active ? <Badge tone="danger">{t("adminUi.inactive")}</Badge> : !x.is_approved ? <Badge tone="warning">{t("adminUi.pendingApproval")}</Badge> : <Badge tone="success">{t("adminUi.active")}</Badge>}</td>
              <td className="p-3 text-xs text-ink-muted">{x.last_login ? date(x.last_login, locale, true) : t("adminUi.never")}</td>
              <td className="p-3 text-right">{can("users.edit") && <div className="flex justify-end gap-1">
                {!x.is_approved && <Button size="sm" onClick={() => approve(x)} disabled={!x.hospital} title={!x.hospital ? t("adminUi.approveNeedsHospital") : undefined}>{t("adminUi.approve")}</Button>}
                <Button size="sm" variant="outline" onClick={() => setEditing(x)}>{t("common.edit")}</Button></div>}</td>
            </tr>
          ))}</tbody></table></div>
      )}
      <Card className="mt-6"><h3 className="mb-3 font-display font-bold">{t("adminUi.rolePermissions")}</h3>
        <div className="grid gap-3 md:grid-cols-2">{roles.map((r) => <div key={r.value} className="rounded-xl border border-line p-3"><div className="text-sm font-bold">{roleName(r.value, r.label)}</div><div className="mt-1.5 flex flex-wrap gap-1">{r.permissions.map((p2) => <span key={p2} className="rounded bg-mist px-1.5 py-0.5 font-mono text-[10px]">{p2}</span>)}{!r.permissions.length && <span className="text-xs text-ink-muted">{r.is_staff ? "—" : t("adminUi.ownDataOnly")}</span>}</div></div>)}</div>
      </Card>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={u ? u.email : t("common.add")}>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field label={t("auth.firstName")}><Input name="first_name" defaultValue={u?.first_name} /></Field>
          <Field label={t("auth.lastName")}><Input name="last_name" defaultValue={u?.last_name} /></Field>
          <Field label="Email" className="sm:col-span-2"><Input name="email" type="email" required defaultValue={u?.email} /></Field>
          <Field label={t("form.phone")}><Input name="phone" defaultValue={u?.phone} /></Field>
          <Field label={t("adminUi.role")}><Select name="role" defaultValue={u?.role || "sales_manager"}>{roles.map((r) => <option key={r.value} value={r.value}>{roleName(r.value, r.label)}</option>)}</Select></Field>
          <Field label={`${t("common.hospital")} (${t("adminUi.forPartners")})`} className="sm:col-span-2"><Select name="hospital" defaultValue={u?.hospital || ""}><option value="">—</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select></Field>
          <Field label={u ? t("adminUi.newPasswordOptional") : t("auth.password")} hint={t("auth.passwordHint")} className="sm:col-span-2"><Input name="password" type="password" minLength={8} required={!u} autoComplete="new-password" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={u ? u.is_active : true} className="accent-teal-500" />{t("adminUi.active")}</label>
          <Button type="submit" className="sm:col-span-2">{t("common.save")}</Button>
        </form>
      </Modal>
    </>
  );
}

/* ---------------- Integrations ---------------- */
type Integ = { integrations: { key: string; name: string; configured: boolean; env: string[]; note?: string }[]; recent_deliveries: { channel: string; event: string; success: boolean; detail: string; created_at: string }[] };
export function IntegrationsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ["integrations"], queryFn: () => api<Integ>("/admin/integrations/") });
  const rates = useQuery({ queryKey: ["rates"], queryFn: () => api<{ configured: boolean; rates: { code: string; rate: string; source: string; fetched_at: string }[] }>("/tools/rates/") });
  const test = async (key: string) => { try { const r = await api<{ ok: boolean; detail: string }>(`/admin/integrations/${key}/test/`, { method: "POST" }); if (r.ok) toast.success(r.detail); else toast.error(r.detail); q.refetch(); } catch (e) { toast.error((e as Error).message); } };
  const refreshRates = async () => { try { await api("/admin/rates/refresh/", { method: "POST", body: {} }); toast.success(t("common.saved")); rates.refetch(); } catch (e) { toast.error((e as Error).message); } };
  const manualRate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    try { await api("/admin/rates/refresh/", { body: { manual: true, ...fd } }); (e.target as HTMLFormElement).reset(); rates.refetch(); toast.success(t("common.saved")); } catch (err) { toast.error((err as Error).message); }
  };
  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBox message={(q.error as Error).message} />;
  return (
    <>
      <PageTitle title={t("admin.integrations")} subtitle="API keys live only in server environment variables and are never sent to the browser." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {q.data?.integrations.map((i) => (
          <Card key={i.key}>
            <div className="flex items-center justify-between"><h3 className="font-display font-bold">{i.name}</h3>
              {i.configured ? <Badge tone="success"><CheckCircle2 className="size-3" />{t("admin.integrationConfigured")}</Badge> : <Badge tone="neutral"><XCircle className="size-3" />{t("admin.integrationMissing")}</Badge>}</div>
            <div className="mt-3 flex flex-wrap gap-1">{i.env.map((e) => <code key={e} className="rounded bg-mist px-1.5 py-0.5 text-[10px]">{e}</code>)}</div>
            {i.note && <p className="mt-2 text-xs text-ink-muted">{i.note}</p>}
            {can("integrations.edit") && i.configured && ["email", "telegram"].includes(i.key) && <Button size="sm" variant="outline" className="mt-3" onClick={() => test(i.key)}>{t("admin.test")}</Button>}
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <div className="flex items-center justify-between"><h3 className="font-display font-bold">{t("tools.currency")}</h3>{can("integrations.edit") && <Button size="sm" variant="outline" onClick={refreshRates}><RefreshCw className="size-3.5" />Refresh from API</Button>}</div>
        {rates.data?.rates.length ? <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">{rates.data.rates.filter((r) => ["UZS", "EUR", "INR", "TRY", "CNY", "KRW", "AED", "THB", "KZT"].includes(r.code)).map((r) => <div key={r.code} className="rounded-lg bg-mist p-2"><b>USD/{r.code}</b> {Number(r.rate).toLocaleString()}<div className="text-[10px] text-ink-muted">{r.source} · {date(r.fetched_at, locale)}</div></div>)}</div> : <p className="mt-2 text-sm text-ink-muted">{t("tools.ratesMissing")}</p>}
        {can("integrations.edit") && <form onSubmit={manualRate} className="mt-4 grid gap-2 sm:grid-cols-[100px_140px_1fr_auto]"><Input name="code" placeholder="UZS" maxLength={3} required className="h-10 uppercase" /><Input name="rate" type="number" step="any" placeholder="1 USD =" required className="h-10" /><Input name="source" required className="h-10" /><Button type="submit">{t("common.save")}</Button></form>}
      </Card>
      <Card className="mt-6"><h3 className="mb-3 font-display font-bold">Delivery log</h3>
        {q.data?.recent_deliveries.length ? <ul className="divide-y divide-line text-sm">{q.data.recent_deliveries.map((d, i) => <li key={i} className="flex justify-between gap-3 py-2"><span>{d.success ? <CheckCircle2 className="inline size-4 text-success" /> : <XCircle className="inline size-4 text-danger" />} {d.channel} · {d.event} <span className="text-xs text-ink-muted">{d.detail}</span></span><span className="text-xs text-ink-muted">{date(d.created_at, locale, true)}</span></li>)}</ul> : <p className="text-sm text-ink-muted">{t("common.empty")}</p>}
      </Card>
    </>
  );
}

/* ---------------- Audit ---------------- */
type Audit = { id: number; actor_name: string; action: string; object_type: string; object_id: string; summary: string; ip_address: string | null; created_at: string; changes: Record<string, unknown> };
export function AuditPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = usePaged<Audit>(["audit", search, page], `/admin/audit-logs/?page=${page}&page_size=50${search ? `&search=${encodeURIComponent(search)}` : ""}`);
  const pages = Math.ceil((q.data?.count || 0) / 50);
  return (
    <>
      <PageTitle title={t("admin.audit")} subtitle={q.data && `${q.data.count} ${t("common.results")}`} />
      <Input className="mb-4 h-9 max-w-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("admin.searchPlaceholder")} />
      {q.isLoading ? <LoadingBlock /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
          <thead className="bg-mist/70 text-left text-xs text-ink-muted"><tr><th className="p-3">{t("common.date")}</th><th className="p-3">{t("adminUi.actor")}</th><th className="p-3">{t("adminUi.action")}</th><th className="p-3">{t("adminUi.object")}</th><th className="p-3">{t("adminUi.details")}</th><th className="p-3">IP</th></tr></thead>
          <tbody className="divide-y divide-line">{q.data?.results.map((a) => (
            <tr key={a.id} title={JSON.stringify(a.changes)}><td className="whitespace-nowrap p-3 text-xs text-ink-muted">{date(a.created_at, locale, true)}</td><td className="p-3 text-xs">{a.actor_name && a.actor_name !== "system" ? a.actor_name : t("adminUi.system")}</td>
              <td className="p-3 text-xs font-semibold text-navy-900" title={a.action}>{auditLabel(t, a.action)}</td>
              <td className="p-3 text-xs">{(() => { const href = auditHref(a.object_type, a.object_id); const txt = `${t.has(`auditType.${a.object_type}`) ? t(`auditType.${a.object_type}`) : a.object_type}${a.object_id ? ` #${a.object_id}` : ""}`; return href ? <Link href={href} className="text-teal-700 hover:underline">{txt}</Link> : txt; })()}</td>
              <td className="max-w-80 truncate p-3 text-xs">{a.summary}</td><td className="p-3 text-xs text-ink-muted">{a.ip_address}</td></tr>
          ))}</tbody></table>
          {pages > 1 && <div className="flex justify-end gap-2 border-t border-line p-3 text-sm"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.back")}</Button><span>{page}/{pages}</span><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("common.next")}</Button></div>}
        </div>
      )}
    </>
  );
}
