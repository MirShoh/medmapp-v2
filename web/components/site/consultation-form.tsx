"use client";

import { zodResolver } from "@hookform/resolvers/zod";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RequestDone } from "./request-done";

type Option = { id: number; name?: string; title?: string; flag?: string };
type Filters = { countries: Option[]; specialties: Option[]; treatments: (Option & { specialty: number })[] };

const REGIONS = ["tashkentCity", "tashkentRegion", "andijan", "bukhara", "fergana", "jizzakh", "khorezm", "namangan", "navoi",
  "kashkadarya", "karakalpakstan", "samarkand", "syrdarya", "surkhandarya"];
const ABROAD = ["Kazakhstan", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Azerbaijan", "Russia", "Belarus"];

export function ConsultationForm({ preset = {}, compact, source = "website", dark, className }: {
  preset?: { treatment?: number; specialty?: number; destination?: number; hospital?: number; doctor?: number; package?: number; service?: string };
  compact?: boolean; source?: string; dark?: boolean; className?: string;
}) {
  const t = useTranslations();
  const [filters, setFilters] = useState<Filters | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const schema = z.object({
    full_name: z.string().trim().min(2, t("form.fullName")),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, t("form.phone")),
    email: z.string().trim().email().or(z.literal("")).optional(),
    passport_number: z.string().trim().regex(/^[A-Za-z0-9 ]{5,20}$/, t("form.passport")).or(z.literal("")).optional(),
    resident_region: z.string().optional(),
    specialty: z.string().optional(),
    treatment: z.string().optional(),
    destination: z.string().optional(),
    message: z.string().max(4000).optional(),
    consent: z.boolean().refine((v) => v, t("form.consent")),
    website: z.string().optional(),
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError, reset, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { consent: false, specialty: preset.specialty ? String(preset.specialty) : "", treatment: preset.treatment ? String(preset.treatment) : "", destination: preset.destination ? String(preset.destination) : "" },
  });
  useEffect(() => {
    api<Filters>("/public/filters/", { auth: false }).then(setFilters).catch(() => setFilters(null));
  }, []);
  const spec = watch("specialty");

  const onSubmit = async (v: Values) => {
    try {
      const res = await api<{ reference: string }>("/forms/consultation/", {
        auth: false,
        body: {
          ...v, email: v.email || "", passport_number: v.passport_number || "", specialty: v.specialty || preset.specialty || null, treatment: v.treatment || preset.treatment || null,
          destination: v.destination || preset.destination || null, hospital: preset.hospital || null, doctor: preset.doctor || null,
          package: preset.package || null, service: preset.service || null, source,
          source_detail: typeof window !== "undefined" ? window.location.pathname : "",
        },
      });
      setDone(res.reference);
      reset();
    } catch (e) {
      if (e instanceof ApiError) {
        const fe = e.fieldErrors();
        Object.entries(fe).forEach(([k, msg]) => setError(k as keyof Values, { message: msg }));
        if (!Object.keys(fe).length) setError("root", { message: e.message });
      } else setError("root", { message: t("common.error") });
    }
  };

  if (done) {
    return (
      <div className={className}>
        <RequestDone reference={done} dark={dark}>
          <Button variant="outline" size="sm" onClick={() => setDone(null)}>{t("form.anotherRequest")}</Button>
        </RequestDone>
      </div>
    );
  }

  const treatments = (filters?.treatments || []).filter((x) => !spec || String(x.specialty) === spec);
  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn("grid gap-3.5", !compact && "sm:grid-cols-2", className)} noValidate>
      <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden {...register("website")} />
      <Field label={t("form.fullName")} error={errors.full_name?.message} required>
        <Input autoComplete="name" invalid={!!errors.full_name} {...register("full_name")} />
      </Field>
      <Field label={t("form.phone")} error={errors.phone?.message} required>
        <Input type="tel" autoComplete="tel" invalid={!!errors.phone} {...register("phone")} />
      </Field>
      {!compact && (
        <Field label={t("form.email")} error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
      )}
      {!compact && (
        <Field label={t("form.passport")} hint={t("form.passportHint")} error={errors.passport_number?.message}>
          <Input className="font-mono uppercase" autoComplete="off" placeholder="AA1234567" maxLength={20} {...register("passport_number")} />
        </Field>
      )}
      <Field label={t("form.region")}>
        <Select {...register("resident_region")}>
          <option value="">{t("form.regionPlaceholder")}</option>
          <optgroup label={t("map.Uzbekistan")}>{REGIONS.map((r) => <option key={r} value={t(`regions.${r}`)}>{t(`regions.${r}`)}</option>)}</optgroup>
          <optgroup label={t("form.abroad")}>
            {ABROAD.map((r) => <option key={r} value={t(`map.${r}`)}>{t(`map.${r}`)}</option>)}
            <option value={t("form.otherCountry")}>{t("form.otherCountry")}</option>
          </optgroup>
        </Select>
      </Field>
      {!preset.treatment && (
        <>
          <Field label={t("common.specialty")}>
            <Select {...register("specialty")}>
              <option value="">{t("form.specialtyPlaceholder")}</option>
              {filters?.specialties.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </Select>
          </Field>
          {!compact && (
            <Field label={t("common.treatment")}>
              <Select {...register("treatment")}>
                <option value="">{t("form.treatmentPlaceholder")}</option>
                {treatments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
        </>
      )}
      {!preset.destination && (
        <Field label={t("form.destination")} className={compact ? "" : "sm:col-span-2"}>
          <Select {...register("destination")}>
            <option value="">{t("home.searchCountry")}</option>
            {filters?.countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t("form.message")} className={compact ? "" : "sm:col-span-2"}>
        <Textarea rows={compact ? 2 : 4} {...register("message")} />
      </Field>
      <div className={cn(!compact && "sm:col-span-2")}>
        <Checkbox label={t("form.consent")} {...register("consent")} />
        {errors.consent && <p className="mt-1 text-xs text-danger">{errors.consent.message}</p>}
      </div>
      {errors.root && <p className="text-sm text-danger sm:col-span-2" role="alert">{errors.root.message}</p>}
      <Button type="submit" size="lg" loading={isSubmitting} className={cn(!compact && "sm:col-span-2")}>
        {isSubmitting ? t("form.sending") : t("form.submit")}
      </Button>
    </form>
  );
}
