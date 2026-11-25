import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { publicMessages } from "@/i18n/client-messages";
import { routing } from "@/i18n/routing";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";
import "../globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    // No canonical here: pages set their own (an inherited one would point every page at the home page).
    description: t("meta.description"),
    openGraph: { type: "website", siteName: "MedMapp", locale: { uz: "uz_UZ", ru: "ru_RU", en: "en_US" }[locale], images: [{ url: OG_IMAGE, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [OG_IMAGE] },
    metadataBase: new URL(SITE_URL),
    title: { default: t("meta.homeTitle"), template: "%s · MedMapp" },
    keywords: t("meta.keywords").split(",").map((k) => k.trim()),
    applicationName: "MedMapp",
    category: "health",
    formatDetection: { telephone: false },
    // Search Console / Yandex Webmaster ownership tokens (set in .env when the site is registered).
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
      yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || undefined,
    },
    icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon-192.png", type: "image/png", sizes: "192x192" }], apple: "/apple-icon.png" },
  };
}

export const viewport: Viewport = { themeColor: "#0b2545", width: "device-width", initialScale: 1 };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // public namespaces only; portal layouts add the rest (i18n/client-messages.ts)
  const messages = publicMessages(await getMessages({ locale }));
  return (
    <html lang={locale} className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
