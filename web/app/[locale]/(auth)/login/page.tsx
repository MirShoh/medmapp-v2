import { Bell, FileHeart, MessagesSquare, Route } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AuthShell, SidePitch } from "@/components/auth-forms";
import { PatientSignIn } from "@/components/auth-quick";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale });
  return { title: t("auth.signIn"), robots: { index: false, follow: false } };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const features = [
    { icon: <Route className="size-5" />, title: t("authUi.f1"), text: t("authUi.f1t") },
    { icon: <FileHeart className="size-5" />, title: t("authUi.f2"), text: t("authUi.f2t") },
    { icon: <MessagesSquare className="size-5" />, title: t("authUi.f3"), text: t("authUi.f3t") },
    { icon: <Bell className="size-5" />, title: t("authUi.f4"), text: t("authUi.f4t") },
  ];
  return (
    <AuthShell tabs="login" title={t("auth.loginTitle")} subtitle={t("auth.loginSub")} side={<SidePitch title={t("authUi.sideTitle")} features={features} />}>
      <Suspense><PatientSignIn /></Suspense>
      <p className="mt-6 text-center text-sm text-ink-soft">{t("auth.noAccount")} <Link href="/register" className="font-semibold text-teal-700 hover:underline">{t("auth.register")}</Link></p>
      <div className="mt-6 rounded-2xl bg-mist px-4 py-3 text-center text-xs text-ink-muted">
        {t("authUi.partnerQ")} <Link href="/partner/login" className="font-semibold text-navy-900 hover:underline">{t("auth.partnerLogin")}</Link>
      </div>
    </AuthShell>
  );
}
