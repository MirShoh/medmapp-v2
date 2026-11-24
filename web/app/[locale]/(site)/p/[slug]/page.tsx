import type { Metadata } from "next";
import { seo } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CountryCard } from "@/components/site/cards";
import { ConsultationForm } from "@/components/site/consultation-form";
import { PageHero, Prose } from "@/components/site/section";
import { cardLabels } from "@/lib/labels";
import { serverGet } from "@/lib/server";
import type { CountryCard as TC, Section } from "@/lib/types";
import { date } from "@/lib/utils";

type Pg = { slug: string; kind: string; title: string; subtitle: string; body: string; source_note: string; source_updated: string | null; meta_title: string; meta_description: string; sections: Section[] };
type P = { params: Promise<{ locale: string; slug: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await serverGet<Pg>(`/public/pages/${slug}/`, locale);
  return p ? seo({ locale, path: `/p/${slug}`, title: p.meta_title || p.title, description: p.meta_description || p.subtitle || p.body }) : {};
}

export default async function CmsPage({ params }: P) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const p = await serverGet<Pg>(`/public/pages/${slug}/`, locale);
  if (!p) notFound();
  const destinations = p.kind === "gateway" ? (await serverGet<TC[]>("/public/destinations/", locale)) || [] : [];
  return (
    <>
      <PageHero eyebrow={p.kind === "gateway" ? t("nav.destinations") : p.kind === "legal" ? t("ui.legalDoc") : "MedMapp"} title={p.title} subtitle={p.subtitle} />
      <div className="container-x space-y-10 py-12">
        {p.body && p.kind === "legal" ? <LegalBody html={p.body} contentsLabel={t("ui.contents")} />
          : p.body && <div className="card max-w-5xl p-6 sm:p-10"><Prose text={p.body} /></div>}
        {(p.source_note || p.source_updated) && <p className="text-xs text-ink-muted">{t("common.source")}: {p.source_note} {p.source_updated && `· ${t("common.updated")} ${date(p.source_updated, locale)}`}</p>}
        {destinations.length > 0 && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{destinations.map((c) => <CountryCard key={c.id} c={c} locale={locale} labels={cardLabels(t)} />)}</div>}
        {p.kind === "gateway" && (
          <div className="rounded-3xl bg-navy-900 p-6 sm:p-10">
            <h2 className="font-display text-2xl font-extrabold text-white">{t("contact.title")}</h2>
            <div className="mt-6 rounded-2xl bg-white p-5"><ConsultationForm source={`gateway_${slug}`} /></div>
          </div>
        )}
      </div>
    </>
  );
}

/** Legal documents: full-width text with a sticky table of contents built from the <h2> headings. */
function LegalBody({ html, contentsLabel }: { html: string; contentsLabel: string }) {
  const toc: { id: string; title: string }[] = [];
  const body = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_m, attrs: string, inner: string) => {
    const id = `s${toc.length + 1}`;
    toc.push({ id, title: inner.replace(/<[^>]+>/g, "").trim() });
    return `<h2${attrs} id="${id}" class="scroll-mt-28">${inner}</h2>`;
  });
  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
      {toc.length > 1 && (
        <nav aria-label={contentsLabel} className="hidden lg:block">
          <div className="sticky top-28 rounded-2xl border border-line bg-white p-4">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">{contentsLabel}</div>
            <ol className="scrollbar-thin max-h-[70vh] space-y-0.5 overflow-y-auto">
              {toc.map((x) => (
                <li key={x.id}><a href={`#${x.id}`} className="block rounded-lg px-2 py-1.5 text-[13px] leading-snug text-ink-soft hover:bg-mist hover:text-navy-900">{x.title}</a></li>
              ))}
            </ol>
          </div>
        </nav>
      )}
      <div className={`card p-6 sm:p-10 lg:p-12 ${toc.length > 1 ? "" : "lg:col-span-2"}`}><Prose text={body} /></div>
    </div>
  );
}
