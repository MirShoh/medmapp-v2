"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StaffChats } from "@/components/chat";

function Chats() {
  const sp = useSearchParams();
  return <StaffChats initial={Number(sp.get("patient")) || undefined} initialVisitor={Number(sp.get("visitor")) || undefined} />;
}

export default function Page() {
  return <Suspense><Chats /></Suspense>;
}
