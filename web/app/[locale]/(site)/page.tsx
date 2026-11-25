import { ArrowRight, Building2, ClipboardCheck, Clock3, FileText, Globe2, HeartHandshake, HeartPulse, Languages, Lock, MessageCircle, MessageSquareText, PhoneCall, Plane, Quote, ShieldCheck, Sparkles, Stethoscope, Syringe } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/site/json-ld";
import { faqLd, seo } from "@/lib/seo";
import { CountryCard, DoctorCard, HospitalCard, PackageCard } from "@/components/site/cards";
import { CompareBar } from "@/components/site/compare";
import { ConsultationForm } from "@/components/site/consultation-form";
import { HeroSearch } from "@/components/site/hero-search";
import { Reveal } from "@/components/site/reveal";
import { TreatmentExplorer } from "@/components/site/treatment-explorer";
import { ConsultButton } from "@/components/site/hero-actions";
import { RouteMap } from "@/components/site/route-map";
import { SectionHead } from "@/components/site/section";
import { FaqSection } from "@/components/site/faq";
import { PostCover } from "@/components/site/post-cover";
import { Link } from "@/i18n/navigation";
import { cardLabels } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { serverGet } from "@/lib/server";
import type { CountryCard as TC, DoctorCard as TD, FAQ, HospitalCard as TH, PackageCard as TP, Post, Section, Service, Specialty, Testimonial, Treatment } from "@/lib/types";
import { date, num } from "@/lib/utils";

