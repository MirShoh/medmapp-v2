"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type FilterField =
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { name: string; label: string; type: "number" | "text"; placeholder?: string }
  | { name: string; label: string; type: "toggle" };

export function FilterBar({ fields, total }: { fields: FilterField[]; total?: number }) {
  const t = useTranslations("common");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const set = (name: string, value: string) => {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(name, value); else p.delete(name);
    p.delete("page");
    start(() => router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false }));
  };
  const active = fields.filter((f) => params.get(f.name)).length;
  // Short filter sets (≤ 5) sit on one line on desktop, each control stretching to fill it.
  const row = fields.length <= 5;

  return (
    <div className={cn("card sticky top-20 z-20 p-3 transition", pending && "opacity-70")}>
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <SlidersHorizontal className="size-4" /> {t("filters")} {active > 0 && <span className="rounded-full bg-teal-500 px-1.5 text-xs text-white">{active}</span>}
        </button>
        {total !== undefined && <span className="text-xs text-ink-muted">{total} {t("results")}</span>}
      </div>
      <div className={cn("mt-3 grid gap-2 sm:grid-cols-2 lg:mt-0 lg:flex lg:items-center", row ? "lg:flex-nowrap" : "lg:flex-wrap", !open && "hidden lg:flex")}>
        {fields.map((f) => {
          const value = params.get(f.name) || "";
          if (f.type === "select") {
            return (
              <select key={f.name} aria-label={f.label} value={value} onChange={(e) => set(f.name, e.target.value)}
                className={cn("h-11 rounded-xl border bg-white px-3 text-sm outline-none focus:border-teal-500", row ? "lg:min-w-0 lg:flex-1" : "lg:max-w-52",
                  value ? "border-teal-500 font-semibold text-teal-700" : "border-line-strong text-ink-soft")}>
                <option value="">{f.label}: {t("all")}</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            );
          }
          if (f.type === "toggle") {
            return (
              <button key={f.name} onClick={() => set(f.name, value ? "" : "1")}
                className={cn("h-11 whitespace-nowrap rounded-xl border px-3 text-sm font-medium", value ? "border-teal-500 bg-teal-50 text-teal-700" : "border-line-strong text-ink-soft")}>
                {f.label}
              </button>
            );
          }
          return (
            <label key={f.name} className={cn("relative flex items-center", row ? "lg:min-w-0 lg:flex-[1.4]" : "lg:w-44")}>
              {f.type === "text" && <Search className="pointer-events-none absolute left-3 size-4 text-ink-muted" />}
              <input type={f.type} defaultValue={value} placeholder={f.placeholder || f.label} aria-label={f.label}
                onKeyDown={(e) => e.key === "Enter" && set(f.name, (e.target as HTMLInputElement).value)}
                onBlur={(e) => e.target.value !== value && set(f.name, e.target.value)}
                className={cn("h-11 w-full rounded-xl border border-line-strong bg-white pr-3 text-sm outline-none focus:border-teal-500", f.type === "text" ? "pl-9" : "pl-3")} />
            </label>
          );
        })}
        {active > 0 && (
          <button onClick={() => start(() => router.replace(pathname, { scroll: false }))} className="flex h-11 shrink-0 items-center gap-1 px-2 text-sm text-ink-muted hover:text-danger">
            <X className="size-4" /> {t("reset")}
          </button>
        )}
        {total !== undefined && <span className="ml-auto hidden shrink-0 whitespace-nowrap pl-2 text-xs font-semibold text-ink-muted lg:block">{total} {t("results")}</span>}
      </div>
    </div>
  );
}

export function Pager({ count, pageSize = 24 }: { count: number; pageSize?: number }) {
  const t = useTranslations("common");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const page = Number(params.get("page") || 1);
  const pages = Math.ceil(count / pageSize);
  if (pages <= 1) return null;
  const go = (p: number) => {
    const q = new URLSearchParams(params.toString());
    q.set("page", String(p));
    router.push(`${pathname}?${q}`);
  };
  return (
    <div className="mt-10 flex items-center justify-center gap-3 text-sm">
      <button disabled={page <= 1} onClick={() => go(page - 1)} className="rounded-xl border border-line-strong bg-white px-4 py-2 disabled:opacity-40">{t("back")}</button>
      <span className="text-ink-muted">{t("page")} {page} / {pages}</span>
      <button disabled={page >= pages} onClick={() => go(page + 1)} className="rounded-xl border border-line-strong bg-white px-4 py-2 disabled:opacity-40">{t("next")}</button>
    </div>
  );
}
