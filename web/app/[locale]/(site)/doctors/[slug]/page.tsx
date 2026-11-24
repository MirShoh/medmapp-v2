import { Clock, Languages, Stethoscope, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { SITE_URL, absUrl, breadcrumbLd, clip, seo } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConsultationForm } from "@/components/site/consultation-form";
import { Block, Bullets } from "@/components/site/detail";
import { Prose } from "@/components/site/section";
import { Link } from "@/i18n/navigation";
import { mediaUrl } from "@/lib/media";
import { serverGet } from "@/lib/server";
import type { DoctorCard, TreatmentMini } from "@/lib/types";

type D = DoctorCard & {
  biography: string; education_list: string[]; qualifications_list: string[]; expertise_list: string[];
  surgeries_count: number; treatments: TreatmentMini[]; meta_title: string; meta_description: string;
};
type P = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const d = await serverGet<D>(`/public/doctors/${slug}/`, locale);
  return d ? seo({ locale, path: `/doctors/${slug}`, title: d.meta_title || `${d.full_name} — ${d.specialty_title}`,
    description: d.meta_description || d.biography, image: mediaUrl(d.photo), type: "profile" }) : {};
}

export default async function DoctorPage({ params }: P) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const d = await serverGet<D>(`/public/doctors/${slug}/`, locale);
  if (!d) notFound();
  const photo = mediaUrl(d.photo);
  return (
    <>
      <JsonLd data={[{
        "@context": "https://schema.org", "@type": "Physician", name: d.full_name, url: absUrl(locale, `/doctors/${d.slug}`),
        description: clip(d.biography, 300) || undefined, image: d.photo ? `${SITE_URL}${mediaUrl(d.photo)}` : undefined,
        medicalSpecialty: d.specialty?.title || d.specialty_title, jobTitle: d.position || undefined, knowsLanguage: d.languages_list,
        worksFor: d.hospitals.map((x) => ({ "@type": "Hospital", name: x.name, url: absUrl(locale, `/hospitals/${x.slug}`) })),
      }, breadcrumbLd(locale, [["MedMapp", "/"], [t("nav.doctors"), "/doctors"], [d.full_name, `/doctors/${d.slug}`]])]} />
      <section className="bg-hero pb-12 pt-28 text-white lg:pt-36">
        <div className="container-x flex flex-col gap-8 sm:flex-row sm:items-end">
          <div className="size-40 shrink-0 overflow-hidden rounded-3xl bg-white/10 ring-4 ring-white/10">
            { }
            {photo ? <img src={photo} alt={d.full_name} className="size-full object-cover" /> : <UserRound className="m-auto mt-10 size-20 text-white/30" />}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-teal-300"><Stethoscope className="size-4" />{d.specialty?.title || d.specialty_title}</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold text-white sm:text-5xl">{d.full_name}</h1>
            {d.position && <p className="mt-2 text-white/70">{d.position}</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {d.experience_years > 0 && <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Clock className="size-4" />{d.experience_years} {t("common.years")}</span>}
              {d.languages_list.length > 0 && <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Languages className="size-4" />{d.languages_list.join(", ")}</span>}
            </div>
          </div>
        </div>
      </section>
      <div className="container-x grid gap-6 py-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {d.biography && <Block title={t("detail.biography")}><Prose text={d.biography} /></Block>}
          {d.expertise_list.length > 0 && <Block title={t("detail.expertise")}><Bullets items={d.expertise_list} cols /></Block>}
          {d.education_list.length > 0 && <Block title={t("detail.education")}><Bullets items={d.education_list} /></Block>}
          {d.qualifications_list.length > 0 && <Block title={t("detail.qualifications")}><Bullets items={d.qualifications_list} /></Block>}
          {d.hospitals.length > 0 && (
            <Block title={t("nav.hospitals")}>
              <div className="grid gap-2 sm:grid-cols-2">
                {d.hospitals.map((h) => (
                  <Link key={h.id} href={`/hospitals/${h.slug}`} className="rounded-xl border border-line px-4 py-3 text-sm font-medium hover:border-teal-300">
                    {h.name}<div className="text-xs font-normal text-ink-muted">{[h.city, h.country].filter(Boolean).join(", ")}</div>
                  </Link>
                ))}
              </div>
            </Block>
          )}
          {d.treatments.length > 0 && (
            <Block title={t("detail.treatments")}>
              <div className="flex flex-wrap gap-2">{d.treatments.map((x) => <Link key={x.id} href={`/treatments/${x.slug}`} className="chip">{x.name}</Link>)}</div>
            </Block>
          )}
          {!d.biography && !d.expertise_list.length && <p className="text-sm text-ink-muted">{t("detail.noInfo")}</p>}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="font-display text-lg font-bold">{t("common.requestQuote")}</h2>
            <div className="mt-4"><ConsultationForm compact preset={{ doctor: d.id, hospital: d.hospitals[0]?.id }} source="doctor_page" /></div>
          </div>
        </aside>
      </div>
    </>
  );
}
