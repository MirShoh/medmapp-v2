import { BadgeCheck, FileHeart, Lock, Route } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AuthShell, RegisterForm, SidePitch } from "@/components/auth-forms";
import { QuickSignUp } from "@/components/auth-quick";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale });
  return { title: t("auth.registerTitle"), robots: { index: false, follow: false } };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const features = [
    { icon: <BadgeCheck className="size-5" />, title: t("authUi.r1"), text: t("authUi.r1t") },
    { icon: <FileHeart className="size-5" />, title: t("authUi.f2"), text: t("authUi.f2t") },
    { icon: <Route className="size-5" />, title: t("authUi.f1"), text: t("authUi.f1t") },
    { icon: <Lock className="size-5" />, title: t("authUi.r4"), text: t("authUi.r4t") },
  ];
  return (
    <AuthShell tabs="register" title={t("auth.registerTitle")} subtitle={t("auth.registerSub")} side={<SidePitch title={t("authUi.sideTitleRegister")} features={features} />}>
      <RegisterForm />
      <Suspense><QuickSignUp /></Suspense>
      <p className="mt-6 text-center text-sm text-ink-soft">{t("auth.haveAccount")} <Link href="/login" className="font-semibold text-teal-700 hover:underline">{t("auth.signIn")}</Link></p>
    </AuthShell>
  );
}
