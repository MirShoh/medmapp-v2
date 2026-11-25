"use client";

import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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

  const control = (f: FilterField) => {
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
      <LiveInput key={f.name} field={f} value={value} pending={pending} onChange={(v) => set(f.name, v)}
        className={cn("min-w-0 flex-1", row ? "lg:flex-[1.4]" : "lg:w-44 lg:flex-none")} />
    );
  };
  // The text search stays visible on phones; the other filters fold behind the "Filters" button.
  const search = fields.filter((f) => f.type === "text");
  const rest = fields.filter((f) => f.type !== "text");
  const restActive = rest.filter((f) => params.get(f.name)).length;

  return (
    <div className={cn("card sticky top-20 z-20 p-3 transition lg:flex lg:items-center lg:gap-2", row ? "lg:flex-nowrap" : "lg:flex-wrap", pending && "opacity-80")}>
      <div className="flex items-center gap-2 lg:contents">
        {search.map(control)}
        {rest.length > 0 && (
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className={cn("flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold lg:hidden",
              open || restActive ? "border-teal-500 text-teal-700" : "border-line-strong text-navy-900", !search.length && "flex-1 justify-center")}>
            <SlidersHorizontal className="size-4" />{(!search.length || !restActive) && t("filters")}
            {restActive > 0 && <span className="rounded-full bg-teal-500 px-1.5 text-xs text-white">{restActive}</span>}
          </button>
        )}
      </div>
      <div className={cn("mt-2 grid gap-2 sm:grid-cols-2 lg:contents", !open && "hidden")}>
        {rest.map(control)}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 lg:contents">
        {total !== undefined && <span className="text-xs text-ink-muted lg:order-last lg:ml-auto lg:shrink-0 lg:whitespace-nowrap lg:pl-2 lg:font-semibold">{total} {t("results")}</span>}
        {active > 0 && (
          <button onClick={() => start(() => router.replace(pathname, { scroll: false }))} className="flex shrink-0 items-center gap-1 px-2 text-sm text-ink-muted hover:text-danger lg:h-11">
            <X className="size-4" /> {t("reset")}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Search box that filters while you type: the URL (and so the server-rendered list) updates 300 ms after the last
 * key press. Enter applies at once, the X clears. Keeps its own text so typing is never interrupted by the reload.
 */
function LiveInput({ field, value, pending, onChange, className }: {
  field: Extract<FilterField, { type: "number" | "text" }>; value: string; pending: boolean; onChange: (v: string) => void; className?: string;
}) {
  const [text, setText] = useState(value);
  const last = useRef(value);
  // a reset or back/forward navigation changes the URL from outside: show that value
  useEffect(() => {
    if (value !== last.current) { last.current = value; setText(value); }
  }, [value]);
  useEffect(() => {
    if (text.trim() === last.current) return;
    if (field.type === "text" && text.trim().length === 1) return; // one letter matches nearly everything
    const id = setTimeout(() => { last.current = text.trim(); onChange(text.trim()); }, 300);
    return () => clearTimeout(id);
  }, [text, field.type, onChange]);
  const isText = field.type === "text";
  return (
    <label className={cn("relative flex items-center", className)}>
      {isText && (pending && text
        ? <Loader2 className="pointer-events-none absolute left-3 size-4 animate-spin text-teal-600" />
        : <Search className="pointer-events-none absolute left-3 size-4 text-ink-muted" />)}
      <input type={field.type} value={text} placeholder={field.placeholder || field.label} aria-label={field.label}
        inputMode={field.type === "number" ? "numeric" : "search"} enterKeyHint="search" autoComplete="off"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { last.current = text.trim(); onChange(text.trim()); } }}
        className={cn("h-11 w-full rounded-xl border bg-white text-sm outline-none focus:border-teal-500", isText ? "pl-9 pr-9" : "pl-3 pr-3",
          value ? "border-teal-500" : "border-line-strong")} />
      {isText && text && (
        <button type="button" aria-label="Clear" onClick={() => { setText(""); last.current = ""; onChange(""); }}
          className="absolute right-2 grid size-7 place-items-center rounded-lg text-ink-muted hover:bg-mist hover:text-navy-900">
          <X className="size-4" />
        </button>
      )}
    </label>
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
