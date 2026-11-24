import { Building2, Clock3, ExternalLink, Globe2, Handshake, Mail, MapPin, Phone, PlaneLanding, PlaneTakeoff, Send, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Icon } from "@/components/site/icon";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero, Prose } from "@/components/site/section";
import { SocialLinks } from "@/components/site/socials";
import { Link } from "@/i18n/navigation";
import { SITE_URL, absUrl, seo } from "@/lib/seo";
import { serverGet } from "@/lib/server";
import type { Section } from "@/lib/types";
import { num } from "@/lib/utils";

type P = { params: Promise<{ locale: string }> };
type Site = { settings: { phone: string; email: string; address: string; socials: Record<string, string> } };
const PARTNERS = [
  { key: "mediconnex", name: "MediConnex", url: "https://mediconnex.com.cn/hospitals/" },
  { key: "cmw", name: "China MedWaypoint", url: "https://chinamedwaypoint.com/" },
  { key: "drgalen", name: "Dr. Galen", url: "https://drgalen.org/doctors" },
];

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return seo({ locale, path: "/about", title: t("aboutPage.metaTitle"), description: t("about.body") });
}

export default async function AboutPage({ params }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const [sections, home, site] = await Promise.all([
    serverGet<Section[]>("/public/sections/about/", locale),
    serverGet<{ sections: Section[]; stats: Record<string, number> }>("/public/home/", locale),
    serverGet<Site>("/public/site/", locale, 600),
  ]);
  const why = home?.sections?.find((s) => s.key === "why");
  const stats = home?.stats || {};
  const s = site?.settings;
  const tel = s?.phone?.replace(/[^\d+]/g, "");
  const contacts = [
    s?.phone && { icon: Phone, label: t("contact.phone"), value: s.phone, href: `tel:${tel}`, hint: t("contact.phoneHint") },
    s?.socials?.telegram && { icon: Send, label: "Telegram", value: `@${s.socials.telegram.split("/").pop()}`, href: s.socials.telegram, hint: t("contact.telegramHint") },
    s?.email && { icon: Mail, label: "Email", value: s.email, href: `mailto:${s.email}`, hint: t("contact.emailHint") },
    s?.address && { icon: MapPin, label: t("contact.address"), value: s.address, hint: t("contact.addressHint") },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string; hint: string }[];
  const facts = ([
    [Building2, stats.hospitals, t("home.statsHospitals"), "/hospitals"], [Stethoscope, stats.doctors, t("home.statsDoctors"), "/doctors"],
    [Globe2, stats.destinations, t("home.statsDestinations"), "/destinations"],
  ] as const).filter(([, n]) => n);

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "AboutPage", url: absUrl(locale, "/about"),
        mainEntity: { "@id": `${SITE_URL}/#organization`, contactPoint: tel ? [{ "@type": "ContactPoint", telephone: tel, email: s?.email || undefined, contactType: "customer support", availableLanguage: ["uz", "ru", "en"] }] : undefined },
      }} />
      <PageHero eyebrow="MedMapp" title={t("about.title")} subtitle={t("footer.tagline")}>
        {facts.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {facts.map(([I, n, label, href]) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 transition hover:bg-white/15">
                <I className="size-5 text-green-300" /><span className="font-display text-2xl font-extrabold text-white">{num(n!, locale)}</span><span className="text-sm text-white/75">{label}</span>
              </Link>
            ))}
          </div>
        )}
      </PageHero>

      {/* mission + two directions */}
      <section className="container-x grid gap-6 py-14 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:py-20">
        <div className="card p-8 sm:p-10">
          <div className="eyebrow mb-3">{t("aboutPage.missionEyebrow")}</div>
          <h2 className="h-section">{t("aboutPage.missionTitle")}</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink">{t("about.body")}</p>
          <p className="mt-6 text-sm text-ink-muted">«MEDMAPP» MCHJ</p>
        </div>
        <div className="grid gap-4">
          {([[PlaneTakeoff, t("home.mapOut"), t("aboutPage.outText"), "bg-teal-500"], [PlaneLanding, t("home.mapIn"), t("aboutPage.inText"), "bg-green-500"]] as const).map(([I, title, text, bg]) => (
            <div key={title} className="card flex items-start gap-4 p-6">
              <span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-glow ${bg}`}><I className="size-6" /></span>
              <div><h3 className="font-display text-lg font-bold text-navy-900">{title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-soft">{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* values */}
      {why?.items?.length ? (
        <section className="bg-white py-14 lg:py-20">
          <div className="container-x">
            <h2 className="h-section mb-8 text-center">{why.title || t("home.whyTitle")}</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {why.items.map((it) => (
                <div key={it.title} className="rounded-2xl border border-line bg-mist/60 p-6">
                  <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-glow"><Icon name={it.icon} className="size-5" /></span>
                  <h3 className="mt-4 font-display text-lg font-bold text-navy-900">{it.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{it.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {(sections || []).length > 0 && (
        <section className="container-x space-y-6 py-14">
          {sections!.map((x) => (
            <div key={x.key} className="card max-w-4xl p-8"><h2 className="mb-3 font-display text-2xl font-bold">{x.title}</h2>{x.subtitle && <p className="lead mb-4">{x.subtitle}</p>}<Prose text={x.body} /></div>
          ))}
        </section>
      )}

      {/* partners */}
      <section className="container-x py-14 lg:py-20" aria-labelledby="partners">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-teal-500 text-white"><Handshake className="size-5" /></span>
          <div>
            <h2 id="partners" className="font-display text-2xl font-bold">{t("partners.title")}</h2>
            <p className="text-sm text-ink-soft">{t("partners.sub")}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PARTNERS.map((p) => (
            <a key={p.key} href={p.url} target="_blank" rel="noopener noreferrer" className="card card-hover group flex flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-extrabold text-navy-900">{p.name}</span>
                <ExternalLink className="size-4 text-ink-muted transition group-hover:text-teal-600" />
              </div>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-green-600">{t(`partners.${p.key}Role`)}</span>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t(`partners.${p.key}Text`)}</p>
              <span className="mt-auto pt-4 text-xs text-ink-muted">{p.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
            </a>
          ))}
        </div>
      </section>

      {/* contacts (replaces the old /contact page) */}
      <section id="contact" className="scroll-mt-24 bg-hero relative overflow-hidden py-16 lg:py-24">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="container-x relative">
          <div className="eyebrow mb-3 text-teal-300">{t("nav.contact")}</div>
          <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">{t("contact.title")}</h2>
          <p className="mt-3 max-w-2xl text-white/75">{t("contact.subtitle")}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {contacts.map(({ icon: I, label, value, href, hint }) => {
              const body = (
                <>
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-500 text-white shadow-glow"><I className="size-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
                    <span className="mt-0.5 block break-words font-display text-[17px] font-bold leading-snug text-navy-900">{value}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>
                  </span>
                </>
              );
              return href
                ? <a key={label} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-lift transition hover:-translate-y-0.5">{body}</a>
                : <div key={label} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-lift">{body}</div>;
            })}
          </div>
          <div className="mt-6 flex flex-col gap-5 rounded-3xl bg-white/5 p-6 text-white ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-300"><Clock3 className="size-4" />{t("contact.replyTitle")}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-white/80">{t("contact.replyText")}</p>
            </div>
            {s?.socials && <SocialLinks socials={s.socials} className="shrink-0" itemClass="bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20" />}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/50">{t("common.disclaimerMedical")}</p>
        </div>
      </section>
    </>
  );
}
