"use client";
import { useParams } from "next/navigation";
import { Patient360 } from "@/components/admin/patients";
export default function Page() { const { id } = useParams<{ id: string }>(); return <Patient360 key={id} id={Number(id)} />; }
