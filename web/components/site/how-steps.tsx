"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, ClipboardCheck, Clock3, FileText, HeartPulse, PlaneTakeoff, Plane, Sparkles, UserRound, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ConsultButton } from "./hero-actions";

type Step = { title: string; you: string; we: string; time: string };
type Mode = "abroad" | "home";
// request · medical records · offers to compare · travel · treatment
const ICONS = [MessageSquareText, FileText, ClipboardCheck, Plane, HeartPulse];

/** Interactive "how it works": two journeys (treatment abroad / in Uzbekistan), five clickable steps. */
export function HowSteps({ steps, labels }: {
  steps: Record<Mode, Step[]>;
  labels: { modeAbroad: string; modeHome: string; modeAbroadHint: string; modeHomeHint: string; you: string; we: string; time: string; step: string; prev: string; next: string; start: string };
}) {
  const [mode, setMode] = useState<Mode>("abroad");
  const [i, setI] = useState(0);
  const list = steps[mode];
  const s = list[i];
  const Icon = ICONS[i] || Sparkles;

  return (
    <div>
      {/* journey switch */}
      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-card" role="tablist">
        {(["abroad", "home"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setI(0); }}
            className={cn("rounded-xl px-4 py-3 text-left transition", mode === m ? "bg-navy-900 text-white shadow-lift" : "text-navy-900 hover:bg-mist")}>
            <span className="flex items-start gap-3">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", mode === m ? "bg-teal-500 text-white" : "bg-teal-50 text-teal-600")}>
                {m === "abroad" ? <PlaneTakeoff className="size-5" /> : <Building2 className="size-5" />}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-bold">{m === "abroad" ? labels.modeAbroad : labels.modeHome}</span>
                <span className={cn("mt-0.5 block text-xs leading-snug", mode === m ? "text-white/65" : "text-ink-muted")}>{m === "abroad" ? labels.modeAbroadHint : labels.modeHomeHint}</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* progress rail */}
      <ol className="relative mx-auto mt-10 grid max-w-5xl grid-cols-5">
        <span className="absolute left-[10%] right-[10%] top-6 h-1 rounded-full bg-line" aria-hidden />
        <motion.span className="absolute left-[10%] top-6 h-1 rounded-full bg-gradient-to-r from-teal-500 to-green-500" aria-hidden
          animate={{ width: `${(i / (list.length - 1)) * 80}%` }} transition={{ type: "spring", damping: 26, stiffness: 200 }} />
        {list.map((x, k) => {
          const I = ICONS[k] || Sparkles;
          const state = k < i ? "done" : k === i ? "now" : "next";
          return (
            <li key={x.title} className="relative flex flex-col items-center text-center">
              <button onClick={() => setI(k)} aria-current={state === "now" ? "step" : undefined} aria-label={`${labels.step} ${k + 1}: ${x.title}`}
                className={cn("relative grid size-12 place-items-center rounded-2xl border-2 transition",
                  state === "now" ? "scale-110 border-teal-500 bg-teal-500 text-white shadow-glow"
                    : state === "done" ? "border-green-500 bg-green-500 text-white" : "border-line bg-white text-ink-muted hover:border-teal-300 hover:text-teal-600")}>
                <I className="size-5" />
              </button>
              <button onClick={() => setI(k)} className={cn("mt-3 max-w-[9rem] text-[13px] font-semibold leading-snug transition sm:text-sm",
                state === "now" ? "text-navy-900" : "text-ink-muted hover:text-navy-900")}>
                <span className="hidden sm:inline">{x.title}</span><span className="sm:hidden">{k + 1}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* step detail */}
      <div className="mx-auto mt-10 max-w-5xl">
        <AnimatePresence mode="wait">
          <motion.div key={`${mode}-${i}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
            className="overflow-hidden rounded-3xl border border-line bg-white shadow-lift">
            <div className="bg-hero relative flex flex-wrap items-center gap-4 px-6 py-6 text-white sm:px-10">
              <div className="bg-grid pointer-events-none absolute inset-0" />
              <span className="relative grid size-14 place-items-center rounded-2xl bg-teal-500 shadow-glow"><Icon className="size-6" /></span>
              <div className="relative min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-green-300">{labels.step} {i + 1} / {list.length}</div>
                <h3 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">{s.title}</h3>
              </div>
              <span className="relative inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold ring-1 ring-white/20">
                <Clock3 className="size-4 text-green-300" />{labels.time}: {s.time}
              </span>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-10">
              <div className="rounded-2xl bg-mist p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-navy-900"><UserRound className="size-4 text-teal-600" />{labels.you}</div>
                <p className="mt-2 text-[15px] leading-relaxed text-ink">{s.you}</p>
              </div>
              <div className="rounded-2xl bg-teal-50 p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-navy-900"><Sparkles className="size-4 text-teal-600" />{labels.we}</div>
                <p className="mt-2 text-[15px] leading-relaxed text-ink">{s.we}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-10">
              <button onClick={() => setI((k) => Math.max(0, k - 1))} disabled={i === 0}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-soft transition hover:bg-mist disabled:opacity-40">
                <ArrowLeft className="size-4" />{labels.prev}
              </button>
              {i < list.length - 1 ? (
                <button onClick={() => setI((k) => k + 1)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition hover:bg-navy-800">
                  {labels.next}<ArrowRight className="size-4" />
                </button>
              ) : <ConsultButton label={labels.start} source="how_it_works" />}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
