import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/** Public site address used in canonical URLs, sitemap and structured data. Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://medmapp.uz").replace(/\/$/, "");
export const OG_IMAGE = "/og-default.png";
const OG_LOCALE: Record<string, string> = { uz: "uz_UZ", ru: "ru_RU", en: "en_US" };

/** Path as served for a locale: Uzbek (default) has no prefix, others get /ru, /en ("as-needed" routing). */
export function localePath(locale: string, path: string) {
  const p = path === "/" ? "" : path;
  return locale === routing.defaultLocale ? p || "/" : `/${locale}${p}`;
}
export const absUrl = (locale: string, path: string) => `${SITE_URL}${localePath(locale, path)}`;

/** hreflang map for one page in every language, plus x-default (Uzbek). */
export function languageAlternates(path: string) {
  const langs: Record<string, string> = Object.fromEntries(routing.locales.map((l) => [l, absUrl(l, path)]));
  langs["x-default"] = absUrl(routing.defaultLocale, path);
  return langs;
}

export function clip(text: string | null | undefined, max = 160) {
  const s = (text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

/**
 * Complete page metadata: title, description (≤160 chars), canonical, hreflang alternates, Open Graph and Twitter card.
 * Every public page builds its metadata through this so nothing is forgotten.
 */
export function seo({ locale, path, title, description, image, type = "website", noindex, keywords }: {
  locale: string; path: string; title?: string; description?: string | null; image?: string | null;
  type?: "website" | "article" | "profile"; noindex?: boolean; keywords?: string[];
}): Metadata {
  const desc = description ? clip(description) : undefined;
  const img = image ? (image.startsWith("http") ? image : `${SITE_URL}${image}`) : `${SITE_URL}${OG_IMAGE}`;
  return {
    title,
    description: desc,
    keywords: keywords?.filter(Boolean),
    alternates: { canonical: absUrl(locale, path), languages: languageAlternates(path) },
    openGraph: {
      type, url: absUrl(locale, path), siteName: "MedMapp", title, description: desc,
      locale: OG_LOCALE[locale], alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      images: [{ url: img, width: 1200, height: 630, alt: title || "MedMapp" }],
    },
    twitter: { card: "summary_large_image", title, description: desc, images: [img] },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

/** Breadcrumb structured data from [name, path] pairs (home first). */
export function breadcrumbLd(locale: string, items: [string, string][]) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absUrl(locale, path) })),
  };
}

export function faqLd(items: { question: string; answer: string }[]) {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: clip(f.answer, 1000) } })),
  };
}
