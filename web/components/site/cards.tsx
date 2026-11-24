import { ArrowUpRight, BadgeCheck, Building2, CalendarDays, Clock, GraduationCap, HeartPulse, Hospital, Star, Stethoscope, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { mediaUrl } from "@/lib/media";
import type { CountryCard as TCountry, DoctorCard as TDoctor, HospitalCard as THospital, PackageCard as TPackage, Treatment } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { CompareToggle } from "./compare";
import { Icon } from "./icon";

type L = { locale: string; labels: Record<string, string> };

const TYPE_STYLE: Record<string, { icon: typeof Building2; bg: string }> = {
  university: { icon: GraduationCap, bg: "from-navy-900 via-navy-800 to-teal-700" },
  specialty: { icon: HeartPulse, bg: "from-navy-900 via-teal-800 to-green-700" },
  public: { icon: Hospital, bg: "from-navy-950 via-navy-800 to-navy-600" },
  private: { icon: Building2, bg: "from-navy-900 via-navy-700 to-teal-600" },
  clinic: { icon: Stethoscope, bg: "from-navy-900 via-teal-800 to-teal-600" },
};

export function HospitalCard({ h, locale, labels }: { h: THospital } & L) {
  const img = mediaUrl(h.image);
  const logo = mediaUrl(h.logo);
  const st = TYPE_STYLE[h.hospital_type] || TYPE_STYLE.private;
  const TypeIcon = st.icon;
  return (
    <Link href={`/hospitals/${h.slug}`} className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-lift">
      <div className={cn("relative h-40 overflow-hidden bg-gradient-to-br", st.bg)}>
        {img ? (
           
          <img src={img} alt={h.name} className="size-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <>
            <div className="bg-grid absolute inset-0 opacity-60" />
            <TypeIcon className="absolute -bottom-6 -right-4 size-36 text-white/10 transition duration-500 group-hover:scale-110" strokeWidth={1.2} />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/10 to-transparent" />
        {img && h.image_credit && (
          <span title={h.image_credit} className="absolute bottom-14 right-3 max-w-[75%] truncate rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white/80 opacity-0 backdrop-blur transition group-hover:opacity-100">📷 {h.image_credit}</span>
        )}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {h.is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-teal-700"><BadgeCheck className="size-3.5" />{labels.verified}</span>}
            {h.accreditations.slice(0, 2).map((a) => <span key={a} className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/25 backdrop-blur">{a}</span>)}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-navy-900"><TypeIcon className="size-3" />{labels[`htype_${h.hospital_type}`] || h.hospital_type}</span>
        </div>
        <div className="absolute inset-x-4 bottom-3 flex items-center gap-2.5">
          {logo ? (
             
            <img src={logo} alt="" className="size-10 rounded-xl bg-white object-contain p-1" />
          ) : h.city?.country.flag ? <span className="grid size-10 place-items-center rounded-xl bg-white/95 text-xl">{h.city.country.flag}</span> : null}
          {h.city && (
            <span className="min-w-0 text-sm font-semibold leading-tight text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.5)]">
              <span className="block truncate">{h.city.name}</span>
              <span className="block truncate text-xs font-medium text-white/75">{h.city.country.name}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 font-display text-[17px] font-bold leading-snug text-navy-900 group-hover:text-teal-700">{h.name}</h3>
        {h.short_description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">{h.short_description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {h.specialties.slice(0, 3).map((s) => <span key={s.id} className="rounded-full bg-mist px-2.5 py-1 text-[11px] font-semibold text-navy-800">{s.title}</span>)}
          {h.specialties.length > 3 && <span className="rounded-full bg-mist px-2.5 py-1 text-[11px] font-semibold text-ink-muted">+{h.specialties.length - 3}</span>}
        </div>
        <div className="min-h-4 flex-1" />
        <div className="flex items-center justify-between gap-2 border-t border-line pt-4 text-xs text-ink-muted">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {h.rating ? <span className="flex items-center gap-1 font-semibold text-navy-900"><Star className="size-3.5 fill-sand-400 text-sand-400" />{h.rating.toFixed(1)}<span className="font-normal text-ink-muted">({h.reviews_count})</span></span> : null}
            {h.doctors_count > 0 && <span className="flex items-center gap-1"><UserRound className="size-3.5" />{h.doctors_count} {labels.doctors}</span>}
            {h.founded_year && <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{h.founded_year}</span>}
            {h.min_price_usd && <span className="font-semibold text-navy-900">{labels.from} {money(h.min_price_usd, "USD", locale)}</span>}
          </div>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mist text-navy-900 transition group-hover:bg-teal-500 group-hover:text-white"><ArrowUpRight className="size-4" /></span>
        </div>
        <CompareToggle kind="hospitals" item={{ id: h.id, name: h.name }} className="mt-3 self-start" />
      </div>
    </Link>
  );
}

const AVATAR_BG = ["from-teal-400 to-teal-600", "from-navy-600 to-navy-800", "from-green-500 to-teal-600", "from-teal-500 to-navy-700"];

/** Doctor card: initials avatar (no stock photos), name, role, specialty, hospital and experience at a glance. */
export function DoctorCard({ d, labels }: { d: TDoctor } & L) {
  const img = mediaUrl(d.photo);
  const h = d.hospitals[0];
  const initials = d.full_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const bg = AVATAR_BG[d.id % AVATAR_BG.length];
  return (
    <Link href={`/doctors/${d.slug}`} className="group flex flex-col rounded-3xl border border-line bg-white p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-lift">
      <div className="flex items-start gap-4">
        <div className={cn("relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br font-display text-xl font-extrabold text-white shadow-glow", bg)}>
          { }
          {img ? <img src={img} alt={d.full_name} className="size-full object-cover" loading="lazy" /> : initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] font-bold leading-snug text-navy-900 group-hover:text-teal-700">{d.full_name}</h3>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
            <Stethoscope className="size-3.5" />{d.specialty?.title || d.specialty_title}
          </span>
        </div>
      </div>
      {d.position && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">{d.position}</p>}
      <div className="mt-4 grid gap-2 rounded-2xl bg-mist p-3 text-[13px]">
        {h && (
          <div className="flex items-start gap-2 text-navy-900">
            <Building2 className="mt-0.5 size-4 shrink-0 text-teal-600" />
            <span className="min-w-0"><span className="line-clamp-1 font-semibold">{h.name}</span>{(h.city || h.country) && <span className="block text-xs text-ink-muted">{[h.city, h.country].filter(Boolean).join(", ")}</span>}</span>
          </div>
        )}
        {d.experience_years > 0 && (
          <div className="flex items-center gap-2 text-navy-900"><Clock className="size-4 shrink-0 text-teal-600" /><span><b>{d.experience_years}</b> {labels.experience}</span></div>
        )}
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">{labels.profile}<ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
    </Link>
  );
}

export function TreatmentCard({ t, locale, labels }: { t: Treatment } & L) {
  return (
    <Link href={`/treatments/${t.slug}`} className="card card-hover group flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-600 transition group-hover:bg-teal-500 group-hover:text-white">
          <Icon name={t.specialty?.icon} className="size-5" />
        </div>
        {t.is_advanced && <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-semibold text-sand-500">{labels.advanced}</span>}
      </div>
      <h3 className="mt-4 font-display text-[17px] font-bold text-navy-900">{t.name}</h3>
      <p className="mt-0.5 text-xs text-ink-muted">{t.specialty?.title}</p>
      {t.short_description && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{t.short_description}</p>}
      <div className="mt-auto flex items-center justify-between pt-4 text-xs">
        <span className="text-ink-muted">{t.hospitals_count ? `${t.hospitals_count} ${labels.hospitals}` : ""}</span>
        {t.price_from_usd && <span className="font-semibold text-navy-900">{labels.from} {money(t.price_from_usd, "USD", locale)}</span>}
      </div>
    </Link>
  );
}

export function CountryCard({ c, labels, className }: { c: TCountry; className?: string } & L) {
  const img = mediaUrl(c.hero_image);
  return (
    <Link href={`/destinations/${c.slug}`} className={cn("group relative isolate flex min-h-56 flex-col justify-end overflow-hidden rounded-2xl bg-navy-800 p-5 text-white shadow-card", className)}>
      { }
      {img && <img src={img} alt={c.name} className="absolute inset-0 -z-10 size-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/45 to-navy-950/5" />
      {img && c.hero_image_credit && (
        <span title={c.hero_image_credit} className="absolute left-3 top-3 z-10 max-w-[70%] truncate rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/75 opacity-0 backdrop-blur transition group-hover:opacity-100">
          📷 {c.hero_image_credit}
        </span>
      )}
      <span className="absolute right-4 top-4 z-10 text-4xl drop-shadow transition duration-500 group-hover:scale-110">{c.flag}</span>
      <div className="relative z-10 [text-shadow:0_2px_12px_rgb(0_0_0/0.55)]">
        <h3 className="font-display text-2xl font-extrabold !text-white" style={{ color: "#fff" }}>{c.name}</h3>
        {c.tagline && <p className="mt-1 line-clamp-2 text-sm !text-white/90">{c.tagline}</p>}
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-green-300 transition group-hover:gap-2">{c.hospitals_count > 0 ? `${c.hospitals_count} ${labels.hospitals}` : labels.explore} →</p>
      </div>
    </Link>
  );
}

export function PackageCard({ p, locale, labels }: { p: TPackage } & L) {
  return (
    <div className="card card-hover flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", p.price_type === "confirmed" ? "bg-success-soft text-success" : "bg-sand-100 text-sand-500")}>
          {p.price_type === "confirmed" ? labels.confirmed : labels.estimate}
        </span>
        {p.hospital.country && <span className="text-lg">{p.hospital.country.flag}</span>}
      </div>
      <Link href={`/packages/${p.slug}`} className="mt-3 font-display text-[17px] font-bold leading-snug text-navy-900 hover:text-teal-700">{p.name}</Link>
      <p className="mt-1 text-xs text-ink-muted">{p.hospital.name}{p.hospital.city ? ` · ${p.hospital.city}` : ""}</p>
      <ul className="mt-3 space-y-1 text-sm text-ink-soft">
        {p.included.slice(0, 3).map((x) => <li key={x} className="flex gap-2"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-teal-500" />{x}</li>)}
      </ul>
      <div className="mt-auto flex items-end justify-between gap-2 pt-5">
        <div>
          <div className="text-[11px] text-ink-muted">{labels.from}</div>
          <div className="font-display text-2xl font-extrabold text-navy-900">{money(p.price, p.currency, locale)}</div>
          {p.duration_days && <div className="text-[11px] text-ink-muted">{p.duration_days} {labels.days}</div>}
        </div>
        <CompareToggle kind="packages" item={{ id: p.id, name: p.name }} />
      </div>
    </div>
  );
}
