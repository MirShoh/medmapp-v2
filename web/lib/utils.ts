import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LOCALE_TAG: Record<string, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

export function money(value: number | string | null | undefined, currency = "USD", locale = "en") {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(LOCALE_TAG[locale] ?? "en-US", {
      style: "currency", currency, maximumFractionDigits: currency === "UZS" ? 0 : 0,
    }).format(n);
  } catch {
    return `${n.toLocaleString()} ${currency}`;
  }
}

export function num(value: number | null | undefined, locale = "en") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(LOCALE_TAG[locale] ?? "en-US").format(value);
}

const UZ_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

export function date(value: string | null | undefined, locale = "en", withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  // Browsers often lack Uzbek month names (Chrome prints "2026 M11 24"), so Uzbek is formatted by hand.
  if (locale === "uz") {
    const out = `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
    return withTime ? `${out}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : out;
  }
  return new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? "en-US", {
    day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

export function initials(name?: string | null) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false) s.set(k, String(v));
  });
  const out = s.toString();
  return out ? `?${out}` : "";
}
