"use client";

import { FileText, Search, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { ApiError, api } from "@/lib/api";
import { cn, fileSize } from "@/lib/utils";
import { RequestDone } from "./request-done";

type Filters = { countries: { id: number; name: string; flag: string }[]; specialties: { id: number; title: string }[] };
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.dcm,.doc,.docx,.zip";
const MAX = 25 * 1024 * 1024;

export function SecondOpinionForm({ bare }: { bare?: boolean } = {}) {
  const t = useTranslations();
  const [filters, setFilters] = useState<Filters | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ reference: string; documents: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { api<Filters>("/public/filters/", { auth: false }).then(setFilters).catch(() => null); }, []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    const errs: string[] = [];
    Array.from(list).forEach((f) => {
      if (f.size > MAX) errs.push(`${f.name}: > 25 MB`);
      else if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    });
    setFiles(next.slice(0, 15));
    setErrors((e) => ({ ...e, files: errs.join("; ") }));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    if (String(fd.get("full_name") || "").trim().length < 2) errs.full_name = t("form.fullName");
    if (!/^\+?[0-9 ()-]{7,20}$/.test(String(fd.get("phone") || "").trim())) errs.phone = t("form.phone");
    if (!fd.get("consent")) errs.consent = t("form.consent");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    fd.set("consent", "true");
    files.forEach((f) => fd.append("files", f));
    setBusy(true);
    try {
      setResult(await api<{ reference: string; documents: number }>("/forms/second-opinion/", { form: fd, auth: false }));
      setFiles([]);
      formRef.current?.reset();
    } catch (err) {
      setErrors(err instanceof ApiError ? { ...err.fieldErrors(), root: err.message } : { root: t("common.error") });
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className={bare ? "" : "card"}>
        <RequestDone reference={result.reference}>
          <Link href="/register" className="rounded-xl bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white">{t("done.register")}</Link>
          <Button variant="outline" onClick={() => setResult(null)}>{t("form.anotherRequest")}</Button>
        </RequestDone>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className={cn("grid gap-4 sm:grid-cols-2", !bare && "card p-6 sm:p-8")} noValidate>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Field label={t("form.fullName")} error={errors.full_name} required><Input name="full_name" autoComplete="name" /></Field>
      <Field label={t("form.phone")} error={errors.phone} required><Input name="phone" type="tel" /></Field>
      <Field label={t("form.email")} error={errors.email}><Input name="email" type="email" /></Field>
      <Field label={t("common.specialty")}>
        <Select name="specialty"><option value="">{t("form.specialtyPlaceholder")}</option>{filters?.specialties.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</Select>
      </Field>
      <Field label={t("form.destination")} className="sm:col-span-2">
        <Select name="destination"><option value="">{t("home.searchCountry")}</option>{filters?.countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}</Select>
      </Field>
      <Field label={t("form.message")} className="sm:col-span-2"><Textarea name="message" rows={4} maxLength={4000} /></Field>
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-[13px] font-medium text-navy-900">{t("form.files")}</span>
        <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
            drag ? "border-teal-500 bg-teal-50" : "border-line-strong bg-mist hover:border-teal-300")}>
          <Upload className="size-7 text-teal-600" />
          <span className="mt-2 text-sm font-semibold text-navy-900">{t("dash.uploadDocs")}</span>
          <span className="mt-1 text-xs text-ink-muted">{t("form.filesHint")}</span>
          <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => addFiles(e.target.files)} />
        </label>
        {errors.files && <p className="mt-1 text-xs text-danger">{errors.files}</p>}
        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((f) => (
              <li key={f.name + f.size} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                <FileText className="size-4 text-teal-600" /><span className="flex-1 truncate">{f.name}</span><span className="text-xs text-ink-muted">{fileSize(f.size)}</span>
                <button type="button" onClick={() => setFiles(files.filter((x) => x !== f))} className="text-ink-muted hover:text-danger" aria-label="Remove"><X className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="sm:col-span-2">
        <Checkbox name="consent" label={t("form.consent")} />
        {errors.consent && <p className="mt-1 text-xs text-danger">{errors.consent}</p>}
      </div>
      {errors.root && <p className="text-sm text-danger sm:col-span-2" role="alert">{errors.root}</p>}
      <Button type="submit" size="lg" loading={busy} className="sm:col-span-2">{busy ? t("form.sending") : t("form.submit")}</Button>
    </form>
  );
}

export function TrackRequest() {
  const t = useTranslations();
  const [res, setRes] = useState<{ reference: string; status: string; status_label: string; journey_index: number; note: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr("");
    try {
      setRes(await api("/forms/track/", { body: { reference: fd.get("reference"), phone: fd.get("phone") }, auth: false }));
    } catch (e2) {
      setRes(null);
      setErr(e2 instanceof ApiError ? e2.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Search className="size-5 text-teal-600" />{t("so.track")}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t("so.trackHint")}</p>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <Field label={t("so.trackId")}><Input name="reference" required className="font-mono uppercase" placeholder="MM-0001 · AA1234567" autoComplete="off" /></Field>
        <Field label={t("form.phone")}><Input name="phone" type="tel" required autoComplete="tel" placeholder="+998" /></Field>
        <Button type="submit" variant="secondary" loading={busy}>{t("so.track")}</Button>
      </form>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
      {res && (
        <div className="mt-4 rounded-xl bg-teal-50 p-4">
          <div className="text-xs text-ink-muted">{res.reference}</div>
          <div className="mt-1 font-display text-lg font-bold text-teal-700">{t(`case.${res.status}`)}</div>
          <div className="mt-3 flex gap-1">{Array.from({ length: 10 }).map((_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= res.journey_index ? "bg-teal-500" : "bg-teal-100")} />)}</div>
          {res.note && <p className="mt-3 text-sm text-ink-soft">{res.note}</p>}
        </div>
      )}
    </div>
  );
}
