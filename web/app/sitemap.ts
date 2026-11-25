import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { absUrl, languageAlternates } from "@/lib/seo";

import { BACKEND } from "@/lib/server";
export const revalidate = 3600;

type Row = { slug: string; updated: string | null };
type Data = Record<"hospitals" | "doctors" | "treatments" | "destinations" | "packages" | "services" | "posts" | "pages", Row[]>;

const STATIC: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
  ["/", 1, "daily"], ["/treatments", 0.9, "weekly"], ["/destinations", 0.9, "weekly"], ["/hospitals", 0.9, "daily"],
  ["/doctors", 0.8, "weekly"], ["/how-it-works", 0.7, "monthly"],
  ["/packages", 0.6, "weekly"], ["/about", 0.6, "monthly"], ["/blog", 0.6, "weekly"], ["/tools", 0.4, "monthly"],
];
const DYNAMIC: [keyof Data, string, number][] = [
  ["destinations", "/destinations", 0.85], ["treatments", "/treatments", 0.85], ["hospitals", "/hospitals", 0.8],
  ["doctors", "/doctors", 0.7], ["packages", "/packages", 0.6], ["posts", "/blog", 0.6], ["pages", "/p", 0.3],
];

/** One entry per page and language, each listing its hreflang alternates (uz is the default, unprefixed). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let data: Partial<Data> = {};
  try {
    if (!BACKEND) throw new Error("no backend");
    const r = await fetch(`${BACKEND}/api/v2/public/sitemap/`, { next: { revalidate } });
    if (r.ok) data = await r.json();
  } catch { /* backend down: static pages only */ }
  const entry = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"], updated?: string | null) =>
    routing.locales.map((l) => ({
      url: absUrl(l, path), lastModified: updated ? new Date(updated) : new Date(), changeFrequency, priority,
      alternates: { languages: languageAlternates(path) },
    }));
  return [
    ...STATIC.flatMap(([p, pr, cf]) => entry(p, pr, cf)),
    ...DYNAMIC.flatMap(([key, base, pr]) => (data[key] || []).flatMap((x) => entry(`${base}/${x.slug}`, pr, "weekly", x.updated))),
  ];
}
