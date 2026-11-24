import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function SectionHead({ eyebrow, title, subtitle, href, linkLabel, center, light }: {
  eyebrow?: string; title: ReactNode; subtitle?: ReactNode; href?: string; linkLabel?: string; center?: boolean; light?: boolean;
}) {
  return (
    <div className={cn("mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", center && "items-center text-center sm:flex-col sm:items-center")}>
      <div className={cn("max-w-2xl", center && "mx-auto")}>
        {eyebrow && <div className={cn("eyebrow mb-3", light && "text-teal-300")}>{eyebrow}</div>}
        <h2 className={cn("h-section", light && "text-white")}>{title}</h2>
        {subtitle && <p className={cn("lead mt-3", light && "text-white/70")}>{subtitle}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className={cn("shrink-0 text-sm font-semibold", light ? "text-teal-300 hover:text-white" : "text-teal-700 hover:text-navy-900")}>{linkLabel} →</Link>
      )}
    </div>
  );
}

export function PageHero({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <section className="bg-hero relative overflow-hidden pb-14 pt-32 text-white lg:pb-20 lg:pt-40">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="container-x relative">
        {eyebrow && <div className="eyebrow mb-4 text-teal-300">{eyebrow}</div>}
        <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-[1.1] text-white sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-lg text-white/70">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}

export function Faq({ items }: { items: { id: number; question: string; answer: string }[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {items.map((f) => (
        <details key={f.id} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-semibold text-navy-900">
            {f.question}
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mist text-teal-600 transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function Prose({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(text);
  const cls = className ? `prose-mm ${className}` : "prose-mm";
  // CMS rich text is authored by authenticated staff only (cms.edit / blog.edit permissions).
  return looksHtml ? <div className={cls} dangerouslySetInnerHTML={{ __html: sanitize(text) }} />
    : <div className={`${cls} whitespace-pre-line`}>{text}</div>;
}

/** Defence in depth for staff-authored HTML: drop script/style/iframe tags and inline handlers. */
function sanitize(html: string) {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*/gi, "$1=$2#");
}
