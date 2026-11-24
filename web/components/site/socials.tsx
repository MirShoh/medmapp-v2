import { Facebook, Instagram, Send, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { telegram: Send, instagram: Instagram, facebook: Facebook, youtube: Youtube } as const;
const NAMES = { telegram: "Telegram", instagram: "Instagram", facebook: "Facebook", youtube: "YouTube" } as const;

/** MedMapp social profiles (from site settings); renders only the ones that are filled in. */
export function SocialLinks({ socials, className, itemClass }: { socials?: Record<string, string>; className?: string; itemClass?: string }) {
  const items = (Object.keys(ICONS) as (keyof typeof ICONS)[]).filter((k) => socials?.[k]);
  if (!items.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((k) => {
        const I = ICONS[k];
        return (
          <a key={k} href={socials![k]} target="_blank" rel="noopener noreferrer" aria-label={NAMES[k]} title={NAMES[k]}
            className={cn("grid size-10 place-items-center rounded-xl transition", itemClass)}>
            <I className="size-[18px]" />
          </a>
        );
      })}
    </div>
  );
}
