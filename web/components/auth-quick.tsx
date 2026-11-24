"use client";

import { ArrowLeft, ArrowRight, KeyRound, MessageSquareText, Phone, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoginForm } from "@/components/auth-forms";
import { Button, Checkbox, Field, Input } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError, api } from "@/lib/api";
import { useAuth, type User } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Methods = { google_client_id: string | null; sms: boolean };

function useMethods() {
  const [m, setM] = useState<Methods | null>(null);
  useEffect(() => { api<Methods>("/auth/methods/", { auth: false }).then(setM).catch(() => setM({ google_client_id: null, sms: false })); }, []);
  return m;
}

function useGoHome() {
  const router = useRouter();
  const params = useSearchParams();
  return (u: User) => {
    const next = params.get("next");
    router.replace(next && next.startsWith(`/${u.portal}`) ? next : `/${u.portal}`);
  };
}

/** Patient sign-in: password or SMS code, plus "Continue with Google". */
export function PatientSignIn() {
  const t = useTranslations("authQuick");
  const params = useSearchParams();
  const methods = useMethods();
  const [mode, setMode] = useState<"password" | "sms">(params.get("method") === "sms" ? "sms" : "password");
  return (
    <div>
      {methods?.sms && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-line p-1" role="tablist">
          {([["password", KeyRound, t("byPassword")], ["sms", MessageSquareText, t("bySms")]] as const).map(([k, Icon, label]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
              className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition",
                mode === k ? "bg-navy-900 text-white" : "text-ink-soft hover:text-navy-900")}>
              <Icon className="size-4" />{label}
            </button>
          ))}
        </div>
      )}
      {mode === "sms" && methods?.sms ? <SmsLogin /> : <LoginForm portal="dashboard" />}
      {methods?.google_client_id && <GoogleBlock clientId={methods.google_client_id} />}
    </div>
  );
}

/** For the registration page: the quicker ways in. */
export function QuickSignUp() {
  const t = useTranslations("authQuick");
  const methods = useMethods();
  if (!methods || (!methods.sms && !methods.google_client_id)) return null;
  return (
    <div className="mt-6">
      <Divider label={t("orFaster")} />
      {methods.sms && (
        <Link href="/login?method=sms" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-white text-sm font-semibold text-navy-900 transition hover:bg-mist">
          <MessageSquareText className="size-4 text-teal-600" />{t("smsSignUp")}
        </Link>
      )}
      {methods.google_client_id && <div className="mt-3"><GoogleButton clientId={methods.google_client_id} /></div>}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium text-ink-muted">
      <span className="h-px flex-1 bg-line" />{label}<span className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleBlock({ clientId }: { clientId: string }) {
  const t = useTranslations("authQuick");
  return <><Divider label={t("or")} /><GoogleButton clientId={clientId} /></>;
}

type GoogleId = {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

function loadGoogle(): Promise<GoogleId> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    let s = document.getElementById("gsi-client") as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = "gsi-client";
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener("load", () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject()));
    s.addEventListener("error", () => reject());
  });
}

/** Google's own button (Google Identity Services); the ID token is checked by our backend. */
function GoogleButton({ clientId }: { clientId: string }) {
  const t = useTranslations("authQuick");
  const locale = useLocale();
  const { signInWith } = useAuth();
  const go = useGoHome();
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadGoogle().then((gid) => {
      if (!alive || !box.current) return;
      gid.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setErr("");
          try {
            const res = await signInWith("/auth/google/", { credential, preferred_language: locale });
            if (res.user) go(res.user);
          } catch (e) { setErr(e instanceof ApiError ? e.message : t("googleError")); }
        },
      });
      box.current.innerHTML = "";
      gid.renderButton(box.current, { theme: "outline", size: "large", text: "continue_with", shape: "rectangular",
        logo_alignment: "center", locale, width: Math.min(400, box.current.offsetWidth || 360) });
    }).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [clientId, locale]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div ref={box} className="flex min-h-11 justify-center" />
      {failed && <p className="text-center text-xs text-ink-muted">{t("googleUnavailable")}</p>}
      {err && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{err}</p>}
    </div>
  );
}

