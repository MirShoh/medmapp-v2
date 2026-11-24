"use client";

import {
  Activity, Award, BarChart3, BookOpen, Building2, ClipboardList, Coins, FileText, Flag, Globe2, HeartPulse,
  KanbanSquare, Landmark, LayoutDashboard, LayoutTemplate, ListTodo, MapPin, MessageSquareQuote, MessagesSquare, Newspaper, Package, Plane, Plug,
  Receipt, ScrollText, Settings, ShieldCheck, SlidersHorizontal, Stethoscope, Tags, UserCog, Users, Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { NavGroup } from "@/components/portal/shell";

/**
 * Admin sidebar. Daily work (CRM, medical, catalog, content) stays open; rarely used reference data and system
 * settings are folded into collapsed groups. Notifications live in the header bell.
 */
export function useAdminNav(): NavGroup[] {
  const t = useTranslations("admin");
  const r = (res: string) => `/admin/r/${res}`;
  return [
    { items: [{ href: "/admin", label: t("dashboard"), icon: LayoutDashboard, perm: "dashboard.view", exact: true }] },
    { id: "crm", label: t("groupCrm"), items: [
      { href: "/admin/crm", label: t("crm"), icon: KanbanSquare, perm: "crm.view" },
      { href: "/admin/chats", label: t("chats"), icon: MessagesSquare, perm: "crm.view" },
      { href: "/admin/patients", label: t("patients"), icon: Users, perm: "patients.view" },
      { href: "/admin/tasks", label: t("tasks"), icon: ListTodo, perm: "tasks.view" },
    ] },
    { id: "medical", label: t("groupMedical"), items: [
      { href: "/admin/cases", label: t("cases"), icon: HeartPulse, perm: "medical.view" },
      { href: "/admin/documents", label: t("documents"), icon: FileText, perm: "documents.view" },
      { href: "/admin/quotations", label: t("quotations"), icon: Receipt, perm: "quotations.view" },
      { href: "/admin/travel", label: t("travel"), icon: Plane, perm: "travel.view" },
    ] },
    { id: "catalog", label: t("groupCatalog"), items: [
      { href: r("hospitals"), label: t("hospitals"), icon: Building2, perm: "catalog.view" },
      { href: r("doctors"), label: t("doctors"), icon: Stethoscope, perm: "catalog.view" },
      { href: r("treatment-prices"), label: t("prices"), icon: Coins, perm: "catalog.view" },
      { href: r("packages"), label: t("packages"), icon: Package, perm: "catalog.view" },
      { href: r("treatments"), label: t("treatments"), icon: Activity, perm: "catalog.view" },
    ] },
    { id: "reference", label: t("groupReference"), collapsed: true, items: [
      { href: r("countries"), label: t("countries"), icon: Globe2, perm: "catalog.view" },
      { href: r("cities"), label: t("cities"), icon: MapPin, perm: "catalog.view" },
      { href: r("specialties"), label: t("specialties"), icon: Tags, perm: "catalog.view" },
      { href: r("accreditations"), label: t("accreditations"), icon: Award, perm: "catalog.view" },
    ] },
    { id: "content", label: t("groupContent"), items: [
      { href: r("blog-posts"), label: t("blog"), icon: Newspaper, perm: "blog.edit" },
      { href: r("faqs"), label: t("faqs"), icon: ClipboardList, perm: "cms.edit" },
      { href: r("testimonials"), label: t("testimonials"), icon: MessageSquareQuote, perm: "cms.edit" },
      { href: r("reviews"), label: t("reviews"), icon: ShieldCheck, perm: "cms.edit" },
      { href: r("pages"), label: t("pages"), icon: BookOpen, perm: "cms.edit" },
      { href: r("blog-categories"), label: t("blogCategories"), icon: Tags, perm: "blog.edit" },
    ] },
    { id: "business", label: t("groupBusiness"), items: [
      { href: "/admin/finance", label: t("finance"), icon: Wallet, perm: "finance.view" },
      { href: "/admin/reports", label: t("reports"), icon: BarChart3, perm: "reports.view" },
    ] },
    { id: "system", label: t("groupSystem"), collapsed: true, items: [
      { href: r("site-settings"), label: t("siteSettings"), icon: Settings, perm: "cms.edit" },
      { href: r("sections"), label: t("sections"), icon: LayoutTemplate, perm: "cms.edit" },
      { href: r("nav"), label: t("nav"), icon: Flag, perm: "cms.edit" },
      { href: r("banners"), label: t("banners"), icon: Landmark, perm: "cms.edit" },
      { href: "/admin/users", label: t("users"), icon: UserCog, perm: "users.view" },
      { href: "/admin/integrations", label: t("integrations"), icon: Plug, perm: "integrations.view" },
      { href: r("lead-sources"), label: t("leadSources"), icon: SlidersHorizontal, perm: "settings.edit" },
      { href: "/admin/audit", label: t("audit"), icon: ScrollText, perm: "audit.view" },
    ] },
  ];
}
