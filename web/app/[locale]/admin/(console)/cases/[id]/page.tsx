"use client";
import { useParams } from "next/navigation";
import { CaseWorkspace } from "@/components/admin/cases";
export default function Page() { const { id } = useParams<{ id: string }>(); return <CaseWorkspace key={id} id={Number(id)} />; }
