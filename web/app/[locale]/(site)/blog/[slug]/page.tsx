import { ArrowLeft, CalendarDays, Clock3, ListOrdered, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConsultButton } from "@/components/site/hero-actions";
import { JsonLd } from "@/components/site/json-ld";
import { PostCover } from "@/components/site/post-cover";
import { Prose } from "@/components/site/section";
import { Link } from "@/i18n/navigation";
import { mediaUrl } from "@/lib/media";
import { SITE_URL, absUrl, breadcrumbLd, clip, seo } from "@/lib/seo";
import { serverGet, staticSlugs } from "@/lib/server";
import type { Post } from "@/lib/types";
import { date } from "@/lib/utils";

type D = Post & { content: string; author: string | null; meta_title: string; meta_description: string };
type P = { params: Promise<{ locale: string; slug: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await serverGet<D>(`/public/posts/${slug}/`, locale);
  return p ? seo({ locale, path: `/blog/${slug}`, title: p.meta_title || p.title, description: p.meta_description || p.summary, image: mediaUrl(p.image), type: "article" }) : {};
}

/** Adds ids to <h2> headings and returns the table of contents. */
function withToc(html: string) {
  const toc: { id: string; title: string }[] = [];
  const body = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_m, attrs: string, inner: string) => {
    const id = `b${toc.length + 1}`;
    toc.push({ id, title: inner.replace(/<[^>]+>/g, "").trim() });
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });
  return { body, toc };
}

export default async function PostPage({ params }: P) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const p = await serverGet<D>(`/public/posts/${slug}/`, locale);
  if (!p) notFound();
  const more = ((await serverGet<{ results: Post[] }>("/public/posts/?page_size=4", locale))?.results || []).filter((x) => x.slug !== p.slug).slice(0, 3);
  const { body, toc } = withToc(p.content || "");
  const words = (p.content || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));

  return (
    <>
      <JsonLd data={[{
        "@context": "https://schema.org", "@type": "Article", headline: p.title, description: clip(p.summary, 300) || undefined,
        image: p.image ? [`${SITE_URL}${mediaUrl(p.image)}`] : [`${SITE_URL}/og-default.png`], datePublished: p.published_date || undefined,
        author: p.author ? { "@type": "Person", name: p.author } : { "@type": "Organization", name: "MedMapp" },
        publisher: { "@id": `${SITE_URL}/#organization` }, mainEntityOfPage: absUrl(locale, `/blog/${p.slug}`), inLanguage: locale,
      }, breadcrumbLd(locale, [["MedMapp", "/"], [t("nav.blog"), "/blog"], [p.title, `/blog/${p.slug}`]])]} />

      {/* header */}
      <section className="bg-hero relative overflow-hidden pb-14 pt-28 text-white lg:pb-16 lg:pt-36">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="container-x relative">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition hover:text-white"><ArrowLeft className="size-4" />{t("list.blogTitle")}</Link>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold">
            {p.category && <span className="rounded-full bg-teal-500 px-3 py-1 text-white">{p.category}</span>}
            {p.published_date && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-white/85 ring-1 ring-white/15"><CalendarDays className="size-3.5" />{date(p.published_date, locale)}</span>}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-white/85 ring-1 ring-white/15"><Clock3 className="size-3.5" />{t("blogPage.readTime", { n: minutes })}</span>
          </div>
          <h1 className="mt-5 max-w-4xl font-display text-3xl font-extrabold leading-[1.15] text-white sm:text-5xl">{p.title}</h1>
          {p.summary && <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/75 sm:text-xl">{p.summary}</p>}
          {p.author && <p className="mt-4 text-sm text-white/60">{p.author}</p>}
        </div>
      </section>

      {/* body + sidebar */}
      <div className="container-x grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-16 xl:gap-14">
        <article className="min-w-0">
          {p.image && (
             
            <img src={mediaUrl(p.image)!} alt="" className="mb-10 w-full rounded-3xl object-cover shadow-card" />
          )}
          <div className="rounded-3xl border border-line bg-white px-6 py-8 shadow-card sm:px-10 sm:py-12 lg:px-14">
            <Prose text={body} className="prose-article" />
          </div>
          <p className="mt-6 rounded-2xl bg-mist px-5 py-4 text-xs leading-relaxed text-ink-muted">{t("common.disclaimerMedical")}</p>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {toc.length > 1 && (
            <nav aria-label={t("ui.contents")} className="rounded-3xl border border-line bg-white p-5 shadow-card">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-navy-900"><ListOrdered className="size-4 text-teal-600" />{t("ui.contents")}</div>
              <ol className="space-y-0.5">
                {toc.map((x) => (
                  <li key={x.id}><a href={`#${x.id}`} className="block rounded-lg px-2.5 py-1.5 text-[13px] leading-snug text-ink-soft transition hover:bg-mist hover:text-navy-900">{x.title}</a></li>
                ))}
              </ol>
            </nav>
          )}
          <div className="bg-hero relative overflow-hidden rounded-3xl p-6 text-white">
            <div className="bg-grid pointer-events-none absolute inset-0" />
            <div className="relative">
              <MessageCircle className="size-6 text-green-300" />
              <h2 className="mt-3 font-display text-lg font-bold leading-snug text-white">{t("blogPage.ctaTitle")}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-white/75">{t("blogPage.ctaText")}</p>
              <ConsultButton className="mt-4 w-full" source="blog_post" />
            </div>
          </div>
        </aside>
      </div>

      {/* more articles */}
      {more.length > 0 && (
        <section className="border-t border-line bg-white py-14">
          <div className="container-x">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-bold">{t("blogPage.more")}</h2>
              <Link href="/blog" className="text-sm font-semibold text-teal-700 hover:underline">{t("common.viewAll")} →</Link>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {more.map((x) => (
                <Link key={x.id} href={`/blog/${x.slug}`} className="card card-hover group overflow-hidden">
                  <PostCover image={x.image_thumb || x.image} category={x.category} seed={x.id} />
                  <div className="p-5">
                    <div className="text-xs text-ink-muted">{date(x.published_date, locale)}</div>
                    <h3 className="mt-2 font-display text-lg font-bold leading-snug group-hover:text-teal-700">{x.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

// Rendered on the first request, then served from the cache and refreshed in the background every 60 s (ISR).
// Without this, every visit re-rendered the page on the server.
export const revalidate = 60;
// Locale comes from the URL, never from cookies/headers, so the page can always be rendered statically.
export const dynamic = "force-static";
export async function generateStaticParams() {
  return staticSlugs("posts");
}
