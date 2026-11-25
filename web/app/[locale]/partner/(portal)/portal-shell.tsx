"use client";

import { Bell, Building2, Inbox, LayoutDashboard } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/shell";

export default function PartnerShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  return (
    <PortalShell portal="partner" title={t("auth.partnerLogin")} groups={[{ items: [
      { href: "/partner", label: t("partner.home"), icon: LayoutDashboard, exact: true },
      { href: "/partner/referrals", label: t("partner.referrals"), icon: Inbox, counter: "referrals" },
      { href: "/partner/profile", label: t("partner.profile"), icon: Building2 },
      { href: "/partner/notifications", label: t("dash.notifications"), icon: Bell, counter: "notifications" },
    ] }]}>{children}</PortalShell>
  );
}
