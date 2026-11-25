import "server-only";

/** Headers for server-side API calls: the shared token lifts the anonymous rate limit for this server (see the
 *  backend's config/throttling.py). Never sent from the browser. */
export const INTERNAL_HEADERS: Record<string, string> = process.env.INTERNAL_API_TOKEN ? { "X-Internal-Token": process.env.INTERNAL_API_TOKEN } : {};

// Django API address. On a host without a local backend (e.g. Netlify before BACKEND_URL is set) there is no
// fallback: pages render without catalogue data instead of waiting on retries for an address that cannot answer.
// SKIP_BUILD_FETCH is set while the Docker image is built (the API container is not running yet); pages are then
// filled from the API at runtime through ISR (revalidate 60 s).
export const BACKEND = process.env.SKIP_BUILD_FETCH ? "" : process.env.BACKEND_URL || (process.env.NETLIFY || process.env.VERCEL ? "" : "http://127.0.0.1:8000");

/**
 * Server-side fetch for public pages (SEO). Returns null when the backend answers 404 (the page does not exist).
 * Network errors, 429 and 5xx are retried and then thrown, so a page is never cached with empty sections or as
 * "not found" because the API was briefly busy.
 */
export async function serverGet<T>(path: string, locale: string, revalidate = 60): Promise<T | null> {
  if (!BACKEND) return null;
  let last = "";
  // `next build` renders hundreds of pages at once; give the API more time there than for a single page at runtime.
  const attempts = process.env.NEXT_PHASE === "phase-production-build" ? 8 : 4;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(`${BACKEND}/api/v2${path}`, {
        headers: { "Accept-Language": locale, Accept: "application/json", ...INTERNAL_HEADERS },
        next: { revalidate },
      });
      if (res.ok) return (await res.json()) as T;
      // Only a real "not found" means the page does not exist. 429 / 5xx are temporary.
      if (res.status !== 429 && res.status < 500) return null;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = (e as Error).message;
    }
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  // The API stayed unreachable. Throwing (instead of returning null) matters under load: during a background
  // refresh Next.js then keeps serving the last good page, instead of caching a "not found" page for a minute.
  throw new Error(`API ${path} unavailable: ${last}`);
}

type SitemapKind = "hospitals" | "doctors" | "treatments" | "destinations" | "packages" | "posts" | "pages";

/**
 * Slugs for a detail page's generateStaticParams. When the API is reachable at `next build`, every page is
 * prebuilt, so the default-locale URLs without a prefix (rewritten by the i18n middleware) are served from the
 * static cache like the home page; Next.js does not cache on-demand ISR pages reached through that rewrite.
 * Returns [] without a backend (Docker image build): pages then render on demand (nginx micro-caches them).
 */
export async function staticSlugs(kind: SitemapKind): Promise<{ slug: string }[]> {
  if (!BACKEND) return [];
  try {
    const res = await fetch(`${BACKEND}/api/v2/public/sitemap/`, { headers: INTERNAL_HEADERS, next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<SitemapKind, { slug: string }[]>;
    return (data[kind] || []).filter((x) => x.slug).map((x) => ({ slug: x.slug }));
  } catch {
    return [];
  }
}

export function mediaUrl(url?: string | null) {
  if (!url) return null;
  // Django returns absolute URLs pointing at the backend host; rewrite to same-origin /media.
  const i = url.indexOf("/media/");
  return i >= 0 ? url.slice(i) : url;
}