/** Phone → 6-digit code → (new patients only) name + consent. */
function SmsLogin() {
  const t = useTranslations();
  const q = useTranslations("authQuick");
  const locale = useLocale();
  const { signInWith } = useAuth();
  const go = useGoHome();
  const [step, setStep] = useState<"phone" | "code" | "profile">("phone");
  const [phone, setPhone] = useState("+998 ");
  const [shown, setShown] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  const fail = (e: unknown) => {
    if (e instanceof ApiError) {
      const fe = e.fieldErrors();
      setErr(fe.phone || fe.consent || e.message);
    } else setErr(t("common.error"));
  };
  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ phone: string; retry_after: number; dev_code?: string }>("/auth/sms/request/", { body: { phone }, auth: false });
      setShown(r.phone);
      setWait(r.retry_after);
      setDevCode(r.dev_code || "");
      setCode("");
      setStep("code");
    } catch (e2) { fail(e2); } finally { setBusy(false); }
  };
  const verify = async (e?: React.FormEvent, withProfile = false) => {
    e?.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const body: Record<string, unknown> = { phone: shown, code, preferred_language: locale };
      if (withProfile) Object.assign(body, { full_name: name, consent });
      const res = await signInWith("/auth/sms/verify/", body);
      if (res.need_profile) setStep("profile");
      else if (res.user) go(res.user);
    } catch (e2) { fail(e2); } finally { setBusy(false); }
  };

  return (
    <div>
      {step === "phone" && (
        <form onSubmit={requestCode} className="space-y-4">
          <Field label={t("form.phone")} hint={q("phoneHint")}>
            <span className="relative block">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <Input className="h-12 pl-10 text-base tracking-wide" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </span>
          </Field>
          {err && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{err}</p>}
          <Button type="submit" size="lg" className="h-12 w-full" loading={busy} disabled={phone.replace(/\D/g, "").length < 9}>{q("sendCode")}<ArrowRight className="size-4" /></Button>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm text-ink-soft">{q("codeSent", { phone: shown })}</p>
          <Input ref={codeRef} value={code} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); }}
            inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" aria-label={q("code")}
            className="h-14 text-center font-mono text-2xl tracking-[0.5em]" />
          {devCode && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{q("devCode")} <b className="font-mono">{devCode}</b></p>}
          {err && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{err}</p>}
          <Button type="submit" size="lg" className="h-12 w-full" loading={busy} disabled={code.length !== 6}>{t("auth.signIn")}<ArrowRight className="size-4" /></Button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setStep("phone"); setErr(""); }} className="inline-flex items-center gap-1 font-semibold text-ink-soft hover:text-navy-900"><ArrowLeft className="size-3.5" />{q("changePhone")}</button>
            {wait > 0 ? <span className="text-ink-muted">{q("resendIn", { s: wait })}</span>
              : <button type="button" onClick={() => requestCode()} className="font-semibold text-teal-700 hover:underline">{q("resend")}</button>}
          </div>
        </form>
      )}
      {step === "profile" && (
        <form onSubmit={(e) => verify(e, true)} className="space-y-4">
          <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800">{q("newHere")}</p>
          <Field label={q("fullName")} required>
            <span className="relative block">
              <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <Input className="h-12 pl-10" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required autoFocus />
            </span>
          </Field>
          <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={<>{t("authUi.consentPre")} <Link href="/p/terms-of-use" target="_blank" className="font-semibold text-teal-700 hover:underline">{t("authUi.terms")}</Link> {t("authUi.and")} <Link href="/p/privacy-policy" target="_blank" className="font-semibold text-teal-700 hover:underline">{t("authUi.privacy")}</Link>{t("authUi.consentPost")}</>} />
          {err && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{err}</p>}
          <Button type="submit" size="lg" className="h-12 w-full" loading={busy} disabled={name.trim().length < 2 || !consent}>{q("createAndEnter")}<ArrowRight className="size-4" /></Button>
        </form>
      )}
    </div>
  );
}
