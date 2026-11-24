import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AuthShell, LoginForm, SidePitch } from "@/components/auth-forms";

export default async function AdminLogin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <AuthShell title={t("auth.staffLogin")} side={<SidePitch title="MedMapp Console" items={[t("admin.crm"), t("admin.cases"), t("admin.finance"), t("admin.audit")]} />}>
      <Suspense><LoginForm portal="admin" /></Suspense>
    </AuthShell>
  );
}
