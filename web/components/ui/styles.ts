import { cn } from "@/lib/utils";

export type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "light";
export type Size = "sm" | "md" | "lg";

export const variants: Record<Variant, string> = {
  primary: "bg-teal-500 text-white hover:bg-teal-600 shadow-[0_8px_20px_-8px_rgb(18_184_166/0.7)]",
  secondary: "bg-navy-900 text-white hover:bg-navy-800",
  outline: "border border-line-strong bg-white text-navy-900 hover:border-navy-600 hover:bg-mist",
  ghost: "text-ink-soft hover:bg-navy-900/5 hover:text-navy-900",
  danger: "bg-danger text-white hover:bg-danger/90",
  light: "bg-white/10 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20",
};
export const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};

/** Server-safe: use for <Link> elements styled as buttons. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn("inline-flex items-center justify-center whitespace-nowrap font-semibold transition-all duration-200", variants[variant], sizes[size], className);
}
