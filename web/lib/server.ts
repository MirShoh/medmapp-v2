import "server-only";

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";

/**
 * Server-side fetch for public pages (SEO). Returns null when the backend answers 404 or stays unreachable.
 * Network errors and 5xx are retried (the build renders many pages at once and the dev backend can drop a request);
 * without this a page could be cached with empty sections.
 */
export async function serverGet<T>(path: string, locale: string, revalidate = 60): Promise<T | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BACKEND}/api/v2${path}`, {
        headers: { "Accept-Language": locale, Accept: "application/json" },
        next: { revalidate },
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status < 500) return null;
    } catch {
      /* retry below */
    }
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  return null;
}

export function mediaUrl(url?: string | null) {
  if (!url) return null;
  // Django returns absolute URLs pointing at the backend host; rewrite to same-origin /media.
  const i = url.indexOf("/media/");
  return i >= 0 ? url.slice(i) : url;
}
