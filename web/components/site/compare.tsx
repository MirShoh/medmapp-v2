"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GitCompareArrows, Plus, X, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Item = { id: number; name: string };
const EVENT = "mm-compare";

function key(kind: string) { return `medmapp.compare.${kind}`; }
export function readCompare(kind: string): Item[] {
  try { return JSON.parse(window.localStorage.getItem(key(kind)) || "[]"); } catch { return []; }
}
function write(kind: string, items: Item[]) {
  try { window.localStorage.setItem(key(kind), JSON.stringify(items)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}
export function useCompare(kind: string) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const sync = () => setItems(readCompare(kind));
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [kind]);
  return {
    items,
    has: (id: number) => items.some((i) => i.id === id),
    toggle: (it: Item) => write(kind, items.some((i) => i.id === it.id) ? items.filter((i) => i.id !== it.id) : [...items, it].slice(-4)),
    clear: () => write(kind, []),
  };
}

export function CompareToggle({ kind, item, className }: { kind: "hospitals" | "packages"; item: Item; className?: string }) {
  const t = useTranslations("common");
  const { has, toggle } = useCompare(kind);
  const on = has(item.id);
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); toggle(item); }}
      className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
        on ? "bg-teal-500 text-white" : "bg-mist text-ink-soft hover:bg-teal-50 hover:text-teal-700", className)}>
      {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />} {on ? t("inCompare") : t("addCompare")}
    </button>
  );
}

export function CompareBar({ kind }: { kind: "hospitals" | "packages" }) {
  const t = useTranslations();
  const { items, toggle, clear } = useCompare(kind);
  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
          className="fixed inset-x-0 bottom-4 z-40 mx-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl bg-navy-900 p-3 text-white shadow-lift">
          <div className="flex flex-wrap items-center gap-2">
            <GitCompareArrows className="ml-1 size-5 text-teal-300" />
            {items.map((i) => (
              <span key={i.id} className="flex items-center gap-1 rounded-lg bg-white/10 py-1 pl-2.5 pr-1 text-xs">
                {i.name}
                <button onClick={() => toggle(i)} className="rounded p-0.5 hover:bg-white/20" aria-label="Remove"><X className="size-3" /></button>
              </span>
            ))}
            <div className="ml-auto flex gap-2">
              <button onClick={clear} className="px-2 text-xs text-white/60 hover:text-white">{t("compare.clear")}</button>
              <Link href={`/${kind}/compare?ids=${items.map((i) => i.id).join(",")}`}
                className="rounded-lg bg-teal-500 px-4 py-2 text-xs font-bold hover:bg-teal-400">{t("common.compare")} ({items.length})</Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
