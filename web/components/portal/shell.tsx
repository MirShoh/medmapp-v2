"use client";

import { Bell, Building2, ChevronDown, ExternalLink, Globe, Inbox, LayoutDashboard, LogOut, Menu, MessagesSquare, UserRound, X, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/site/logo";
import { Button, LoadingBlock, Modal } from "@/components/ui";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { cn, initials } from "@/lib/utils";
import { CountBadge, NotificationsBell, useCounters } from "./notifications";

/** `counter`: key in GET /me/counters/ shown as a red badge (e.g. "chats", "referrals"). */
export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: string; exact?: boolean; badge?: number; counter?: string };
/** `collapsed`: folded by default (opens automatically when it holds the current page); state is remembered per browser. */
export type NavGroup = { id?: string; label?: string; collapsed?: boolean; items: NavItem[] };

export function PortalShell({ portal, groups, children, title }: { portal: "admin" | "dashboard" | "partner"; groups: NavGroup[]; children: ReactNode; title: string }) {
  const t = useTranslations();
  const { user, loading, logout, can } = useAuth();
  const counters = useCounters(!!user && user.portal === portal);
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
  // total of the menu badges, shown on the mobile menu button
  const menuTotal = visible.flatMap((g) => g.items).reduce((sum, i) => sum + (i.counter && i.counter !== "notifications" ? counters[i.counter] || 0 : 0), 0);
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
                        <CountBadge n={i.badge ?? (i.counter ? counters[i.counter] : 0)} className="ring-navy-950" />
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
          <button className="relative grid size-9 place-items-center rounded-lg lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="size-5" /><CountBadge n={menuTotal} className="absolute -right-1 -top-1" /></button>
          <div className="ml-auto flex items-center gap-1.5">
            <LangSwitch />
            <NotificationsBell portal={portal} count={counters.notifications || 0} />
            <UserMenu portal={portal} counters={counters} onLogout={() => setAskLogout(true)} />
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

/** Avatar button in the header: who is signed in, shortcuts for this portal, language, sign out. */
function UserMenu({ portal, counters, onLogout }: { portal: "admin" | "dashboard" | "partner"; counters: Record<string, number>; onLogout: () => void }) {
  const t = useTranslations();
  const { user, can } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  if (!user) return null;
  const role = user.hospital?.name || (t.has(`roles.${user.role}`) ? t(`roles.${user.role}`) : user.role_label);
  const links: [string, LucideIcon, string, number?][] = portal === "dashboard"
    ? [["/dashboard/profile", UserRound, t("dash.profile")], ["/dashboard/support", MessagesSquare, t("chat.nav"), counters.chat], ["/dashboard/notifications", Bell, t("dash.notifications"), counters.notifications]]
    : portal === "partner"
      ? [["/partner/profile", Building2, t("partner.profile")], ["/partner/referrals", Inbox, t("partner.referrals"), counters.referrals], ["/partner/notifications", Bell, t("dash.notifications"), counters.notifications]]
      : [...(can("dashboard.view") ? [["/admin", LayoutDashboard, t("admin.dashboard")] as [string, LucideIcon, string]] : []),
        ["/admin/notifications", Bell, t("dash.notifications"), counters.notifications]];
  return (
    <div ref={ref} className="relative ml-1 border-l border-line pl-2 sm:ml-2 sm:pl-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu"
        className={cn("flex items-center gap-2.5 rounded-xl p-1 pr-1.5 transition hover:bg-mist", open && "bg-mist")}>
        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-white">{initials(user.full_name)}</span>
        <span className="hidden max-w-44 text-left leading-tight md:block">
          <span className="block truncate text-sm font-semibold text-navy-900">{user.full_name}</span>
          <span className="block truncate text-[11px] text-ink-muted">{role}</span>
        </span>
        <ChevronDown className={cn("hidden size-4 text-ink-muted transition sm:block", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
          <div className="flex items-center gap-3 border-b border-line bg-mist/50 px-4 py-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white">{initials(user.full_name)}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-navy-900">{user.full_name}</span>
              <span className="block truncate text-xs text-ink-muted">{user.email || user.phone}</span>
              <span className="mt-0.5 inline-block rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">{role}</span>
            </span>
          </div>
          <div className="p-1.5">
            {links.map(([href, Icon, label, n]) => (
              <Link key={href} href={href} role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-navy-900 hover:bg-mist">
                <Icon className="size-4 text-ink-muted" /><span className="flex-1">{label}</span><CountBadge n={n} className="ring-0" />
              </Link>
            ))}
            <Link href="/" role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-navy-900 hover:bg-mist">
              <ExternalLink className="size-4 text-ink-muted" /><span className="flex-1">{t("userMenu.site")}</span>
            </Link>
          </div>
          <div className="border-t border-line p-1.5">
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onLogout(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft">
              <LogOut className="size-4" />{t("auth.signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LangSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex items-center rounded-lg border border-line bg-white p-0.5 text-xs font-semibold">
      <Globe className="mx-1.5 hidden size-3.5 text-ink-muted sm:block" />
      {(["uz", "ru", "en"] as const).map((l) => (
        <button key={l} onClick={() => router.replace(pathname, { locale: l })}
          className={cn("rounded-md px-2 py-1 uppercase", l === locale ? "bg-navy-900 text-white" : "text-ink-muted hover:text-navy-900")}>{l}</button>
      ))}
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
