"use client";

import { Check, CheckCircle2, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Link } from "@/i18n/navigation";

/** Clear "request received" screen: short request number, copy button and what happens next. */
export function RequestDone({ reference, children, dark }: { reference: string; children?: ReactNode; dark?: boolean }) {
  const t = useTranslations("done");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(reference); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  return (
    <div className={dark ? "rounded-2xl bg-white/10 p-6 text-center text-white" : "rounded-2xl bg-white p-6 text-center"}>
      <CheckCircle2 className="mx-auto size-14 text-green-500" />
      <h3 className={`mt-3 font-display text-2xl font-bold ${dark ? "text-white" : ""}`}>{t("title")}</h3>
      <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-ink-soft"}`}>{t("text")}</p>
      <div className={`mx-auto mt-5 max-w-xs rounded-2xl border-2 border-dashed px-4 py-4 ${dark ? "border-white/25" : "border-teal-300 bg-teal-50"}`}>
        <div className={`text-xs font-semibold uppercase tracking-wider ${dark ? "text-white/60" : "text-teal-700"}`}>{t("label")}</div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className={`font-mono text-3xl font-extrabold tracking-widest ${dark ? "text-white" : "text-navy-900"}`}>{reference}</span>
          <button type="button" onClick={copy} aria-label={t("copy")} title={t("copy")}
            className={`grid size-8 place-items-center rounded-lg transition ${dark ? "hover:bg-white/10" : "text-teal-700 hover:bg-white"}`}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>
      </div>
      <ol className={`mx-auto mt-5 max-w-sm space-y-2 text-left text-sm ${dark ? "text-white/80" : "text-ink-soft"}`}>
        {[t("next1"), t("next2"), t("next3")].map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-500 text-xs font-bold text-white">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      <p className={`mt-5 text-xs ${dark ? "text-white/60" : "text-ink-muted"}`}>
        {t("trackHint")} <Link href="/track" className="font-semibold underline underline-offset-2">{t("trackLink")}</Link>
      </p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
