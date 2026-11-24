"use client";
import { useParams } from "next/navigation";
import { PartnerReferral } from "@/components/partner/portal";
export default function Page() { const { id } = useParams<{ id: string }>(); return <PartnerReferral key={id} id={Number(id)} />; }
