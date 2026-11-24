import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AuthShell, LoginForm, SidePitch } from "@/components/auth-forms";
import { Link } from "@/i18n/navigation";

export default async function PartnerLogin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <AuthShell title={t("auth.partnerLogin")} side={<SidePitch title={t("auth.partnerLogin")} items={[t("partner.referrals"), t("partner.submitOpinion"), t("partner.submitQuote"), t("partner.sharedDocs")]} />}>
      <Suspense><LoginForm portal="partner" /></Suspense>
      <p className="mt-6 text-sm text-ink-soft"><Link href="/partner/register" className="font-semibold text-teal-700">{t("auth.partnerRegister")}</Link></p>
    </AuthShell>
  );
}
