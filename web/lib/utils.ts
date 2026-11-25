import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LOCALE_TAG: Record<string, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

// Numbers and prices are formatted by hand: Intl's Uzbek/Russian currency data differs between Node (server
// rendering) and browsers, which made the server HTML and the browser disagree ("5 000 US$" vs "$ 5,000").
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", RUB: "₽", TRY: "₺", INR: "₹", CNY: "¥", JPY: "¥", KRW: "₩", THB: "฿", AED: "AED", UZS: "so‘m",
};

function group(n: number, locale: string) {
  const sep = locale === "en" ? "," : "\u00a0"; // en: 5,000 · uz/ru: 5 000 (non-breaking space)
  return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function money(value: number | string | null | undefined, currency = "USD", locale = "en") {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const sign = n < 0 ? "-" : "";
  const digits = group(n, locale);
  if (locale === "en" && sym.length === 1) return `${sign}${sym}${digits}`; // $5,000
  return `${sign}${digits}\u00a0${sym}`; // 5 000 $ · 5 000 so‘m · 1,200 AED
}

export function num(value: number | null | undefined, locale = "en") {
  if (value === null || value === undefined) return "—";
  const [, frac] = Math.abs(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "").split(".");
  const whole = group(Math.trunc(value), locale);
  return `${value < 0 ? "-" : ""}${whole}${frac ? (locale === "en" ? "." : ",") + frac : ""}`;
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
