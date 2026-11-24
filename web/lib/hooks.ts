"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type Staff = { id: number; name: string; role: string };
export type RefFilters = {
  countries: { id: number; name: string; slug: string; flag: string }[];
  specialties: { id: number; title: string; slug: string }[];
  treatments: { id: number; name: string; slug: string; specialty: number }[];
};

export function useStaff() {
  return useQuery({ queryKey: ["staff"], queryFn: () => api<Staff[]>("/admin/staff/"), staleTime: 300_000 }).data || [];
}

export function useRefFilters() {
  return useQuery({ queryKey: ["ref-filters"], queryFn: () => api<RefFilters>("/public/filters/"), staleTime: 300_000 }).data;
}

export function useHospitalsLite() {
  return useQuery({
    queryKey: ["hospitals-lite"],
    queryFn: () => api<{ results: { id: number; name: string }[] }>("/admin/hospitals/?page_size=500&ordering=name"),
    staleTime: 300_000,
  }).data?.results || [];
}
