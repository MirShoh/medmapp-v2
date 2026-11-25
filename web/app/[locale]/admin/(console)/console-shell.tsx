"use client";

import type { ReactNode } from "react";
import { useAdminNav } from "@/components/admin/nav";
import { PortalShell } from "@/components/portal/shell";

export default function ConsoleShell({ children }: { children: ReactNode }) {
  return <PortalShell portal="admin" groups={useAdminNav()} title="MedMapp Console">{children}</PortalShell>;
}
