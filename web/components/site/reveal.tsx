import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Scroll reveal without JS: CSS scroll-driven animation where supported, always visible otherwise. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return <div className={cn("mm-reveal", className)} style={{ "--mm-delay": `${delay}s` } as CSSProperties}>{children}</div>;
}
