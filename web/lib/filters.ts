import { serverGet } from "./server";

export type Filters = {
  countries: { id: number; name: string; slug: string; flag: string }[];
  cities: { id: number; name: string; country: { slug: string } }[];
  specialties: { id: number; title: string; slug: string }[];
  treatments: { id: number; name: string; slug: string; specialty: number }[];
  accreditations: { code: string; name: string }[];
  hospital_types: { value: string; label: string }[];
  languages: string[];
};

export async function getFilters(locale: string) {
  return (await serverGet<Filters>("/public/filters/", locale)) ?? {
    countries: [], cities: [], specialties: [], treatments: [], accreditations: [], hospital_types: [], languages: [],
  };
}

export function toQuery(sp: Record<string, string | string[] | undefined>, allowed: string[]) {
  const q = new URLSearchParams();
  for (const k of allowed) {
    const v = sp[k];
    if (typeof v === "string" && v) q.set(k, v);
  }
  return q.toString() ? `?${q}` : "";
}
