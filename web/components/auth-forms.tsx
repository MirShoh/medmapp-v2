"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/site/logo";
import { Button, Checkbox, Field, Input } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Auth page frame. Left: what the account gives you (desktop). Right: optional Sign in / Create account switch,
 * the title and the form. Shared by the patient, partner and staff sign-in pages.
 */
export function AuthShell({ title, subtitle, children, side, tabs }: {
  title: string; subtitle?: string; children: ReactNode; side?: ReactNode; tabs?: "login" | "register";
}) {
  const t = useTranslations();
  return (
    <div className="grid min-h-screen bg-mist lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="bg-hero relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col xl:p-16">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="absolute -right-24 top-1/3 size-96 rounded-full bg-teal-500/20 blur-3xl" />
        <Link href="/" className="relative"><Logo light /></Link>
        <div className="relative my-auto max-w-lg py-10">{side}</div>
      </div>
      <div className="flex flex-col p-5 sm:p-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:hidden"><Logo /></Link>
          <Link href="/" className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-white hover:text-navy-900">
            <ArrowLeft className="size-4" />{t("authUi.backToSite")}
          </Link>
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-8">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-lift sm:p-8">
            {tabs && (
              <div className="mb-7 grid grid-cols-2 gap-1 rounded-2xl bg-mist p-1" role="tablist">
                {(["login", "register"] as const).map((k) => (
                  <Link key={k} href={`/${k}`} role="tab" aria-selected={tabs === k}
                    className={cn("rounded-xl py-2.5 text-center text-sm font-semibold transition", tabs === k ? "bg-white text-navy-900 shadow-card" : "text-ink-soft hover:text-navy-900")}>
                    {k === "login" ? t("auth.signIn") : t("authUi.registerTab")}
                  </Link>
                ))}
              </div>
            )}
            <h1 className="font-display text-2xl font-extrabold sm:text-[28px]">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Left-panel content: a headline and what the account lets you do. */
export function SidePitch({ title, items, features }: { title: string; items?: string[]; features?: { icon: ReactNode; title: string; text: string }[] }) {
  return (
    <>
      <h2 className="font-display text-3xl font-extrabold leading-tight text-white xl:text-4xl">{title}</h2>
      {features && (
        <ul className="mt-8 grid gap-3">
          {features.map((f) => (
            <li key={f.title} className="flex items-start gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-500 text-white shadow-glow">{f.icon}</span>
              <span><span className="block font-semibold text-white">{f.title}</span><span className="mt-0.5 block text-sm text-white/65">{f.text}</span></span>
            </li>
          ))}
        </ul>
      )}
      {items && <ul className="mt-6 space-y-2.5 text-sm text-white/75">{items.map((x) => <li key={x} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-green-400" />{x}</li>)}</ul>}
    </>
  );
}

/** Text field with a leading icon (and an eye toggle for passwords). */
function IconInput({ icon, type = "text", ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode }) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-ink-muted">{icon}</span>
      <Input {...rest} type={isPw && show ? "text" : type} className={cn("h-12 pl-10", isPw && "pr-11")} />
      {isPw && (
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:bg-mist hover:text-navy-900">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      )}
    </span>
  );
}

export function LoginForm({ portal }: { portal: "dashboard" | "admin" | "partner" }) {
  const t = useTranslations();
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr("");
    try {
      const u = await login(String(fd.get("login")), String(fd.get("password")), portal);
      const next = params.get("next");
      router.replace(next && next.startsWith(`/${u.portal}`) ? next : `/${u.portal}`);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("auth.login")}><IconInput icon={<UserRound className="size-4" />} name="login" autoComplete="username" required /></Field>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[13px] font-medium text-navy-900">{t("auth.password")}</span>
          {portal !== "admin" && <Link href="/about#contact" className="text-xs font-semibold text-teal-700 hover:underline">{t("authUi.forgot")}</Link>}
        </div>
        <IconInput icon={<Lock className="size-4" />} name="password" type="password" autoComplete="current-password" required aria-label={t("auth.password")} />
      </div>
      {err && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{err}</p>}
      <Button type="submit" size="lg" className="h-12 w-full" loading={busy}>{t("auth.signIn")}<ArrowRight className="size-4" /></Button>
    </form>
  );
}

export function RegisterForm() {
  const t = useTranslations();
  const { register } = useAuth();
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    try {
      await register({ first_name: fd.get("first_name"), last_name: fd.get("last_name"), email: fd.get("email"), phone: fd.get("phone"),
        password: fd.get("password"), consent: fd.get("consent") === "on", preferred_language: document.documentElement.lang });
      router.replace("/dashboard");
    } catch (e2) {
      setErrors(e2 instanceof ApiError ? { ...e2.fieldErrors(), root: e2.message } : { root: t("common.error") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("auth.firstName")} error={errors.first_name} required><Input name="first_name" autoComplete="given-name" required /></Field>
      <Field label={t("auth.lastName")} error={errors.last_name}><Input name="last_name" autoComplete="family-name" /></Field>
      <Field label={t("form.phone")} error={errors.phone} required className="sm:col-span-2"><IconInput icon={<Phone className="size-4" />} name="phone" type="tel" autoComplete="tel" required /></Field>
      <Field label={t("form.email")} error={errors.email} required className="sm:col-span-2"><IconInput icon={<Mail className="size-4" />} name="email" type="email" autoComplete="email" required /></Field>
      <Field label={t("auth.password")} error={errors.password || errors.non_field_errors} hint={t("auth.passwordHint")} required className="sm:col-span-2"><IconInput icon={<Lock className="size-4" />} name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
      <div className="sm:col-span-2">
        <Checkbox name="consent" required label={<>{t("authUi.consentPre")} <Link href="/p/terms-of-use" target="_blank" className="font-semibold text-teal-700 underline-offset-2 hover:underline">{t("authUi.terms")}</Link> {t("authUi.and")} <Link href="/p/privacy-policy" target="_blank" className="font-semibold text-teal-700 underline-offset-2 hover:underline">{t("authUi.privacy")}</Link>{t("authUi.consentPost")}</>} />
        {errors.consent && <p className="mt-1 text-xs text-danger">{errors.consent}</p>}
      </div>
      {errors.root && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2" role="alert">{errors.root}</p>}
      <Button type="submit" size="lg" className="h-12 sm:col-span-2" loading={busy}>{t("auth.register")}<ArrowRight className="size-4" /></Button>
    </form>
  );
}

export function PartnerRegisterForm() {
  const t = useTranslations();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    try {
      await api("/auth/partner-register/", { auth: false, body: { first_name: fd.get("first_name"), last_name: fd.get("last_name"), email: fd.get("email"),
        phone: fd.get("phone"), password: fd.get("password"), hospital_name: fd.get("hospital_name"), consent: fd.get("consent") === "on" } });
      setDone(true);
    } catch (e2) {
      setErrors(e2 instanceof ApiError ? { ...e2.fieldErrors(), root: e2.message } : { root: t("common.error") });
    } finally {
      setBusy(false);
    }
  };
  if (done) return <div className="rounded-2xl bg-teal-50 p-6 text-center"><CheckCircle2 className="mx-auto size-10 text-teal-600" /><p className="mt-3 text-sm text-teal-800">{t("auth.pending")}</p></div>;
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("auth.hospitalName")} error={errors.hospital_name} required className="sm:col-span-2"><Input name="hospital_name" required /></Field>
      <Field label={t("auth.firstName")} error={errors.first_name} required><Input name="first_name" required /></Field>
      <Field label={t("auth.lastName")}><Input name="last_name" /></Field>
      <Field label={t("form.email")} error={errors.email} required><Input name="email" type="email" required /></Field>
      <Field label={t("form.phone")} error={errors.phone} required><Input name="phone" type="tel" required /></Field>
      <Field label={t("auth.password")} error={errors.password || errors.non_field_errors} hint={t("auth.passwordHint")} required className="sm:col-span-2"><Input name="password" type="password" minLength={8} required /></Field>
      <div className="sm:col-span-2"><Checkbox name="consent" label={t("form.consent")} required /></div>
      {errors.root && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">{errors.root}</p>}
      <Button type="submit" size="lg" className="sm:col-span-2" loading={busy}>{t("auth.partnerRegister")}</Button>
    </form>
  );
}
