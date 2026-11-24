import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const PRIVATE = ["/admin", "/dashboard", "/partner", "/login", "/register", "/api/", "/hospitals/compare", "/packages/compare"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...PRIVATE, ...["ru", "en"].flatMap((l) => PRIVATE.map((p) => `/${l}${p}`))] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
