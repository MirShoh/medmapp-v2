"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Globe, LayoutDashboard, Menu, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ConsultButton } from "./hero-actions";
import { LiveSearch } from "./live-search";
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
  // Ctrl+K / Cmd+K or "/" opens search from anywhere (except while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
      <LiveSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
