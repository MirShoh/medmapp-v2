import { ArrowRight, Building2, Compass, Globe2, Home, MessageCircle, Stethoscope } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/styles";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });
  const links = [
    { href: "/hospitals", icon: Building2, title: t("nav.hospitals"), text: t("nf.hospitals") },
    { href: "/treatments", icon: Stethoscope, title: t("nav.treatments"), text: t("nf.treatments") },
    { href: "/destinations", icon: Globe2, title: t("nav.destinations"), text: t("nf.destinations") },
    { href: "/contact", icon: MessageCircle, title: t("nav.consult"), text: t("nf.contact") },
  ];
  return (
    <>
      <section className="bg-hero relative overflow-hidden pb-24 pt-32 text-white lg:pt-40">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="container-x relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-green-300">
              <Compass className="size-3.5" /> {t("nf.badge")}
            </div>
            <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl">{t("nf.title")}</h1>
            <p className="mt-4 max-w-xl text-lg text-white/75">{t("nf.text")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/" className={buttonClass("primary", "lg")}><Home className="size-4" />{t("nf.home")}</Link>
              <Link href="/about#contact" className={buttonClass("light", "lg")}><MessageCircle className="size-4" />{t("nf.ask")}</Link>
            </div>
          </div>
          <div className="relative mx-auto hidden w-full max-w-sm lg:block" aria-hidden>
            <div className="absolute -inset-10 rounded-full bg-teal-500/20 blur-3xl" />
            <svg viewBox="0 0 320 240" className="relative w-full">
              <path d="M30 190 C 90 60, 200 230, 290 70" fill="none" stroke="#5FA8F5" strokeWidth="3" strokeDasharray="6 9" className="route-line" />
              <circle cx="30" cy="190" r="9" fill="#0FB861" stroke="#fff" strokeWidth="3" />
              <g transform="translate(290 70)">
                <circle r="34" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                <text textAnchor="middle" dy="12" fontSize="34" fontWeight="800" fill="#fff" fontFamily="inherit">?</text>
              </g>
              <text x="40" y="120" fontSize="64" fontWeight="800" fill="rgba(255,255,255,0.12)" fontFamily="inherit">404</text>
            </svg>
          </div>
        </div>
      </section>
      <section className="relative z-10 -mt-12 pb-20">
        <div className="container-x">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {links.map(({ href, icon: I, title, text }) => (
              <Link key={href} href={href} className="group rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-lift">
                <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-600 transition group-hover:bg-teal-500 group-hover:text-white"><I className="size-5" /></span>
                <div className="mt-4 flex items-center gap-1 font-display font-bold text-navy-900">{title}<ArrowRight className="size-4 transition group-hover:translate-x-1" /></div>
                <p className="mt-1 text-sm text-ink-soft">{text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
