"use client";

import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, CalendarClock, Download, Eye, EyeOff, Inbox, KanbanSquare, MapPin, Phone, Plus, Rows3, Search, Send, Siren, Stethoscope, UserRound, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/portal/shell";
import { Badge, Button, ErrorBox, Input, LoadingBlock, Select } from "@/components/ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import { api, downloadAuthed, type Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRefFilters, useStaff } from "@/lib/hooks";
import { cn, date, initials, money, qs } from "@/lib/utils";
import { LeadDrawer, NewLeadModal } from "./lead-drawer";

export type Lead = {
  id: number; full_name: string; phone: string; email: string; stage: string; stage_label: string; priority: string; position: number;
  country_name: string | null; resident_region: string; destination_name: string | null; treatment_name: string | null; specialty_name: string | null;
  hospital_name: string | null; source_name: string | null; assigned: { id: number; name: string } | null; next_follow_up: string | null;
  is_overdue: boolean; budget: string | null; budget_currency: string; created_at: string; message: string; patient: number | null;
  destination: number | null; treatment: number | null; specialty: number | null; assigned_to: number | null; lost_reason: string;
};
type Column = { stage: string; label: string; count: number; leads: Lead[] };

export const PRIORITY_TONE: Record<string, "neutral" | "teal" | "warning" | "danger"> = { low: "neutral", normal: "teal", high: "warning", urgent: "danger" };
const STAGE_ACCENT: Record<string, string> = {
  new: "bg-teal-400", contacted: "bg-teal-500", qualification: "bg-navy-600", documents_pending: "bg-sand-400", medical_review: "bg-navy-700",
  quotation_sent: "bg-teal-600", negotiation: "bg-sand-500", confirmed: "bg-success", travel_preparation: "bg-navy-800", in_treatment: "bg-teal-700",
  completed: "bg-success", lost: "bg-danger",
};

function useFilters() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const get = (k: string) => sp.get(k) || "";
  const set = (patch: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };
  const params = { q: get("q"), priority: get("priority"), destination: get("destination"), specialty: get("specialty"), assigned_to: get("assigned_to"),
    source: get("source"), mine: get("mine"), overdue: get("overdue"), unassigned: get("unassigned"), stage: get("stage"),
    due_today: get("due_today"), fresh: get("fresh"), demo: get("demo") };
  return { get, set, params, view: get("view") || "kanban", leadId: get("lead") };
}

