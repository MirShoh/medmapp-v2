import { cn } from "@/lib/utils";

/**
 * MedMapp logo cut from the original brand files (D:/StartUp/MedMapp/Logo/.../LOGO NEW).
 * Light backgrounds: the original full-colour wordmark. Dark backgrounds: the mark on a white tile (its plane is a
 * transparent cut-out) next to the wordmark with white letters and the green tagline.
 */
export function Logo({ light, className }: { light?: boolean; className?: string }) {
  if (!light) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <img src="/logo.webp" alt="MedMapp" width={197} height={48} className="h-10 w-auto sm:h-12" decoding="async" />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
        <img src="/brand-mark.png" alt="" width={32} height={32} className="size-8" decoding="async" />
      </span>
      <img src="/logo-text-light.webp" alt="MedMapp" width={163} height={36} className="h-8 w-auto sm:h-9" decoding="async" />
    </span>
  );
}
