"use client";

import { Bell, CalendarClock, FolderHeart, HeartPulse, LayoutDashboard, ListChecks, MessagesSquare, Receipt, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/shell";

export default function CabinetShell({ children }: { children: ReactNode }) {
  const t = useTranslations("dash");
  const u = useTranslations("dashUi");
  const c = useTranslations("chat");
  return (
    <PortalShell portal="dashboard" title={t("overview")} groups={[
      { items: [{ href: "/dashboard", label: t("overview"), icon: LayoutDashboard, exact: true }] },
      { id: "treatment", label: u("groupTreatment"), items: [
        { href: "/dashboard/cases", label: t("cases"), icon: HeartPulse },
        { href: "/dashboard/documents", label: t("documents"), icon: FolderHeart },
        { href: "/dashboard/quotations", label: t("quotations"), icon: Receipt, counter: "quotations" },
        { href: "/dashboard/travel", label: t("travel"), icon: CalendarClock },
        { href: "/dashboard/requests", label: t("requests"), icon: ListChecks },
      ] },
      { id: "account", label: u("groupAccount"), items: [
        { href: "/dashboard/support", label: c("nav"), icon: MessagesSquare, counter: "chat" },
        { href: "/dashboard/notifications", label: t("notifications"), icon: Bell, counter: "notifications" },
        { href: "/dashboard/profile", label: t("profile"), icon: UserRound },
      ] },
    ]}>{children}</PortalShell>
  );
}
