import type { Metadata } from "next";
import { seo } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Pager } from "@/components/site/filter-bar";
import { PageHero } from "@/components/site/section";
import { Empty } from "@/components/ui";
import { PostCover } from "@/components/site/post-cover";
import { Link } from "@/i18n/navigation";
import type { Paginated } from "@/lib/api";
import { toQuery } from "@/lib/filters";
import { serverGet } from "@/lib/server";
import type { Post } from "@/lib/types";
import { date } from "@/lib/utils";

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return seo({ locale, path: "/blog", title: t("list.blogTitle"), description: t("meta.blogDescription") });
}

export default async function BlogPage({ params, searchParams }: P) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const data = await serverGet<Paginated<Post>>(`/public/posts/${toQuery(await searchParams, ["category", "search", "page"])}`, locale, 60);
  return (
    <>
      <PageHero eyebrow={t("nav.blog")} title={t("list.blogTitle")} />
      <section className="container-x py-14">
        {data?.results.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.results.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="card card-hover group overflow-hidden">
                <PostCover image={p.image} category={p.category} seed={p.id} />
                <div className="p-5">
                  <div className="text-xs text-ink-muted">{[p.category, date(p.published_date, locale)].filter(Boolean).join(" · ")}</div>
                  <h2 className="mt-2 font-display text-lg font-bold leading-snug group-hover:text-teal-700">{p.title}</h2>
                  {p.summary && <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{p.summary}</p>}
                </div>
              </Link>
            ))}
          </div>
        ) : <Empty title={t("common.empty")} />}
        <Pager count={data?.count || 0} />
      </section>
    </>
  );
}
