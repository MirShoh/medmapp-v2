"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, ExternalLink, Globe, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/site/logo";
import { Button, LoadingBlock, Modal } from "@/components/ui";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { api, type Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, date, initials } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: string; exact?: boolean; badge?: number };
/** `collapsed`: folded by default (opens automatically when it holds the current page); state is remembered per browser. */
export type NavGroup = { id?: string; label?: string; collapsed?: boolean; items: NavItem[] };

export function PortalShell({ portal, groups, children, title }: { portal: "admin" | "dashboard" | "partner"; groups: NavGroup[]; children: ReactNode; title: string }) {
  const t = useTranslations();
  const { user, loading, logout, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [askLogout, setAskLogout] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setFolded(JSON.parse(localStorage.getItem(`mm-nav-${portal}`) || "{}")); } catch { /* private mode */ }
  }, [portal]);
  const toggleGroup = (id: string, now: boolean) => {
    const next = { ...folded, [id]: !now };
    setFolded(next);
    try { localStorage.setItem(`mm-nav-${portal}`, JSON.stringify(next)); } catch { /* private mode */ }
  };

  useEffect(() => {
    if (loading) return;
    if (leaving) return; // signing out on purpose: go home, not to the login page
    if (!user) router.replace(`/${portal === "dashboard" ? "login" : `${portal}/login`}?next=${encodeURIComponent(pathname)}`);
    else if (user.portal !== portal) router.replace(`/${user.portal}`);
  }, [loading, user, portal, router, pathname, leaving]);
  useEffect(() => setOpen(false), [pathname]);

  if (loading || !user || user.portal !== portal) return <div className="grid min-h-screen place-items-center"><LoadingBlock /></div>;

  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(i.perm)) })).filter((g) => g.items.length);
  const isActive = (i: NavItem) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href={`/${portal}`}><Logo light /></Link>
        <button className="text-white/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Close"><X className="size-5" /></button>
      </div>
      <div className="px-5 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300/80">{title}</div>
      <nav className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-3 pb-6">
        {visible.map((g, gi) => {
          const id = g.id || String(gi);
          const holdsActive = g.items.some(isActive);
          const isFolded = !holdsActive && (folded[id] ?? !!g.collapsed);
          return (
            <div key={id}>
              {g.label && (
                <button type="button" onClick={() => toggleGroup(id, isFolded)} aria-expanded={!isFolded}
                  className="flex w-full items-center justify-between rounded-lg px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 transition hover:text-white/70">
                  {g.label}<ChevronDown className={cn("size-3.5 transition", isFolded && "-rotate-90")} />
                </button>
              )}
              {!isFolded && (
                <ul className="space-y-0.5">
                  {g.items.map((i) => (
                    <li key={i.href}>
                      <Link href={i.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition",
                        isActive(i) ? "bg-white/10 text-white shadow-[inset_2px_0_0_var(--color-teal-400)]" : "text-white/60 hover:bg-white/5 hover:text-white")}>
                        <i.icon className={cn("size-4", isActive(i) ? "text-teal-300" : "")} /><span className="flex-1">{i.label}</span>
                        {!!i.badge && <span className="grid min-w-5 place-items-center rounded-full bg-teal-500 px-1.5 text-[10px] font-bold text-white">{i.badge > 99 ? "99+" : i.badge}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/50 hover:text-white"><ExternalLink className="size-3.5" />medmapp.uz</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-mist">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-navy-950 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-navy-950">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur sm:px-6">
          <button className="grid size-9 place-items-center rounded-lg lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="size-5" /></button>
          <div className="ml-auto flex items-center gap-1.5">
            <LangSwitch />
            <NotificationsBell portal={portal} />
            <div className="ml-2 flex items-center gap-3 border-l border-line pl-3">
              <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-white">{initials(user.full_name)}</div>
              <div className="hidden leading-tight sm:block">
                <div className="text-sm font-semibold text-navy-900">{user.full_name}</div>
                <div className="text-[11px] text-ink-muted">{user.hospital?.name || (t.has(`roles.${user.role}`) ? t(`roles.${user.role}`) : user.role_label)}</div>
              </div>
              <button onClick={() => setAskLogout(true)} className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-mist hover:text-danger" aria-label={t("auth.signOut")} title={t("auth.signOut")}>
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <Modal open={askLogout} onClose={() => setAskLogout(false)} title={t("auth.signOutAsk")}>
        <p className="text-sm text-ink-soft">{t("auth.signOutText")}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setAskLogout(false)}>{t("common.cancel")}</Button>
          <Button variant="danger" loading={leaving} onClick={async () => { setLeaving(true); router.replace("/"); await logout(); }}>
            <LogOut className="size-4" />{t("auth.signOut")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function LangSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex items-center rounded-lg border border-line bg-white p-0.5 text-xs font-semibold">
      <Globe className="mx-1.5 size-3.5 text-ink-muted" />
      {(["uz", "ru", "en"] as const).map((l) => (
        <button key={l} onClick={() => router.replace(pathname, { locale: l })}
          className={cn("rounded-md px-2 py-1 uppercase", l === locale ? "bg-navy-900 text-white" : "text-ink-muted hover:text-navy-900")}>{l}</button>
      ))}
    </div>
  );
}

type Notif = { id: number; type: string; title: string; body: string; link: string; read_at: string | null; created_at: string };

function NotificationsBell({ portal }: { portal: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: count } = useQuery({ queryKey: ["notif-count"], queryFn: () => api<{ count: number }>("/notifications/unread_count/"), refetchInterval: 60_000 });
  const { data } = useQuery({ queryKey: ["notif-list"], queryFn: () => api<Paginated<Notif>>("/notifications/?page_size=8"), enabled: open });
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const go = async (n: Notif) => {
    await api(`/notifications/${n.id}/read/`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["notif-count"] });
    qc.invalidateQueries({ queryKey: ["notif-list"] });
    setOpen(false);
    if (n.link) router.push(n.link.replace(/^\/(uz|ru|en)(?=\/)/, ""));
  };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-mist" aria-label={t("dash.notifications")}>
        <Bell className="size-[18px]" />
        {!!count?.count && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{count.count > 99 ? "99+" : count.count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-display text-sm font-bold">{t("dash.notifications")}</span>
            <button className="text-xs font-semibold text-teal-700" onClick={async () => { await api("/notifications/read_all/", { method: "POST" }); qc.invalidateQueries({ queryKey: ["notif-count"] }); qc.invalidateQueries({ queryKey: ["notif-list"] }); }}>{t("dash.markAllRead")}</button>
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {data?.results.length ? data.results.map((n) => (
              <li key={n.id}>
                <button onClick={() => go(n)} className={cn("block w-full px-4 py-3 text-left hover:bg-mist", !n.read_at && "bg-teal-50/50")}>
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal-500" />}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-navy-900">{n.title}</div>
                      {n.body && <div className="line-clamp-2 text-xs text-ink-muted">{n.body}</div>}
                      <div className="mt-1 text-[11px] text-ink-muted">{date(n.created_at, locale, true)}</div>
                    </div>
                  </div>
                </button>
              </li>
            )) : <li className="px-4 py-8 text-center text-sm text-ink-muted">{t("common.empty")}</li>}
          </ul>
          <Link href={`/${portal}/notifications`} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-teal-700">{t("common.viewAll")}</Link>
        </div>
      )}
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
