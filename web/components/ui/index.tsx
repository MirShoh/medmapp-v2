"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import {
  forwardRef, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/* ---------------- Button ---------------- */
import { buttonClass, sizes, variants, type Size, type Variant } from "./styles";

export { buttonClass };

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]",
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ---------------- Field wrappers ---------------- */
export function Field({ label, error, hint, children, required, className }: {
  label?: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; required?: boolean; className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-navy-900">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs text-danger" role="alert">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-line-strong bg-white px-3.5 text-sm text-navy-900 placeholder:text-ink-muted transition focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/15 disabled:bg-mist";

const NO_PLACEHOLDER = new Set(["date", "datetime-local", "time", "month", "file", "checkbox", "radio", "hidden", "color", "range"]);

/** A short example shown inside empty fields, picked by field name (messages: "ph.<name>"). An explicit placeholder wins. */
function usePlaceholder(name?: string, type?: string, explicit?: string) {
  const t = useTranslations("ph");
  if (explicit !== undefined || !name || (type && NO_PLACEHOLDER.has(type))) return explicit;
  return t.has(name) ? t(name) : undefined;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, placeholder, ...rest }, ref) {
    const ph = usePlaceholder(rest.name, rest.type, placeholder);
    return <input ref={ref} placeholder={ph} className={cn(inputBase, "h-11", invalid && "border-danger", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, placeholder, ...rest }, ref) {
    const ph = usePlaceholder(rest.name, undefined, placeholder);
    return <textarea ref={ref} placeholder={ph} className={cn(inputBase, "min-h-24 py-3", invalid && "border-danger", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(inputBase, "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23486581%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_0.9rem_center] bg-no-repeat pr-9", invalid && "border-danger", className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink-soft", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-line-strong accent-teal-500" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/* ---------------- Badge ---------------- */
type Tone = "neutral" | "teal" | "navy" | "success" | "warning" | "danger" | "sand";
const tones: Record<Tone, string> = {
  neutral: "bg-navy-900/5 text-ink-soft",
  teal: "bg-teal-50 text-teal-700",
  navy: "bg-navy-900 text-white",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  sand: "bg-sand-100 text-sand-500",
};
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}

/* ---------------- Feedback ---------------- */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-teal-500", className)} aria-label="Loading" />;
}

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-muted">
      <Spinner /> {label}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-600">{icon}</div>}
      <p className="font-display text-base font-bold text-navy-900">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-ink-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry, retryLabel = "Retry" }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry} className="font-semibold underline">{retryLabel}</button>}
    </div>
  );
}

/* ---------------- Modal / Drawer ---------------- */
export function Modal({ open, onClose, title, children, wide, side }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; side?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  // Rendered into <body>: a parent with backdrop-filter/transform (e.g. the sticky header) would otherwise trap position:fixed.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-navy-950/45 backdrop-blur-[2px]" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className={cn(
              "absolute flex max-h-full flex-col bg-white shadow-lift",
              side ? "inset-y-0 right-0 w-full max-w-2xl" : "left-1/2 top-[6vh] max-h-[88vh] w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl",
              !side && (wide ? "max-w-3xl" : "max-w-lg"),
            )}
            initial={side ? { x: 40, opacity: 0 } : { y: 16, opacity: 0 }}
            animate={side ? { x: 0, opacity: 1 } : { y: 0, opacity: 1 }}
            exit={side ? { x: 40, opacity: 0 } : { y: 16, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
              <div className="font-display text-lg font-bold text-navy-900">{title}</div>
              <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-mist" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <div className="scrollbar-thin overflow-y-auto p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------------- Tabs ---------------- */
export function Tabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={cn("scrollbar-thin flex gap-1 overflow-x-auto border-b border-line", className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cn("relative shrink-0 px-3.5 py-2.5 text-sm font-medium transition",
            value === t.value ? "text-navy-900" : "text-ink-muted hover:text-navy-900")}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-mist px-1.5 text-[11px] text-ink-soft">{t.count}</span>}
          {value === t.value && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-teal-500" />}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Card / Stat ---------------- */
export function Card({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return <div id={id} className={cn("card p-5", className)}>{children}</div>;
}

export function Stat({ label, value, icon, tone = "teal", hint }: { label: ReactNode; value: ReactNode; icon?: ReactNode; tone?: "teal" | "navy" | "sand" | "danger"; hint?: ReactNode }) {
  const toneCls = { teal: "bg-teal-50 text-teal-600", navy: "bg-navy-900/5 text-navy-800", sand: "bg-sand-100 text-sand-500", danger: "bg-danger-soft text-danger" }[tone];
  return (
    <div className="card flex items-start gap-3 p-4">
      {icon && <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", toneCls)}>{icon}</div>}
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-ink-muted">{label}</div>
        <div className="mt-0.5 font-display text-2xl font-extrabold text-navy-900">{value}</div>
        {hint && <div className="text-[11px] text-ink-muted">{hint}</div>}
      </div>
    </div>
  );
}
