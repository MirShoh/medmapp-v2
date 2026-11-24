"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type PickOption = { value: string; label: string; hint?: string; lead?: ReactNode };

/**
 * Styled single-select with optional search, full keyboard support and a clear button.
 * Replaces native <select> where the look matters (hero search); value "" means "nothing chosen".
 */
export function Pick({ value, onChange, options, placeholder, icon, searchPlaceholder, emptyText, label, className }: {
  value: string; onChange: (v: string) => void; options: PickOption[]; placeholder: string; icon?: ReactNode;
  searchPlaceholder?: string; emptyText?: string; label: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value);
  const searchable = options.length > 7;
  const shown = useMemo(() => {
    const s = q.trim().toLocaleLowerCase();
    return s ? options.filter((o) => o.label.toLocaleLowerCase().includes(s)) : options;
  }, [q, options]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    const i = Math.max(0, shown.findIndex((o) => o.value === value));
    setActive(i);
    // preventScroll: focusing must not move the page (it made the hero jump when the list opened)
    requestAnimationFrame(() => (searchable ? search.current : list.current)?.focus({ preventScroll: true }));
    return () => document.removeEventListener("mousedown", close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    // Scroll only inside the list; element.scrollIntoView() would also scroll the whole page.
    const box = list.current, el = box?.querySelector<HTMLElement>(`[data-i="${active}"]`);
    if (!box || !el) return;
    if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight;
  }, [active]);

  const choose = (v: string) => { onChange(v); setOpen(false); setQ(""); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(shown[active].value); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  };

  return (
    <div ref={root} className={cn("relative", className)}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); } }}
        className={cn("flex h-14 w-full items-center gap-3 rounded-xl px-3.5 text-left transition hover:bg-mist", open && "bg-mist")}>
        {icon && <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-teal-50 text-lg leading-none text-teal-600">{selected?.lead || icon}</span>}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
          <span className={cn("block truncate text-sm font-semibold", selected ? "text-navy-900" : "text-ink-soft")}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        {selected ? (
          <span role="button" tabIndex={-1} aria-label="Clear" onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="grid size-6 place-items-center rounded-full text-ink-muted hover:bg-line hover:text-navy-900"><X className="size-3.5" /></span>
        ) : <ChevronDown className={cn("size-4 shrink-0 text-ink-muted transition", open && "rotate-180")} />}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[60] min-w-[16rem] overflow-hidden rounded-2xl border border-line bg-white text-navy-900 shadow-lift">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-line px-3.5">
              <Search className="size-4 text-ink-muted" />
              <input ref={search} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey}
                placeholder={searchPlaceholder} className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-ink-muted" />
            </div>
          )}
          <ul ref={list} id={id} role="listbox" tabIndex={-1} onKeyDown={onKey} aria-label={label}
            className="scrollbar-thin relative max-h-[19rem] overflow-y-auto p-1.5 outline-none">
            {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-muted">{emptyText}</li>}
            {shown.map((o, i) => (
              <li key={o.value} data-i={i} role="option" aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)} onClick={() => choose(o.value)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                  i === active ? "bg-teal-50" : "", o.value === value && "font-semibold")}>
                {o.lead && <span className="w-6 shrink-0 text-center text-lg leading-none">{o.lead}</span>}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-ink-muted">{o.hint}</span>}
                {o.value === value && <Check className="size-4 shrink-0 text-teal-600" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
