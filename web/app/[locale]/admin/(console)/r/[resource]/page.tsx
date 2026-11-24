"use client";
import { useParams } from "next/navigation";
import { ResourceManager } from "@/components/admin/resource-manager";
export default function Page() {
  const { resource } = useParams<{ resource: string }>();
  return <ResourceManager key={resource} resource={resource} />;
}
