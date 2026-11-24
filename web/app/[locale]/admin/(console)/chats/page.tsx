"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StaffChats } from "@/components/chat";

function Chats() {
  const p = Number(useSearchParams().get("patient")) || undefined;
  return <StaffChats initial={p} />;
}

export default function Page() {
  return <Suspense><Chats /></Suspense>;
}
