"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Building2, Inbox, LayoutDashboard } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function PartnerLayout({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { user } = useAuth();
  const fresh = useQuery({
    queryKey: ["partner-new-count"], queryFn: () => api<{ count: number }>("/partner/referrals/?status=sent&page_size=1"),
    enabled: user?.portal === "partner", refetchInterval: 60_000,
  }).data?.count;
  return (
    <PortalShell portal="partner" title={t("auth.partnerLogin")} groups={[{ items: [
      { href: "/partner", label: t("partner.home"), icon: LayoutDashboard, exact: true },
      { href: "/partner/referrals", label: t("partner.referrals"), icon: Inbox, badge: fresh },
      { href: "/partner/profile", label: t("partner.profile"), icon: Building2 },
      { href: "/partner/notifications", label: t("dash.notifications"), icon: Bell },
    ] }]}>{children}</PortalShell>
  );
}
