"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarClock, FolderHeart, HeartPulse, LayoutDashboard, ListChecks, MessagesSquare, Receipt, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("dash");
  const u = useTranslations("dashUi");
  const c = useTranslations("chat");
  const { user } = useAuth();
  const unread = useQuery({
    queryKey: ["me-chat-unread"], queryFn: () => api<{ count: number }>("/me/chat/unread/"),
    enabled: user?.portal === "dashboard", refetchInterval: 30_000,
  }).data?.count;
  return (
    <PortalShell portal="dashboard" title={t("overview")} groups={[
      { items: [{ href: "/dashboard", label: t("overview"), icon: LayoutDashboard, exact: true }] },
      { id: "treatment", label: u("groupTreatment"), items: [
        { href: "/dashboard/cases", label: t("cases"), icon: HeartPulse },
        { href: "/dashboard/documents", label: t("documents"), icon: FolderHeart },
        { href: "/dashboard/quotations", label: t("quotations"), icon: Receipt },
        { href: "/dashboard/travel", label: t("travel"), icon: CalendarClock },
        { href: "/dashboard/requests", label: t("requests"), icon: ListChecks },
      ] },
      { id: "account", label: u("groupAccount"), items: [
        { href: "/dashboard/support", label: c("nav"), icon: MessagesSquare, badge: unread },
        { href: "/dashboard/notifications", label: t("notifications"), icon: Bell },
        { href: "/dashboard/profile", label: t("profile"), icon: UserRound },
      ] },
    ]}>{children}</PortalShell>
  );
}
