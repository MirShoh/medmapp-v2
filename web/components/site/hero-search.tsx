"use client";

import { Globe2, Search, Stethoscope } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Pick } from "./pick";

export function HeroSearch({ treatments, countries }: { treatments: { slug: string; name: string }[]; countries: { slug: string; name: string; flag: string }[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [treatment, setTreatment] = useState("");
  const [country, setCountry] = useState("");
  const go = () => {
    if (treatment && !country) return router.push(`/treatments/${treatment}`);
    const p = new URLSearchParams();
    if (treatment) p.set("treatment", treatment);
    if (country) p.set("country", country);
    router.push(`/hospitals${p.toString() ? `?${p}` : ""}`);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); go(); }}
      className="mt-8 grid gap-1 rounded-2xl bg-white p-2 text-navy-900 shadow-lift sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] sm:items-center">
      <Pick label={t("ui.searchWhat")} value={treatment} onChange={setTreatment} placeholder={t("home.searchTreatment")}
        icon={<Stethoscope className="size-4" />} searchPlaceholder={t("ui.typeToSearch")} emptyText={t("ui.nothingFound")}
        options={treatments.map((x) => ({ value: x.slug, label: x.name }))} />
      <Pick label={t("ui.searchWhere")} value={country} onChange={setCountry} placeholder={t("home.searchCountry")}
        icon={<Globe2 className="size-4" />} searchPlaceholder={t("ui.typeToSearch")} emptyText={t("ui.nothingFound")}
        className="sm:border-l sm:border-line sm:pl-1"
        options={countries.map((c) => ({ value: c.slug, label: c.name, lead: c.flag }))} />
      <button className="flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 text-sm font-bold text-white transition hover:bg-teal-600 sm:h-14">
        <Search className="size-4" /><span className="whitespace-nowrap">{t("ui.searchBtn")}</span>
      </button>
    </form>
  );
}
