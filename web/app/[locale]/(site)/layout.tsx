import type { ReactNode } from "react";
import { AssistantWidget } from "@/components/site/assistant";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/site/json-ld";
import { SITE_URL, absUrl } from "@/lib/seo";
import { serverGet } from "@/lib/server";

type Site = { settings: { phone: string; email: string; address: string; socials: Record<string, string> } };

export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const site = await serverGet<Site>("/public/site/", locale, 3600);
  const st = site?.settings;
  const org = {
    "@context": "https://schema.org", "@type": "MedicalOrganization", "@id": `${SITE_URL}/#organization`,
    name: "MedMapp", legalName: "«MEDMAPP» MCHJ", url: SITE_URL, logo: `${SITE_URL}/icon-192.png`, image: `${SITE_URL}/og-default.png`,
    description: t("meta.description"), areaServed: ["UZ", "KZ", "KG", "TJ", "TM", "AZ", "RU"], knowsLanguage: ["uz", "ru", "en"],
    ...(st?.phone ? { telephone: st.phone } : {}), ...(st?.email ? { email: st.email } : {}),
    ...(st?.address ? { address: { "@type": "PostalAddress", streetAddress: st.address, addressCountry: "UZ" } } : { address: { "@type": "PostalAddress", addressCountry: "UZ" } }),
    sameAs: Object.values(st?.socials || {}).filter(Boolean),
  };
  const website = {
    "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: absUrl(locale, "/"), name: "MedMapp",
    inLanguage: locale, publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${absUrl(locale, "/hospitals")}?search={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
  return (
    <>
      <JsonLd data={[org, website]} />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">{t("ui.skip")}</a>
      <Header transparent />
      <main id="main">{children}</main>
      <Footer locale={locale} />
      <AssistantWidget />
    </>
  );
}
