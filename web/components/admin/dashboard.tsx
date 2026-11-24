"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock, CheckCircle2, ClipboardCheck, FileSearch, Handshake, HeartPulse, Inbox, ListTodo, MessagesSquare, PhoneCall,
  TrendingUp, UserX, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageTitle } from "@/components/portal/shell";
import { Card, ErrorBox, LoadingBlock, Stat } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, date, money, num } from "@/lib/utils";
import { BarChart, Funnel, HBarList } from "./charts";

type P = { label: string; value: number; key?: string };
type Activity = { action: string; summary: string; actor: string | null; object_type: string; object_id: string; created_at: string };
type D = {
  kpis: Record<string, number | null | string>;
  today: Record<string, number>;
  charts: { daily_leads: P[]; monthly_leads: P[]; country_distribution: P[]; treatment_distribution: P[]; source_distribution: P[]; funnel: P[];
    revenue: P[] | null; managers: { name: string; total: number; won: number; lost: number; rate: number }[]; hospitals: { name: string; referrals: number; quoted: number; accepted: number }[] };
  recent_activity: Activity[];
};

type Tr = ReturnType<typeof useTranslations>;

/** "lead.stage_changed" → "Lid · bosqichi o‘zgardi" (falls back to the raw code). */
export function auditLabel(t: Tr, action: string) {
  if (t.has(`auditAction.${action.replace(".", "_")}`)) return t(`auditAction.${action.replace(".", "_")}`);
  const [obj, verb] = action.split(".");
  const o = t.has(`auditObj.${obj}`) ? t(`auditObj.${obj}`) : obj;
  const v = verb && t.has(`auditVerb.${verb}`) ? t(`auditVerb.${verb}`) : verb;
  return v ? `${o} · ${v}` : o;
}

/** Where an audit entry's object lives in the admin panel. */
export function auditHref(type: string, id: string) {
  if (!id) return null;
  return ({ Lead: `/admin/crm?lead=${id}`, Patient: `/admin/patients/${id}`, MedicalCase: `/admin/cases/${id}` } as Record<string, string>)[type] || null;
}