export function CRMPage() {
  const t = useTranslations();
  const { can } = useAuth();
  const f = useFilters();
  const ref = useRefFilters();
  const staff = useStaff();
  const [q, setQ] = useState(f.params.q);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => q !== f.params.q && f.set({ q }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const filterQs = qs({ ...f.params, stage: f.view === "table" ? f.params.stage : "" });
  const summary = useQuery({ queryKey: ["crm-summary"], queryFn: () => api<Record<string, number>>("/admin/leads/summary/"), refetchInterval: 60_000 });
  const [showClosed, setShowClosed] = useState(false);
  const STATS: [string, string, typeof Inbox, string][] = [
    ["fresh", t("crmUi.fresh"), Inbox, "text-teal-600 bg-teal-50"],
    ["due_today", t("crmUi.dueToday"), CalendarClock, "text-navy-700 bg-navy-900/5"],
    ["overdue", t("crmUi.overdue"), Siren, "text-danger bg-danger-soft"],
    ["unassigned", t("crmUi.unassigned"), UserX, "text-warning bg-warning-soft"],
  ];

  return (
    <>
      <PageTitle title={t("admin.crm")} actions={<>
        <div className="flex rounded-xl border border-line bg-white p-1">
          {[["kanban", KanbanSquare, t("admin.kanban")], ["table", Rows3, t("admin.table")]].map(([v, I, label]) => {
            const Icon = I as typeof KanbanSquare;
            return <button key={v as string} onClick={() => f.set({ view: v === "kanban" ? "" : (v as string) })}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold", f.view === v ? "bg-navy-900 text-white" : "text-ink-soft")}><Icon className="size-3.5" />{label as string}</button>;
          })}
        </div>
        {can("crm.export") && <Button variant="outline" onClick={() => downloadAuthed(`/admin/leads/export/${filterQs}`, "medmapp-leads.csv").catch((e) => toast.error(e.message))}><Download className="size-4" />{t("admin.exportCsv")}</Button>}
        {can("crm.edit") && <Button onClick={() => setCreating(true)}><Plus className="size-4" />{t("admin.newLead")}</Button>}
      </>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map(([k, label, I, tone]) => {
          const on = !!f.get(k);
          return (
            <button key={k} onClick={() => f.set({ [k]: on ? "" : "1" })}
              className={cn("card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift", on && "ring-2 ring-teal-400")}>
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tone)}><I className="size-5" /></span>
              <span>
                <span className="block font-display text-2xl font-extrabold leading-none text-navy-900">{summary.data?.[k] ?? "–"}</span>
                <span className="mt-1 block text-xs font-medium text-ink-soft">{label}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1 sm:flex-none">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.searchPlaceholder")} className="h-9 pl-9" />
        </div>
        {f.view === "table" && (
          <Select value={f.params.stage} onChange={(e) => f.set({ stage: e.target.value })} className="h-9 w-auto">
            <option value="">{t("admin.stage")}: {t("common.all")}</option>
            {Object.keys(STAGE_ACCENT).map((s) => <option key={s} value={s}>{t(`stage.${s}`)}</option>)}
          </Select>
        )}
        <Select value={f.params.priority} onChange={(e) => f.set({ priority: e.target.value })} className="h-9 w-auto">
          <option value="">{t("admin.priority")}: {t("common.all")}</option>
          {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
        </Select>
        <Select value={f.params.destination} onChange={(e) => f.set({ destination: e.target.value })} className="h-9 w-auto">
          <option value="">{t("common.country")}: {t("common.all")}</option>
          {ref?.countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}
        </Select>
        <Select value={f.params.specialty} onChange={(e) => f.set({ specialty: e.target.value })} className="h-9 w-auto">
          <option value="">{t("common.specialty")}: {t("common.all")}</option>
          {ref?.specialties.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </Select>
        <Select value={f.params.assigned_to} onChange={(e) => f.set({ assigned_to: e.target.value })} className="h-9 w-auto">
          <option value="">{t("admin.manager")}: {t("common.all")}</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        {[["mine", t("admin.mine")], ["overdue", t("admin.overdue")], ["unassigned", t("admin.unassigned")]].map(([k, label]) => (
          <button key={k} onClick={() => f.set({ [k]: f.get(k) ? "" : "1" })}
            className={cn("h-9 rounded-xl border px-3 text-xs font-semibold", f.get(k) ? "border-teal-500 bg-teal-50 text-teal-700" : "border-line-strong text-ink-soft")}>{label}</button>
        ))}
        <span className="ml-auto flex flex-wrap gap-2">
          {f.view !== "table" && (
            <button onClick={() => setShowClosed((v) => !v)} className="flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-xs font-semibold text-ink-soft hover:text-navy-900">
              {showClosed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{showClosed ? t("crmUi.hideClosed") : t("crmUi.showClosed")}
            </button>
          )}
          {!!summary.data?.demo && (
            <button onClick={() => f.set({ demo: f.get("demo") ? "" : "1" })}
              className={cn("h-9 rounded-xl border px-3 text-xs font-semibold", f.get("demo") ? "border-sand-400 bg-sand-100 text-sand-500" : "border-dashed border-line-strong text-ink-muted")}>
              {t("crmUi.demo", { n: summary.data.demo })}
            </button>
          )}
        </span>
      </div>
      {f.view === "table" ? <LeadsTable filterQs={filterQs} onOpen={(id) => f.set({ lead: String(id) })} /> : <Board filterQs={filterQs} showClosed={showClosed} onOpen={(id) => f.set({ lead: String(id) })} />}
      <LeadDrawer id={f.leadId ? Number(f.leadId) : null} onClose={() => f.set({ lead: "" })} />
      <NewLeadModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); f.set({ lead: String(id) }); }} />
    </>
  );
}

/* ---------------------------------------------------------------- Kanban */
const CLOSED = ["completed", "lost"];

function Board({ filterQs, onOpen, showClosed }: { filterQs: string; onOpen: (id: number) => void; showClosed: boolean }) {
  const t = useTranslations();
  const qc = useQueryClient();
  const { can } = useAuth();
  const key = ["board", filterQs];
  const query = useQuery({ queryKey: key, queryFn: () => api<Column[]>(`/admin/leads/board/${filterQs}`) });
  const [cols, setCols] = useState<Column[]>([]);
  const [active, setActive] = useState<Lead | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => { if (query.data) setCols(query.data); }, [query.data]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const findCol = (id: string | number) => cols.find((c) => c.stage === id || c.leads.some((l) => l.id === id));

  const onStart = (e: DragStartEvent) => {
    const c = findCol(e.active.id as number);
    setActive(c?.leads.find((l) => l.id === e.active.id) || null);
    setOrigin(c?.stage || null);
  };
  const onOver = (e: DragOverEvent) => {
    const { active: a, over } = e;
    if (!over) return;
    const from = findCol(a.id as number);
    const to = findCol(over.id as string | number);
    if (!from || !to || from.stage === to.stage) return;
    setCols((prev) => prev.map((c) => {
      if (c.stage === from.stage) return { ...c, leads: c.leads.filter((l) => l.id !== a.id), count: c.count - 1 };
      if (c.stage === to.stage) {
        const lead = from.leads.find((l) => l.id === a.id)!;
        const idx = c.leads.findIndex((l) => l.id === over.id);
        const leads = [...c.leads];
        leads.splice(idx >= 0 ? idx : leads.length, 0, { ...lead, stage: c.stage });
        return { ...c, leads, count: c.count + 1 };
      }
      return c;
    }));
  };
  const onEnd = async (e: DragEndEvent) => {
    const { active: a, over } = e;
    setActive(null);
    if (!over) return setCols(query.data || []);
    const col = findCol(over.id as string | number);
    if (!col) return;
    let leads = col.leads;
    const oldIdx = leads.findIndex((l) => l.id === a.id);
    const overIdx = leads.findIndex((l) => l.id === over.id);
    if (oldIdx >= 0 && overIdx >= 0 && oldIdx !== overIdx) {
      leads = [...leads];
      const [m] = leads.splice(oldIdx, 1);
      leads.splice(overIdx, 0, m);
      setCols((prev) => prev.map((c) => (c.stage === col.stage ? { ...c, leads } : c)));
    }
    const idx = leads.findIndex((l) => l.id === a.id);
    if (col.stage === origin && oldIdx === overIdx) return;
    try {
      await api(`/admin/leads/${a.id}/move/`, { body: { stage: col.stage, before_id: leads[idx - 1]?.id ?? null, after_id: leads[idx + 1]?.id ?? null } });
      if (col.stage !== origin) toast.success(`${active?.full_name}: ${t(`stage.${col.stage}`)}`);
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["crm-summary"] });
    } catch (err) {
      toast.error((err as Error).message);
      setCols(query.data || []);
    }
  };

  if (query.isLoading) return <LoadingBlock />;
  if (query.error) return <ErrorBox message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => { setActive(null); setCols(query.data || []); }}>
      <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {cols.filter((c) => showClosed || !CLOSED.includes(c.stage) || c.leads.some((l) => l.id === active?.id)).map((c) => <ColumnView key={c.stage} col={c} onOpen={onOpen} disabled={!can("crm.edit")} />)}
      </div>
      <DragOverlay>{active ? <Card lead={active} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function ColumnView({ col, onOpen, disabled }: { col: Column; onOpen: (id: number) => void; disabled: boolean }) {
  const t = useTranslations();
  const { setNodeRef, isOver } = useDroppable({ id: col.stage });
  return (
    <section ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-2xl bg-navy-900/[0.035] transition", isOver && "bg-teal-50 ring-2 ring-teal-300")}>
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className={cn("size-2.5 rounded-full", STAGE_ACCENT[col.stage])} />
        <h3 className="flex-1 truncate text-[13px] font-bold text-navy-900">{t(`stage.${col.stage}`)}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-soft shadow-card">{col.count}</span>
      </header>
      <SortableContext items={col.leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="scrollbar-thin flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: "calc(100vh - 290px)" }}>
          {col.leads.map((l) => <SortableCard key={l.id} lead={l} onOpen={onOpen} disabled={disabled} />)}
          {col.count > col.leads.length && <p className="py-1 text-center text-[11px] text-ink-muted">+{col.count - col.leads.length}</p>}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ lead, onOpen, disabled }: { lead: Lead; onOpen: (id: number) => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}
      className={cn(isDragging && "opacity-30")} onClick={() => onOpen(lead.id)}>
      <Card lead={lead} />
    </div>
  );
}

/** "5 min", "3 h", "2 d" since the lead arrived: response speed matters most for new requests. */
function age(iso: string, t: (k: string, v?: Record<string, number>) => string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? t("crmUi.ageMin", { n: m }) : m < 1440 ? t("crmUi.ageHour", { n: Math.round(m / 60) }) : t("crmUi.ageDay", { n: Math.round(m / 1440) });
}

function Card({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const tel = lead.phone.replace(/[^\d+]/g, "");
  const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onClick: (e: React.MouseEvent) => e.stopPropagation() };
  return (
    <article className={cn("cursor-pointer rounded-xl border border-line bg-white p-3 shadow-card transition hover:border-teal-300 hover:shadow-lift", dragging && "rotate-2 shadow-lift ring-2 ring-teal-400")}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-bold leading-snug text-navy-900">{lead.full_name}</h4>
        <Badge tone={PRIORITY_TONE[lead.priority]}>{t(`priority.${lead.priority}`)}</Badge>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs text-ink-soft"><Phone className="size-3" />{lead.phone}</p>
        {tel && (
          <span className="flex gap-1">
            <a href={`tel:${tel}`} {...stop} aria-label={t("crmUi.call")} title={t("crmUi.call")} className="grid size-6 place-items-center rounded-md bg-teal-50 text-teal-700 hover:bg-teal-500 hover:text-white"><Phone className="size-3" /></a>
            <a href={`https://t.me/${tel.startsWith("+") ? tel : `+${tel}`}`} target="_blank" rel="noopener noreferrer" {...stop} aria-label="Telegram" title="Telegram" className="grid size-6 place-items-center rounded-md bg-teal-50 text-teal-700 hover:bg-teal-500 hover:text-white"><Send className="size-3" /></a>
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-ink-muted">
        {(lead.treatment_name || lead.specialty_name) && <p className="flex items-center gap-1 truncate"><Stethoscope className="size-3 shrink-0" />{lead.treatment_name || lead.specialty_name}</p>}
        {(lead.destination_name || lead.country_name || lead.resident_region) && <p className="flex items-center gap-1 truncate"><MapPin className="size-3 shrink-0" />{[lead.country_name || lead.resident_region, lead.destination_name].filter(Boolean).join(" → ")}</p>}
      </div>
      <footer className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2 text-[11px]">
        {lead.assigned ? <span className="flex items-center gap-1.5 text-ink-soft"><span className="grid size-5 place-items-center rounded-full bg-navy-900 text-[9px] font-bold text-white">{initials(lead.assigned.name)}</span>{lead.assigned.name.split(" ")[0]}</span>
          : <span className="flex items-center gap-1 text-ink-muted"><UserRound className="size-3" />—</span>}
        {lead.next_follow_up ? <span className={cn("flex items-center gap-1", lead.is_overdue ? "font-semibold text-danger" : "text-ink-muted")}><AlarmClock className="size-3" />{date(lead.next_follow_up, locale)}</span>
          : <span className={cn("text-ink-muted", lead.stage === "new" && "font-semibold text-teal-700")} title={date(lead.created_at, locale, true)}>{age(lead.created_at, t)}</span>}
      </footer>
    </article>
  );
}

/* ---------------------------------------------------------------- Table */
function LeadsTable({ filterQs, onOpen }: { filterQs: string; onOpen: (id: number) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const { can } = useAuth();
  const staff = useStaff();
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-created_at");
  const [sel, setSel] = useState<number[]>([]);
  const sep = filterQs ? "&" : "?";
  const q = useQuery({ queryKey: ["leads", filterQs, page, ordering], queryFn: () => api<Paginated<Lead>>(`/admin/leads/${filterQs}${sep}page=${page}&page_size=50&ordering=${ordering}`) });
  useEffect(() => { setPage(1); setSel([]); }, [filterQs]);
  const all = useMemo(() => q.data?.results.map((l) => l.id) || [], [q.data]);
  const bulk = async (body: Record<string, unknown>) => {
    try {
      const r = await api<{ updated: number }>("/admin/leads/bulk/", { body: { ids: sel, ...body } });
      toast.success(`${r.updated} ✓`);
      setSel([]);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["board"] });
    } catch (e) { toast.error((e as Error).message); }
  };
  const sortBy = (f: string) => setOrdering(ordering === f ? `-${f}` : f);
  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const pages = Math.ceil((q.data?.count || 0) / 50);
  return (
    <div className="card overflow-hidden">
      {sel.length > 0 && can("crm.edit") && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-teal-50 px-4 py-2.5 text-sm">
          <b>{sel.length}</b> {t("admin.selected")}
          <Select className="h-8 w-auto text-xs" value="" onChange={(e) => e.target.value && bulk({ action: "move", stage: e.target.value })}>
            <option value="">{t("admin.moveTo")}</option>{Object.keys(STAGE_ACCENT).map((s) => <option key={s} value={s}>{t(`stage.${s}`)}</option>)}
          </Select>
          {can("crm.assign") && <Select className="h-8 w-auto text-xs" value="" onChange={(e) => e.target.value && bulk({ action: "assign", user: Number(e.target.value) })}>
            <option value="">{t("admin.assignTo")}</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>}
          <Select className="h-8 w-auto text-xs" value="" onChange={(e) => e.target.value && bulk({ action: "priority", priority: e.target.value })}>
            <option value="">{t("admin.setPriority")}</option>{["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
          </Select>
          {can("crm.delete") && <Button size="sm" variant="danger" onClick={() => confirm(t("admin.confirmDelete")) && bulk({ action: "delete" })}>{t("common.delete")}</Button>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-mist/70 text-left text-xs font-semibold text-ink-muted">
            <tr>
              <th className="w-10 p-3"><input type="checkbox" aria-label="Select all" checked={sel.length > 0 && sel.length === all.length} onChange={(e) => setSel(e.target.checked ? all : [])} className="accent-teal-500" /></th>
              <th className="cursor-pointer p-3" onClick={() => sortBy("full_name")}>{t("common.name")}</th>
              <th className="p-3">{t("admin.stage")}</th>
              <th className="cursor-pointer p-3" onClick={() => sortBy("priority")}>{t("admin.priority")}</th>
              <th className="p-3">{t("common.treatment")}</th>
              <th className="p-3">{t("common.country")}</th>
              <th className="p-3">{t("admin.manager")}</th>
              <th className="p-3">{t("admin.source")}</th>
              <th className="cursor-pointer p-3" onClick={() => sortBy("budget")}>{t("admin.budget")}</th>
              <th className="cursor-pointer p-3" onClick={() => sortBy("next_follow_up")}>{t("admin.followUp")}</th>
              <th className="cursor-pointer p-3" onClick={() => sortBy("created_at")}>{t("common.date")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {q.data?.results.map((l) => (
              <tr key={l.id} className="cursor-pointer hover:bg-mist/60" onClick={() => onOpen(l.id)}>
                <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${l.full_name}`} checked={sel.includes(l.id)} onChange={(e) => setSel(e.target.checked ? [...sel, l.id] : sel.filter((x) => x !== l.id))} className="accent-teal-500" /></td>
                <td className="p-3"><div className="font-semibold text-navy-900">{l.full_name}</div><div className="text-xs text-ink-muted">{l.phone}</div></td>
                <td className="p-3"><span className="inline-flex items-center gap-1.5 text-xs font-medium"><span className={cn("size-2 rounded-full", STAGE_ACCENT[l.stage])} />{t(`stage.${l.stage}`)}</span></td>
                <td className="p-3"><Badge tone={PRIORITY_TONE[l.priority]}>{t(`priority.${l.priority}`)}</Badge></td>
                <td className="max-w-40 truncate p-3 text-xs">{l.treatment_name || l.specialty_name || "—"}</td>
                <td className="p-3 text-xs">{l.destination_name || "—"}</td>
                <td className="p-3 text-xs">{l.assigned?.name || "—"}</td>
                <td className="p-3 text-xs">{l.source_name || "—"}</td>
                <td className="p-3 text-xs">{l.budget ? money(l.budget, l.budget_currency, locale) : "—"}</td>
                <td className={cn("p-3 text-xs", l.is_overdue && "font-semibold text-danger")}>{date(l.next_follow_up, locale)}</td>
                <td className="p-3 text-xs text-ink-muted">{date(l.created_at, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.data?.results.length && <p className="p-10 text-center text-sm text-ink-muted">{t("common.empty")}</p>}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
          <span className="text-ink-muted">{q.data?.count} {t("common.results")}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.back")}</Button>
            <span className="px-2 py-1">{page}/{pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("common.next")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
