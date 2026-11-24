"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock3, MessagesSquare, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConsultButton } from "@/components/site/hero-actions";
import { cn } from "@/lib/utils";

type Item = { id: number; question: string; answer: string };

/** Opens the floating support widget (components/site/assistant.tsx), optionally with a question already asked. */
export function openSupport(question?: string) {
  window.dispatchEvent(new CustomEvent("mm:open-support", { detail: { question } }));
}

/** Home page FAQ: heading + "still have a question?" card on the left (sticky), accordion on the right. */
export function FaqSection({ title, subtitle, items }: { title: string; subtitle: string; items: Item[] }) {
  const t = useTranslations("faqUi");
  const [open, setOpen] = useState<number | null>(items[0]?.id ?? null);
  return (
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="eyebrow mb-3">FAQ</div>
        <h2 className="h-section">{title}</h2>
        <p className="lead mt-3">{subtitle}</p>
        <div className="mt-8 rounded-3xl bg-navy-950 p-6 text-white">
          <div className="flex items-center gap-3">
            <span className="relative grid size-11 place-items-center rounded-2xl bg-teal-500"><MessagesSquare className="size-5" />
              <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-green-400 ring-2 ring-navy-950" /></span>
            <div>
              <div className="font-display text-lg font-bold text-white">{t("noAnswer")}</div>
              <div className="flex items-center gap-1.5 text-xs text-white/60"><Clock3 className="size-3.5" />{t("replyTime")}</div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/70">{t("noAnswerText")}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => openSupport()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-navy-900 transition hover:bg-teal-50">
              <MessagesSquare className="size-4 text-teal-600" />{t("askOperator")}
            </button>
            <ConsultButton source="faq" className="h-10" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((f, i) => {
          const isOpen = open === f.id;
          return (
            <div key={f.id} className={cn("rounded-2xl border bg-white transition", isOpen ? "border-teal-200 shadow-card" : "border-line hover:border-line-strong")}>
              <h3>
                <button type="button" onClick={() => setOpen(isOpen ? null : f.id)} aria-expanded={isOpen}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold transition", isOpen ? "bg-teal-500 text-white" : "bg-mist text-ink-muted")}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 font-display font-semibold text-navy-900">{f.question}</span>
                  <Plus className={cn("size-5 shrink-0 text-teal-600 transition", isOpen && "rotate-45")} />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <p className="whitespace-pre-line px-5 pb-5 pl-[4.25rem] text-sm leading-relaxed text-ink-soft">{f.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