function Today({ data }: { data: Record<string, number> }) {
  const t = useTranslations("dashboardUi");
  const tiles: [string, LucideIcon, string, "danger" | "warn" | "info"][] = [
    ["overdue", AlarmClock, "/admin/crm?overdue=1", "danger"],
    ["due_today", PhoneCall, "/admin/crm?due_today=1", "warn"],
    ["fresh_leads", Inbox, "/admin/crm?fresh=1", "info"],
    ["unassigned_leads", UserX, "/admin/crm?unassigned=1", "warn"],
    ["unread_chats", MessagesSquare, "/admin/chats", "danger"],
    ["unassigned_cases", HeartPulse, "/admin/cases?unassigned=1", "warn"],
    ["reviews", FileSearch, "/admin/cases?status=documents_review", "info"],
    ["my_tasks", ListTodo, "/admin/tasks", "info"],
    ["pending_partners", Handshake, "/admin/users?role=hospital_partner", "warn"],
  ];
  const shown = tiles.filter(([k]) => k in data);
  const pending = shown.filter(([k]) => data[k] > 0);
  const tone = { danger: "border-danger/30 bg-danger-soft/60 text-danger", warn: "border-amber-200 bg-amber-50 text-amber-700", info: "border-teal-200 bg-teal-50 text-teal-700" };
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">{t("todayTitle")}</h2>
        {!pending.length && <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="size-4" />{t("allClear")}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {shown.map(([k, Icon, href, kind]) => {
          const n = data[k];
          return (
            <Link key={k} href={href} className={cn("group flex items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-card",
              n > 0 ? tone[kind] : "border-line bg-white text-ink-muted")}>
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", n > 0 ? "bg-white/70" : "bg-mist")}><Icon className="size-5" /></span>
              <span className="min-w-0">
                <span className={cn("block font-display text-2xl font-extrabold leading-none", n > 0 ? "" : "text-ink-muted/70")}>{n}</span>
                <span className="mt-1 block truncate text-xs font-semibold">{t(`today.${k}`)}</span>
                {k === "my_tasks" && data.my_tasks_overdue > 0 && <span className="block text-[11px] text-danger">{t("tasksOverdue", { n: data.my_tasks_overdue })}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function AdminDashboard({ mode = "dashboard" }: { mode?: "dashboard" | "reports" }) {
  const root = useTranslations();
  const t = useTranslations("admin");
  const du = useTranslations("dashboardUi");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => api<D>("/admin/dashboard/?days=30"), refetchInterval: 60_000 });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorBox message={(q.error as Error)?.message || tc("error")} onRetry={() => q.refetch()} />;
  const { kpis: k, charts: c } = q.data;
  const n = (v: unknown) => num(Number(v ?? 0), locale);
  const nd = t("noData");
  const funnel = c.funnel.map((f) => ({ ...f, label: f.key && root.has(`stage.${f.key}`) ? root(`stage.${f.key}`) : f.label }));
  const sources = c.source_distribution.map((s) => ({ ...s, label: s.key && root.has(`leadSource.${s.key}`) ? root(`leadSource.${s.key}`) : s.label }));
  const hour = new Date().getHours();
  const hello = du(hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening", { name: user?.first_name || user?.full_name || "" });
  return (
    <>
      <PageTitle title={mode === "reports" ? t("reports") : hello} subtitle={date(new Date().toISOString(), locale)} />
      {mode === "dashboard" && q.data.today && <Today data={q.data.today} />}
      {mode === "dashboard" && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<Users className="size-5" />} label={t("kpi.patients")} value={n(k.total_patients)} hint={`${t("kpi.leads")}: ${n(k.total_leads)}`} />
          <Stat icon={<HeartPulse className="size-5" />} label={t("kpi.activeCases")} value={n(k.active_cases)} tone="navy" hint={`${t("kpi.inTreatment")}: ${n(k.patients_in_treatment)}`} />
          <Stat icon={<TrendingUp className="size-5" />} label={t("kpi.conversion")} value={k.conversion_rate === null ? "—" : `${k.conversion_rate}%`} tone="sand"
            hint={`${t("kpi.confirmed")}: ${n(k.confirmed_treatments)} · ${t("kpi.cancelled")}: ${n(k.cancelled_leads)}`} />
          {"total_revenue" in k
            ? <Stat icon={<Wallet className="size-5" />} label={t("kpi.revenue")} value={money(k.total_revenue as string, "USD", locale)} hint={`${t("kpi.outstanding")}: ${money(k.outstanding_payments as string, "USD", locale)}`} />
            : <Stat icon={<ClipboardCheck className="size-5" />} label={t("kpi.completed")} value={n(k.completed_cases)} />}
        </div>
      )}
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2"><h3 className="mb-4 font-display font-bold">{t("chart.daily")}</h3><BarChart data={c.daily_leads} empty={nd} /></Card>
        <Card><h3 className="mb-4 font-display font-bold">{t("chart.funnel")}</h3><Funnel data={funnel} empty={nd} /></Card>
        <Card><h3 className="mb-4 font-display font-bold">{t("chart.country")}</h3><HBarList data={c.country_distribution} empty={nd} /></Card>
        <Card><h3 className="mb-4 font-display font-bold">{t("chart.treatment")}</h3><HBarList data={c.treatment_distribution} empty={nd} /></Card>
        <Card><h3 className="mb-4 font-display font-bold">{t("chart.sources")}</h3><HBarList data={sources} empty={nd} /></Card>
        {mode === "reports" && <Card className="xl:col-span-3"><h3 className="mb-4 font-display font-bold">{t("chart.monthly")}</h3><BarChart data={c.monthly_leads} empty={nd} /></Card>}
        {c.revenue && <Card className="xl:col-span-3"><h3 className="mb-4 font-display font-bold">{t("chart.revenue")}</h3><BarChart data={c.revenue} empty={nd} format={(v) => money(v, "USD", locale)} /></Card>}
        <Card className="xl:col-span-2">
          <h3 className="mb-4 font-display font-bold">{t("chart.managers")}</h3>
          {c.managers.length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-ink-muted"><th className="pb-2">{t("manager")}</th><th className="pb-2 text-right">{t("leads")}</th><th className="pb-2 text-right">{t("won")}</th><th className="pb-2 text-right">{t("lost")}</th><th className="pb-2 text-right">{t("kpi.conversion")}</th></tr></thead>
              <tbody className="divide-y divide-line">{c.managers.map((m) => <tr key={m.name}><td className="py-2 font-medium">{m.name}</td><td className="py-2 text-right">{m.total}</td><td className="py-2 text-right text-success">{m.won}</td><td className="py-2 text-right text-danger">{m.lost}</td><td className="py-2 text-right font-semibold">{m.rate}%</td></tr>)}</tbody>
            </table>
          ) : <p className="text-sm text-ink-muted">{nd}</p>}
        </Card>
        <Card>
          <h3 className="mb-4 font-display font-bold">{t("chart.hospitals")}</h3>
          {c.hospitals.length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-ink-muted"><th className="pb-2">{tc("hospital")}</th><th className="pb-2 text-right">{t("referrals")}</th><th className="pb-2 text-right">{t("quoted")}</th><th className="pb-2 text-right">{t("accepted")}</th></tr></thead>
              <tbody className="divide-y divide-line">{c.hospitals.map((h) => <tr key={h.name}><td className="py-2 font-medium">{h.name}</td><td className="py-2 text-right">{h.referrals}</td><td className="py-2 text-right">{h.quoted}</td><td className="py-2 text-right">{h.accepted}</td></tr>)}</tbody>
            </table>
          ) : <p className="text-sm text-ink-muted">{nd}</p>}
        </Card>
        {mode === "dashboard" && q.data.recent_activity.length > 0 && (
          <Card className="xl:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-bold">{t("recent")}</h3>
              <Link href="/admin/audit" className="text-xs font-semibold text-teal-700 hover:underline">{tc("viewAll")} →</Link>
            </div>
            <ul className="divide-y divide-line text-sm">{q.data.recent_activity.map((a, i) => {
              const href = auditHref(a.object_type, a.object_id);
              const label = auditLabel(root, a.action);
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  {href ? <Link href={href} className="font-semibold text-navy-900 hover:text-teal-700">{label}</Link> : <span className="font-semibold text-navy-900">{label}</span>}
                  {a.summary && <span className="max-w-md truncate text-ink-soft">{a.summary}</span>}
                  <span className="ml-auto text-xs text-ink-muted">{a.actor || root("adminUi.system")} · {date(a.created_at, locale, true)}</span>
                </li>
              );
            })}</ul>
          </Card>
        )}
      </div>
    </>
  );
}
