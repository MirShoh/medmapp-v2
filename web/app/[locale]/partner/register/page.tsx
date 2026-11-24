import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell, PartnerRegisterForm, SidePitch } from "@/components/auth-forms";

export default async function PartnerRegister({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <AuthShell title={t("auth.partnerRegister")} subtitle={t("auth.pending")} side={<SidePitch title={t("footer.partners")} items={[t("partner.referrals"), t("partner.sharedDocs"), t("partner.messages")]} />}>
      <PartnerRegisterForm />
    </AuthShell>
  );
}
