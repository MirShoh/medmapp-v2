"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, AlarmClock, Bell, BellOff, Building2, CheckCheck, FileText, ListTodo, MessagesSquare, Receipt, UserPlus, Wallet,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, LoadingBlock } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { api, type Paginated } from "@/lib/api";
import { cn, date } from "@/lib/utils";

/** Badge numbers for the header bell and the side menu (GET /me/counters/; keys depend on the role). */
export type Counters = Record<string, number>;

export function useCounters(enabled = true): Counters {
  return useQuery({
    queryKey: ["counters"], queryFn: () => api<Counters>("/me/counters/"), enabled,
    refetchInterval: 20_000, refetchOnWindowFocus: true, staleTime: 5_000,
  }).data || {};
}

/** Red counter bubble; hidden at 0. */
export function CountBadge({ n, className }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

type Notif = { id: number; type: string; title: string; body: string; link: string; read_at: string | null; created_at: string };

const TYPE_ICON: Record<string, [LucideIcon, string]> = {
  new_lead: [UserPlus, "bg-teal-50 text-teal-600"], new_task: [ListTodo, "bg-navy-900/5 text-navy-800"],
  new_document: [FileText, "bg-sky-50 text-sky-600"], status_change: [Activity, "bg-violet-50 text-violet-600"],
  follow_up: [AlarmClock, "bg-amber-50 text-amber-600"], hospital_response: [Building2, "bg-teal-50 text-teal-700"],
  new_quotation: [Receipt, "bg-emerald-50 text-emerald-600"], payment_update: [Wallet, "bg-emerald-50 text-emerald-700"],
  chat: [MessagesSquare, "bg-rose-50 text-rose-600"], system: [Bell, "bg-mist text-ink-soft"],
};
const typeIcon = (type: string) => TYPE_ICON[type] || TYPE_ICON.system;
const localLink = (link: string) => link.replace(/^\/(uz|ru|en)(?=\/)/, "");

function useMarkRead() {
  const qc = useQueryClient();
  return async (n?: Notif) => {
    await api(n ? `/notifications/${n.id}/read/` : "/notifications/read_all/", { method: "POST" });
    for (const k of ["counters", "notif-list", "notifications-page"]) qc.invalidateQueries({ queryKey: [k] });
  };
}

/**
 * Header bell: red count, dropdown with the latest items, a toast when something new arrives,
 * and the unread count in the browser tab title.
 */
export function NotificationsBell({ portal, count }: { portal: string; count: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const markRead = useMarkRead();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<number | null>(null);
  const { data } = useQuery({ queryKey: ["notif-list"], queryFn: () => api<Paginated<Notif>>("/notifications/?page_size=8"), enabled: open });

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // pop up new notifications and keep the tab title in sync
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = count ? `(${count > 99 ? "99+" : count}) ${base}` : base;
    if (prev.current !== null && count > prev.current) {
      api<Paginated<Notif>>("/notifications/?unread=1&page_size=1").then((r) => {
        const n = r.results[0];
        if (!n) return;
        toast(n.title, {
          description: n.body || undefined, icon: <Bell className="size-4 text-teal-600" />,
          action: n.link ? { label: t("notifUi.open"), onClick: () => { void markRead(n); router.push(localLink(n.link)); } } : undefined,
        });
      }).catch(() => undefined);
    }
    prev.current = count;
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (n: Notif) => {
    await markRead(n);
    setOpen(false);
    if (n.link) router.push(localLink(n.link));
  };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-mist" aria-label={t("dash.notifications")}>
        <Bell className={cn("size-[18px]", count > 0 && "text-navy-900")} />
        <CountBadge n={count} className="absolute -right-1 -top-1" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-display text-sm font-bold">{t("dash.notifications")}{count > 0 && <span className="ml-1.5 text-danger">({count})</span>}</span>
            {count > 0 && <button className="text-xs font-semibold text-teal-700" onClick={() => markRead()}>{t("dash.markAllRead")}</button>}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {data?.results.length ? data.results.map((n) => <Row key={n.id} n={n} locale={locale} onClick={() => go(n)} compact />)
              : <li className="px-4 py-8 text-center text-sm text-ink-muted">{t("common.empty")}</li>}
          </ul>
          <Link href={`/${portal}/notifications`} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-teal-700">{t("common.viewAll")}</Link>
        </div>
      )}
    </div>
  );
}

function Row({ n, locale, onClick, compact }: { n: Notif; locale: string; onClick: () => void; compact?: boolean }) {
  const [Icon, tone] = typeIcon(n.type);
  return (
    <li>
      <button onClick={onClick} className={cn("flex w-full items-start gap-3 text-left transition hover:bg-mist/60", compact ? "px-4 py-3" : "px-5 py-4", !n.read_at && "bg-teal-50/40")}>
        <span className={cn("grid shrink-0 place-items-center rounded-xl", compact ? "size-9" : "size-10", tone)}><Icon className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm text-navy-900", !n.read_at ? "font-bold" : "font-medium")}>{n.title}</span>
          {n.body && <span className={cn("block text-xs text-ink-soft", compact ? "line-clamp-1" : "line-clamp-2")}>{n.body}</span>}
          <span className="mt-1 block text-[11px] text-ink-muted">{date(n.created_at, locale, true)}</span>
        </span>
        {!n.read_at && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-danger" />}
      </button>
    </li>
  );
}

/** Full notifications page (all portals): All / Unread, grouped by day, click opens the related page. */
export function NotificationCenter() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const markRead = useMarkRead();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const q = useQuery({ queryKey: ["notifications-page", tab], queryFn: () => api<Paginated<Notif>>(`/notifications/?page_size=100${tab === "unread" ? "&unread=1" : ""}`) });
  const unread = useCounters().notifications || 0;
  const items = q.data?.results || [];
  const dayKey = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yday = new Date(Date.now() - 86_400_000);
    if (d.toDateString() === today.toDateString()) return t("notifUi.today");
    if (d.toDateString() === yday.toDateString()) return t("notifUi.yesterday");
    return date(iso, locale);
  };
  const groups: [string, Notif[]][] = [];
  for (const n of items) {
    const k = dayKey(n.created_at);
    const g = groups.find(([key]) => key === k);
    if (g) g[1].push(n); else groups.push([k, [n]]);
  }
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-[28px]">{t("dash.notifications")}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t("notifUi.subtitle")}</p>
        </div>
        {unread > 0 && <Button variant="outline" onClick={() => markRead()}><CheckCheck className="size-4" />{t("dash.markAllRead")}</Button>}
      </div>
      <div className="mb-4 inline-flex rounded-2xl border border-line bg-white p-1">
        {(["all", "unread"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-semibold transition", tab === k ? "bg-navy-900 text-white" : "text-ink-soft hover:text-navy-900")}>
            {t(`notifUi.${k}`)}{k === "unread" && <CountBadge n={unread} className="ring-0" />}
          </button>
        ))}
      </div>
      {q.isLoading ? <LoadingBlock /> : !items.length ? (
        <div className="card grid place-items-center p-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-mist text-ink-muted"><BellOff className="size-6" /></span>
          <p className="mt-3 font-semibold text-navy-900">{t(tab === "unread" ? "notifUi.allRead" : "notifUi.none")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("notifUi.noneText")}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">{day}</h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {list.map((n) => <Row key={n.id} n={n} locale={locale} onClick={async () => { await markRead(n); if (n.link) router.push(localLink(n.link)); }} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
