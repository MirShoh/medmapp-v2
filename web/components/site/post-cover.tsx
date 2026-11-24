import { BookOpen, Globe2, Stethoscope } from "lucide-react";
import { mediaUrl } from "@/lib/media";

const STYLES = [
  { icon: BookOpen, bg: "from-navy-900 via-navy-800 to-teal-700" },
  { icon: Globe2, bg: "from-navy-900 via-teal-800 to-green-700" },
  { icon: Stethoscope, bg: "from-navy-950 via-navy-700 to-teal-600" },
];

/** Blog cover: the post image, or a branded cover (category + icon) when no image was uploaded. */
export function PostCover({ image, category, seed }: { image: string | null; category?: string | null; seed: number }) {
  const img = mediaUrl(image);
  const st = STYLES[seed % STYLES.length];
  const I = st.icon;
  return (
    <div className={`relative aspect-[16/9] overflow-hidden bg-gradient-to-br ${st.bg}`}>
      {img ? (
         
        <img src={img} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
      ) : (
        <>
          <div className="bg-grid absolute inset-0 opacity-70" />
          <I className="absolute -bottom-5 -right-3 size-32 text-white/10 transition duration-500 group-hover:scale-110" strokeWidth={1.2} />
          <span className="absolute left-5 top-5 grid size-11 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/20"><I className="size-5" /></span>
          {category && <span className="absolute bottom-5 left-5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">{category}</span>}
        </>
      )}
    </div>
  );
}
