import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Separate output folders: production build in .next, dev server in .next-dev (start.ps1 -Dev).
  // Sharing one folder between `next build` and `next dev` can corrupt its manifests.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  // Django expects trailing slashes (APPEND_SLASH); do not let Next strip them on proxied /api calls.
  skipTrailingSlashRedirect: true,
  // ~700 catalogue pages are prebuilt; if the API drops a request mid-build, retry that page instead of failing.
  experimental: { staticGenerationRetryCount: 3, staticGenerationMaxConcurrency: 4 },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**.medmapp.uz" },
    ],
  },
  // Same-origin API: the browser talks to /api/*, Next proxies to Django.
  // Removed pages: keep old links and search results working.
  async redirects() {
    const moves: [string, string][] = [["/second-opinion", "/"], ["/services", "/how-it-works"], ["/services/:slug", "/how-it-works"], ["/contact", "/about#contact"]];
    return moves.flatMap(([from, to]) => [
      { source: from, destination: to, permanent: true },
      { source: `/:locale(ru|en)${from}`, destination: `/:locale${to === "/" ? "" : to}`, permanent: true },
    ]);
  },
  async rewrites() {
    return [
      // keep the trailing slash: Django routes end with "/" and ":path*" alone drops it
      { source: "/api/:path*/", destination: `${BACKEND_URL}/api/:path*/` },
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/media/:path*", destination: `${BACKEND_URL}/media/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Private areas must never appear in search results, in any language.
      ...["admin", "dashboard", "partner", "login", "register", "hospitals/compare", "packages/compare"].flatMap((p) => [`/${p}/:path*`, `/${p}`, `/:locale(ru|en)/${p}/:path*`, `/:locale(ru|en)/${p}`])
        .map((source) => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] })),
    ];
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
