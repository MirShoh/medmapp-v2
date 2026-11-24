"use client";
import { useParams } from "next/navigation";
import { PatientCaseDetail } from "@/components/dashboard/patient";
export default function Page() { const { id } = useParams<{ id: string }>(); return <PatientCaseDetail key={id} id={Number(id)} />; }