// request · documents · offers · travel · treatment
const HOW_ICONS = [MessageSquareText, FileText, ClipboardCheck, Plane, HeartPulse];
const MAP_KEYS = ["Uzbekistan", "India", "Turkey", "China", "Germany", "Korea", "UAE", "Thailand", "Azerbaijan",
  "Kazakhstan", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Russia", "Belarus"];
const STAT_LINKS: Record<string, string> = { hospitals: "/hospitals", doctors: "/doctors", destinations: "/destinations", treatments: "/treatments", patients_helped: "/about" };

type Home = {
  sections: Section[]; stats: Record<string, number>; specialties: Specialty[]; treatments: Treatment[]; advanced: Treatment[];
  destinations: TC[]; hospitals: TH[]; doctors: TD[]; packages: TP[]; services: Service[]; testimonials: Testimonial[];
  posts: Post[]; faqs: FAQ[]; partners: { name: string; slug: string; logo: string | null }[];
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { ...seo({ locale, path: "/", title: t("meta.homeTitle"), description: t("meta.description") }), title: { absolute: t("meta.homeTitle") } };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const data = await serverGet<Home>("/public/home/", locale);
  const allTreatments = (await serverGet<{ results: Treatment[] }>("/public/treatments/?page_size=200", locale))?.results || [];
  const filters = await serverGet<{ treatments: { slug: string; name: string }[]; countries: { slug: string; name: string; flag: string }[] }>("/public/filters/", locale);
  const S = Object.fromEntries((data?.sections || []).map((s) => [s.key, s])) as Record<string, Section | undefined>;
  const L = { locale, labels: cardLabels(t) };
  const howSteps = t.raw("howPage.abroad") as { title: string; we: string; time: string }[];
  const stats = data?.stats || {};
  const STAT_ICONS = { hospitals: Building2, doctors: Stethoscope, destinations: Globe2, treatments: Syringe, patients_helped: HeartHandshake };
  const statItems = ([
    ["hospitals", t("home.statsHospitals"), t("ui.statHospitalsHint")], ["doctors", t("home.statsDoctors"), t("ui.statDoctorsHint")],
    ["destinations", t("home.statsDestinations"), t("ui.statDestinationsHint")], ["treatments", t("home.statsTreatments"), t("ui.statTreatmentsHint")],
    ["patients_helped", t("home.statsPatients"), t("ui.statPatientsHint")],
  ] as [keyof typeof STAT_ICONS, string, string][]).filter(([k]) => (stats[k] || 0) > 0);
  const show = (k: string) => S[k] !== undefined || !data?.sections?.length;

  return (
    <>
      <JsonLd data={faqLd(data?.faqs || [])} />
      {/* 1. HERO + STATS */}
      <section className="bg-hero relative flex flex-col overflow-x-clip pb-8 pt-24 text-white lg:min-h-[100svh] lg:pb-6 lg:pt-28">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className={`container-x relative grid w-full items-center gap-10 ${statItems.length ? "mt-auto" : "my-auto"} lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] xl:gap-14`}>
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-teal-200 backdrop-blur">
              <span className="size-1.5 rounded-full bg-green-400" /> {t("ui.heroBadge")}
            </div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl lg:text-[64px]">
              {S.hero?.title || t("home.heroTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">{S.hero?.subtitle}</p>
            <HeroSearch treatments={filters?.treatments || []} countries={filters?.countries || []} />
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute -inset-8 rounded-[3rem] bg-teal-500/10 blur-3xl" />
            <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm xl:p-6">
              <RouteMap legendOut={t("home.mapOut")} legendIn={t("home.mapIn")}
                labels={Object.fromEntries(MAP_KEYS.map((k) => [k, t(`map.${k}`)]))} />
            </div>
          </div>
        </div>
        {/* stats (real counts only), at the bottom of the first screen */}
        {statItems.length > 0 && (
          <div className="container-x relative z-10 mt-12 lg:mt-auto lg:pt-10">
            <div className="rounded-3xl border border-line bg-white p-3 shadow-lift sm:p-4">
              <div className={`grid gap-3 sm:grid-cols-2 ${statItems.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} ${statItems.length === 5 ? "xl:grid-cols-5" : ""}`}>
                {statItems.map(([k, label, hint]) => {
                  const I = STAT_ICONS[k];
                  return (
                    <Link key={k} href={STAT_LINKS[k]} className="group flex items-center gap-4 rounded-2xl border border-transparent bg-mist px-5 py-5 transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-white hover:shadow-card">
                      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-glow transition group-hover:scale-105"><I className="size-6" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-4xl font-extrabold leading-none text-navy-900">{num(stats[k], locale)}</div>
                        <div className="mt-1.5 text-sm font-bold text-navy-800 group-hover:text-teal-700">{label}</div>
                        <div className="text-xs leading-snug text-ink-muted">{hint}</div>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-ink-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:text-teal-600 group-hover:opacity-100" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {/* trust points under the stats */}
        <div className="container-x relative mt-6">
          <ul className="flex flex-col gap-x-10 gap-y-2 text-sm text-white/75 sm:flex-row sm:flex-wrap sm:justify-center xl:flex-nowrap">
            {[t("home.trust1"), t("home.trust2"), t("home.trust3"), t("home.trust4")].map((x) => (
              <li key={x} className="flex items-center gap-2 xl:whitespace-nowrap"><ShieldCheck className="size-4 shrink-0 text-green-400" />{x}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. DESTINATIONS */}
      {show("destinations") && (data?.destinations?.length || 0) > 0 && (
        <section className="py-20 lg:py-24">
          <div className="container-x">
            <SectionHead eyebrow={t("nav.destinations")} title={S.destinations?.title || t("list.destinationsTitle")} subtitle={t("list.destinationsSub")} href="/destinations" linkLabel={t("common.viewAll")} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data!.destinations.map((c, i, all) => {
                // Big first card (2x2) + 4 small ones; widen the leftover cards so the last row has no hole.
                const rest = (all.length - 5) % 4, span = i === 0 ? "sm:col-span-2 sm:row-span-2 sm:min-h-[29rem]" : i >= all.length - rest && rest > 0 && 4 % rest === 0 ? (rest === 1 ? "lg:col-span-4" : "lg:col-span-2") : "";
                return <CountryCard key={c.id} c={c} {...L} className={span} />;
              })}
            </div>
          </div>
        </section>
      )}

      {/* 6. HOSPITALS */}
      {show("hospitals") && (
        <section className="bg-white py-20 lg:py-24">
          <div className="container-x">
            <SectionHead eyebrow={t("nav.hospitals")} title={S.hospitals?.title || t("list.hospitalsTitle")} href="/hospitals" linkLabel={t("common.viewAll")} />
            {data?.hospitals?.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.hospitals.map((h) => <HospitalCard key={h.id} h={h} {...L} />)}</div>
            ) : <p className="rounded-2xl bg-mist p-6 text-sm text-ink-soft">{t("home.emptyCatalog")}</p>}
          </div>
        </section>
      )}

      {/* 4. TREATMENTS: pick a specialty, see treatments, hospitals and prices */}
      {show("treatments") && allTreatments.length > 0 && (
        <section className="py-20 lg:py-24">
          <div className="container-x">
            <SectionHead eyebrow={t("nav.treatments")} title={S.treatments?.title || t("list.treatmentsTitle")} subtitle={t("explorer.subtitle")} href="/treatments" linkLabel={t("common.viewAll")} />
            <TreatmentExplorer specialties={data?.specialties || []} treatments={allTreatments} locale={locale} labels={{
              popular: t("explorer.popular"), search: t("explorer.search"), hospitals: t("explorer.hospitals"), from: t("common.from"),
              open: t("common.learnMore"), empty: t("explorer.empty"), ctaTitle: t("explorer.ctaTitle"), ctaText: t("explorer.ctaText"),
              all: t("explorer.all"), advanced: t("ui.advanced"), hospitalsBy: t("explorer.hospitalsBy"),
            }} />
          </div>
        </section>
      )}

      {/* 7. DOCTORS */}
      {show("doctors") && (data?.doctors?.length || 0) > 0 && (
        <section className="py-20 lg:py-28">
          <div className="container-x">
            <SectionHead eyebrow={t("nav.doctors")} title={S.doctors?.title || t("list.doctorsTitle")} href="/doctors" linkLabel={t("common.viewAll")} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data!.doctors.slice(0, 8).map((d) => <DoctorCard key={d.id} d={d} {...L} />)}</div>
          </div>
        </section>
      )}

      {/* 8. PACKAGES */}
      {show("packages") && (data?.packages?.length || 0) > 0 && (
        <section className="bg-white py-20 lg:py-28">
          <div className="container-x">
            <SectionHead eyebrow={t("nav.packages")} title={S.packages?.title || t("list.packagesTitle")} subtitle={t("common.disclaimerPrice")} href="/packages" linkLabel={t("common.viewAll")} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data!.packages.map((p) => <PackageCard key={p.id} p={p} {...L} />)}</div>
          </div>
        </section>
      )}

      {/* 9. HOW IT WORKS: five steps as a journey, each with who does what and how long it takes */}
      {show("how") && (
        <section className="bg-hero relative overflow-hidden py-20 text-white lg:py-28">
          <div className="bg-grid pointer-events-none absolute inset-0" />
          <div className="absolute -left-32 top-1/3 size-96 rounded-full bg-green-500/10 blur-3xl" />
          <div className="container-x relative">
            <div className="mx-auto max-w-2xl text-center">
              <div className="eyebrow justify-center text-teal-300">{t("nav.how")}</div>
              <h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">{S.how?.title || t("how.title")}</h2>
              <p className="mt-3 text-white/70">{t("howPage.subtitle")}</p>
            </div>
            <ol className="relative mt-14 grid gap-5 md:grid-cols-5">
              {/* dashed route behind the step icons */}
              <svg className="pointer-events-none absolute left-[10%] right-[10%] top-8 hidden h-2 md:block" style={{ width: "80%" }} preserveAspectRatio="none" viewBox="0 0 100 2" aria-hidden>
                <line x1="0" y1="1" x2="100" y2="1" stroke="#2BD67F" strokeWidth="0.35" className="route-line" />
              </svg>
              {howSteps.map((st, i) => {
                const I = HOW_ICONS[i] || Sparkles;
                return (
                  <Reveal key={st.title} delay={i * 0.08}>
                    <li className="group relative flex h-full flex-col items-center text-center">
                      <span className="relative grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-glow ring-4 ring-navy-900 transition duration-300 group-hover:-translate-y-1 group-hover:scale-105">
                        <I className="size-7" />
                        <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-green-400 font-display text-xs font-extrabold text-navy-900">{i + 1}</span>
                      </span>
                      <div className="mt-5 flex w-full flex-1 flex-col rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur transition duration-300 group-hover:bg-white/[0.1] group-hover:ring-teal-400/40">
                        <h3 className="font-display text-[15px] font-bold leading-snug text-white">{st.title}</h3>
                        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/65">{st.we}</p>
                        <span className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-400/15 px-2.5 py-1 text-[11px] font-semibold text-green-300">
                          <Clock3 className="size-3.5" />{st.time}
                        </span>
                      </div>
                    </li>
                  </Reveal>
                );
              })}
            </ol>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <ConsultButton size="lg" icon source="home_how" />
              <Link href="/how-it-works" className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-[15px] font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10">
                {t("howPage.more")}<ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 12. PARTNERS */}
      {show("partners") && (data?.partners?.length || 0) > 0 && (
        <section className="border-y border-line bg-mist py-12">
          <div className="container-x">
            <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{S.partners?.title}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {data!.partners.map((p) => (
                <Link key={p.slug} href={`/hospitals/${p.slug}`} className="opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0">
                  { }
                  {p.logo ? <img src={mediaUrl(p.logo)!} alt={p.name} className="h-10 w-auto" /> : <span className="font-display font-bold text-navy-800">{p.name}</span>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 13. TESTIMONIALS (published by staff from verified patients) */}
      {show("testimonials") && (data?.testimonials?.length || 0) > 0 && (
        <section className="py-20 lg:py-28">
          <div className="container-x">
            <SectionHead eyebrow="MedMapp" title={S.testimonials?.title || t("ui.stories")} center />
            <div className="grid gap-5 md:grid-cols-3">
              {data!.testimonials.slice(0, 3).map((x) => (
                <figure key={x.id} className="card p-6">
                  <Quote className="size-7 text-teal-500/40" />
                  <blockquote className="mt-3 line-clamp-6 text-sm leading-relaxed text-ink">{x.review_text}</blockquote>
                  <figcaption className="mt-5 border-t border-line pt-4">
                    <div className="font-display font-bold text-navy-900">{x.patient_name}</div>
                    <div className="text-xs text-ink-muted">{[x.treatment_received, x.country?.name].filter(Boolean).join(" · ")}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 14. BLOG */}
      {show("blog") && (data?.posts?.length || 0) > 0 && (
        <section className="bg-white py-20 lg:py-28">
          <div className="container-x">
            <SectionHead eyebrow={t("nav.blog")} title={S.blog?.title || t("list.blogTitle")} href="/blog" linkLabel={t("common.viewAll")} />
            <div className="grid gap-5 md:grid-cols-3">
              {data!.posts.map((p) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="card card-hover group overflow-hidden">
                  <PostCover image={p.image} category={p.category} seed={p.id} />
                  <div className="p-5">
                    <div className="text-xs text-ink-muted">{p.category} · {date(p.published_date, locale)}</div>
                    <h3 className="mt-2 font-display text-lg font-bold leading-snug group-hover:text-teal-700">{p.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 15. FAQ */}
      {(data?.faqs?.length || 0) > 0 && (
        <section className="bg-white py-20 lg:py-28">
          <div className="container-x">
            <FaqSection title={S.faq?.title || t("detail.faq")} subtitle={t("ui.faqSub")} items={data!.faqs} />
          </div>
        </section>
      )}

      {/* 16. CTA: free consultation */}
      <section id="consult" className="py-20 lg:py-28">
        <div className="container-x">
          <div className="bg-hero relative grid overflow-hidden rounded-[2rem] shadow-lift lg:grid-cols-[1fr_1.1fr]">
            <div className="bg-grid pointer-events-none absolute inset-0" />
            <div className="relative p-8 text-white sm:p-12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-green-300">
                <span className="size-1.5 rounded-full bg-green-400" />{t("ui.free")}
              </div>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">{S.cta?.title || t("contact.title")}</h2>
              <p className="mt-4 max-w-md text-white/75">{S.cta?.subtitle || t("contact.subtitle")}</p>
              <ul className="mt-8 space-y-4">
                {([[Clock3, t("ui.ctaPoint1")], [Stethoscope, t("ui.ctaPoint2")], [Languages, t("home.trust3")], [Lock, t("ui.ctaPoint4")]] as const).map(([I, text]) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-green-300"><I className="size-4" /></span>
                    <span className="pt-1.5 text-sm font-medium text-white/90">{text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                <PhoneCall className="size-5 shrink-0 text-green-300" />{t("ui.ctaCallback")}
              </div>
            </div>
            <div className="relative bg-white p-6 sm:p-10">
              <h3 className="flex items-center gap-2 font-display text-xl font-bold text-navy-900"><MessageCircle className="size-5 text-teal-600" />{t("ui.ctaFormTitle")}</h3>
              <p className="mb-5 mt-1 text-sm text-ink-soft">{t("ui.ctaFormSub")}</p>
              <ConsultationForm compact source="homepage" />
            </div>
          </div>
        </div>
      </section>
      <CompareBar kind="hospitals" />
    </>
  );
}
