"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Building2, CheckCircle2, ImageOff, Languages, MessageSquareQuote, Newspaper, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageTitle } from "@/components/portal/shell";
import { ErrorBox, LoadingBlock } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RoleGuide } from "./dashboard";

type Overview = {
  hospitals: { total: number; no_photo: number; no_ru: number; no_en: number };
  doctors: { total: number; no_photo: number };
  treatments: { total: number; no_text: number };
  blog: { published: number; drafts: number };
  reviews_pending: number; testimonials: number; faqs: number;
};

/** Content manager's home: what to fill in next (each card opens the already-filtered list). */
export function ContentHome() {
  const t = useTranslations("contentUi");
  const q = useQuery({ queryKey: ["content-overview"], queryFn: () => api<Overview>("/admin/content-overview/") });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorBox message={(q.error as Error)?.message} onRetry={() => q.refetch()} />;
  const d = q.data;
  const r = (res: string, qs = "") => `/admin/r/${res}${qs}`;
  const todo: [string, number, LucideIcon, string][] = [
    ["hospitalsNoPhoto", d.hospitals.no_photo, ImageOff, r("hospitals", "?has_image=false")],
    ["hospitalsNoRu", d.hospitals.no_ru, Languages, r("hospitals", "?missing_tr=ru")],
    ["hospitalsNoEn", d.hospitals.no_en, Languages, r("hospitals", "?missing_tr=en")],
    ["doctorsNoPhoto", d.doctors.no_photo, ImageOff, r("doctors", "?has_photo=false")],
    ["treatmentsNoText", d.treatments.no_text, BookOpen, r("treatments")],
    ["reviewsPending", d.reviews_pending, ShieldCheck, r("reviews", "?is_published=false")],
    ["blogDrafts", d.blog.drafts, Newspaper, r("blog-posts", "?status=draft")],
  ];
  const stats: [string, number, LucideIcon, string][] = [
    ["hospitals", d.hospitals.total, Building2, r("hospitals")], ["doctors", d.doctors.total, Stethoscope, r("doctors")],
    ["treatments", d.treatments.total, BookOpen, r("treatments")], ["posts", d.blog.published, Newspaper, r("blog-posts", "?status=published")],
    ["testimonials", d.testimonials, MessageSquareQuote, r("testimonials")], ["faqs", d.faqs, BookOpen, r("faqs")],
  ];
  const open = todo.filter(([, n]) => n > 0);
  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <RoleGuide role="content_manager" />
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t("todoTitle")}</h2>
          {!open.length && <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="size-4" />{t("allDone")}</span>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {todo.map(([k, n, Icon, href]) => (
            <Link key={k} href={href} className={cn("flex items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-card",
              n > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-line bg-white text-ink-muted")}>
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", n > 0 ? "bg-white/70" : "bg-mist")}><Icon className="size-5" /></span>
              <span className="min-w-0">
                <span className="block font-display text-2xl font-extrabold leading-none">{n}</span>
                <span className="mt-1 block text-xs font-semibold">{t(`todo.${k}`)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("statsTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {stats.map(([k, n, Icon, href]) => (
            <Link key={k} href={href} className="card flex items-center gap-3 p-4 transition hover:border-teal-300">
              <span className="grid size-9 place-items-center rounded-xl bg-teal-50 text-teal-600"><Icon className="size-4" /></span>
              <span><span className="block font-display text-xl font-extrabold text-navy-900">{n}</span><span className="text-[11px] text-ink-muted">{t(`stats.${k}`)}</span></span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
