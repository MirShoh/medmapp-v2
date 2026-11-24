import { Mail, MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { serverGet } from "@/lib/server";
import { Logo } from "./logo";
import { SocialLinks } from "./socials";

type Site = { settings: { phone: string; email: string; address: string; socials: Record<string, string> } };

export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });
  const site = await serverGet<Site>("/public/site/", locale, 300);
  const s = site?.settings;
  const cols = [
    { title: t("footer.patients"), links: [["/treatments", t("nav.treatments")], ["/hospitals", t("nav.hospitals")], ["/doctors", t("nav.doctors")], ["/packages", t("nav.packages")], ["/tools", t("nav.tools")]] },
    { title: t("nav.destinations"), links: [["/destinations", t("list.destinationsTitle")], ["/p/uzbekistan-gateway", t("footer.gatewayUz")], ["/p/central-asia-gateway", t("footer.gatewayCa")], ["/p/international-gateway", t("footer.gatewayIntl")]] },
    { title: t("footer.company"), links: [["/about", t("nav.about")], ["/how-it-works", t("nav.how")], ["/track", t("so.track")], ["/blog", t("nav.blog")], ["/about#contact", t("nav.contact")]] },
    { title: t("footer.partners"), links: [["/partner/login", t("auth.partnerLogin")], ["/partner/register", t("auth.partnerRegister")]] /* staff sign-in is not linked publicly */ },
  ];
  return (
    <footer className="relative overflow-hidden bg-navy-950 text-white/70">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="container-x relative grid gap-10 py-16 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">{t("footer.tagline")}</p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {s?.phone && <li className="flex items-center gap-2"><Phone className="size-4 text-teal-400" /><a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="hover:text-white">{s.phone}</a></li>}
            {s?.email && <li className="flex items-center gap-2"><Mail className="size-4 text-teal-400" /><a href={`mailto:${s.email}`} className="hover:text-white">{s.email}</a></li>}
            {s?.address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 text-teal-400" />{s.address}</li>}
          </ul>
          <SocialLinks socials={s?.socials} className="mt-5" itemClass="bg-white/5 text-white/80 ring-1 ring-white/10 hover:bg-teal-500 hover:text-white" />
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="font-display text-sm font-bold text-white">{c.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([href, label]) => (
                <li key={href}><Link href={href} className="transition hover:text-teal-300">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="relative border-t border-white/10">
        <div className="container-x flex flex-col gap-3 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MedMapp. {t("footer.rights")}</p>
          <p className="max-w-2xl text-white/45">{t("common.disclaimerMedical")}</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/p/privacy-policy" className="hover:text-white">{t("footer.privacy")}</Link>
            <Link href="/p/terms-of-use" className="hover:text-white">{t("footer.terms")}</Link>
            <Link href="/p/public-offer" className="hover:text-white">{t("footer.offer")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
