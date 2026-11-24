"use client";

import { useEffect } from "react";
import { AdminDashboard } from "@/components/admin/dashboard";
import { useAdminNav } from "@/components/admin/nav";
import { LoadingBlock } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";

export default function Page() {
  const { can } = useAuth();
  const nav = useAdminNav();
  const router = useRouter();
  const allowed = can("dashboard.view");
  useEffect(() => {
    if (allowed) return;
    // Roles without dashboard access (e.g. Content Manager) land on their first permitted section.
    const first = nav.flatMap((g) => g.items).find((i) => i.href !== "/admin" && (!i.perm || can(i.perm)));
    router.replace(first?.href || "/admin/notifications");
  }, [allowed, nav, can, router]);
  return allowed ? <AdminDashboard /> : <LoadingBlock />;
}
