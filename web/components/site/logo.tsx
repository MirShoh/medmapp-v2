import { cn } from "@/lib/utils";

/** MedMapp brand mark: the blue cross with the white airplane and green dot (public/brand-icon.png). */
export function Logo({ light, className, tagline = true }: { light?: boolean; className?: string; tagline?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", light ? "bg-white shadow-sm" : "")}>
        { }
        <img src="/brand-icon.png" alt="" width={40} height={40} className={light ? "size-8" : "size-10"} />
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-[1.35rem] font-extrabold tracking-wide", light ? "text-white" : "text-brand-600")}>
          MEDMAPP
        </span>
        {tagline && (
          <span className={cn("mt-1 text-[0.52rem] font-semibold tracking-[0.2em]", light ? "text-green-300" : "text-green-600")}>
            MEDICAL TOURISM PLATFORM
          </span>
        )}
      </span>
    </span>
  );
}
