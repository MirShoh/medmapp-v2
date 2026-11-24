"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Globe, LayoutDashboard, Menu, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ConsultButton } from "./hero-actions";
import { Logo } from "./logo";

// Main menu: every section on one line (no "More" dropdown).
const NAV = [
  { href: "/treatments", key: "treatments" },
  { href: "/destinations", key: "destinations" },
  { href: "/hospitals", key: "hospitals" },
  { href: "/doctors", key: "doctors" },
  { href: "/how-it-works", key: "how" },
  { href: "/about", key: "about" },
] as const;
const LOCALES = [{ code: "uz", label: "O‘zbekcha" }, { code: "ru", label: "Русский" }, { code: "en", label: "English" }] as const;

export function Header({ transparent }: { transparent?: boolean }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setMobile(false), [pathname]);

  const dark = transparent && !scrolled && !mobile;
  const portalHref = user ? `/${user.portal}` : "/login";

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-all duration-300",
      dark ? "bg-transparent" : "border-b border-line/80 bg-white/85 backdrop-blur-xl")}>
      <div className="container-x flex h-16 items-center gap-4 lg:h-[72px]">
        <Link href="/" aria-label="MedMapp"><Logo light={dark} /></Link>
        <nav className="ml-6 hidden items-center gap-0.5 xl:flex 2xl:ml-8 2xl:gap-1" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={cn("whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition 2xl:px-3",
                dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink-soft hover:bg-navy-900/5 hover:text-navy-900",
                pathname.startsWith(n.href) && (dark ? "text-white" : "text-navy-900"))}>
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1 xl:gap-1.5">
          <button onClick={() => setSearchOpen(true)} aria-label={t("search")}
            className={cn("grid size-10 place-items-center rounded-xl transition", dark ? "text-white hover:bg-white/10" : "text-ink-soft hover:bg-navy-900/5")}>
            <Search className="size-[18px]" />
          </button>
          <div className="group relative">
            <button className={cn("flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold uppercase transition",
              dark ? "text-white hover:bg-white/10" : "text-ink-soft hover:bg-navy-900/5")} aria-label="Language">
              <Globe className="size-4" /> {locale}
            </button>
            <div className="invisible absolute right-0 top-full z-10 w-40 rounded-xl border border-line bg-white p-1.5 opacity-0 shadow-lift transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              {LOCALES.map((l) => (
                <button key={l.code} onClick={() => router.replace(pathname, { locale: l.code })}
                  className={cn("block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-mist", l.code === locale ? "font-semibold text-teal-700" : "text-ink-soft")}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <Link href={portalHref} aria-label={user ? t("myAccount") : t("login")} className={cn("hidden h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition md:flex",
            dark ? "text-white hover:bg-white/10" : "text-navy-900 hover:bg-navy-900/5")}>
            <LayoutDashboard className="size-4" /> <span className="xl:hidden 2xl:inline">{user ? t("myAccount") : t("login")}</span>
          </Link>
          <ConsultButton className="hidden sm:inline-flex" />
          <button onClick={() => setMobile((v) => !v)} aria-label={t("menu")}
            className={cn("grid size-10 place-items-center rounded-xl xl:hidden", dark ? "text-white" : "text-navy-900")}>
            {mobile ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobile && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-white xl:hidden">
            <div className="container-x grid gap-1 py-4 sm:grid-cols-2">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-navy-900 hover:bg-mist">{t(n.key)}</Link>
              ))}
              <Link href={portalHref} className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-teal-700">{user ? t("myAccount") : t("login")}</Link>
              <ConsultButton size="lg" className="mt-2 sm:col-span-2" source="header-mobile" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

type SearchResult = {
  treatments: { name: string; slug: string }[];
  hospitals: { name: string; slug: string; city: string }[];
  doctors: { name: string; slug: string; specialty: string }[];
  destinations: { name: string; slug: string; flag: string }[];
};

function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRes(null);
      return;
    }
    const id = setTimeout(() => {
      api<SearchResult>(`/public/search/?q=${encodeURIComponent(q.trim())}`, { auth: false }).then(setRes).catch(() => setRes(null));
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  const groups: { label: string; items: { href: string; title: string; sub?: string }[] }[] = res ? [
    { label: t("nav.treatments"), items: res.treatments.map((x) => ({ href: `/treatments/${x.slug}`, title: x.name })) },
    { label: t("nav.hospitals"), items: res.hospitals.map((x) => ({ href: `/hospitals/${x.slug}`, title: x.name, sub: x.city })) },
    { label: t("nav.doctors"), items: res.doctors.map((x) => ({ href: `/doctors/${x.slug}`, title: x.name, sub: x.specialty })) },
    { label: t("nav.destinations"), items: res.destinations.map((x) => ({ href: `/destinations/${x.slug}`, title: `${x.flag} ${x.name}` })) },
  ].filter((g) => g.items.length) : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] bg-navy-950/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}
            className="mx-auto mt-[10vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl bg-white shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-5 text-ink-muted" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("nav.search")}
                className="h-14 flex-1 bg-transparent text-[15px] text-navy-900 outline-none placeholder:text-ink-muted" />
              <kbd className="rounded-md border border-line px-1.5 text-[11px] text-ink-muted">Esc</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {groups.map((g) => (
                <div key={g.label} className="mb-2">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.label}</div>
                  {g.items.map((it) => (
                    <Link key={it.href} href={it.href} onClick={onClose} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-mist">
                      <span className="text-sm font-medium text-navy-900">{it.title}</span>
                      {it.sub && <span className="text-xs text-ink-muted">{it.sub}</span>}
                    </Link>
                  ))}
                </div>
              ))}
              {res && !groups.length && <p className="px-3 py-6 text-center text-sm text-ink-muted">{t("list.noResults")}</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
