import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["uz", "ru", "en"],
  defaultLocale: "uz",
  localePrefix: "as-needed",
  // SEO: every URL always shows the same language (no redirects by browser language), matching the hreflang tags.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
