"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Headset, MessagesSquare, Phone, Send, Sparkles, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Floating support widget. Works without AI: frequent questions are answered from the FAQ, anything else goes to
 * a coordinator as a request (or, for signed-in patients, to the operator chat). With ANTHROPIC_API_KEY set,
 * free-text questions are answered by the AI assistant first.
 */
type Faq = { id: number; question: string; answer: string };
type Site = { settings: { phone: string; socials: Record<string, string> } };
type Msg =
  | { kind: "text"; role: "user" | "assistant"; content: string }
  | { kind: "handoff"; question: string }
  | { kind: "done"; reference: string };

/** Office hours in Tashkent (UTC+5): Mon–Sat 9:00–19:00. */
function isOnline() {
  const now = new Date(Date.now() + 5 * 3600_000);
  const day = now.getUTCDay();
  const h = now.getUTCHours();
  return day !== 0 && h >= 9 && h < 19;
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ'`]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ");

/** Best FAQ for a free-text question (word-stem overlap, question words count double), or null. */
function matchFaq(q: string, faqs: Faq[]) {
  const words = norm(q).split(/\s+/).filter((w) => w.length >= 3).map((w) => w.slice(0, 5));
  if (!words.length) return null;
  let best: Faq | null = null;
  let bestScore = 0;
  for (const f of faqs) {
    const qs = norm(f.question);
    const as = norm(f.answer);
    const score = words.reduce((s, w) => s + (qs.includes(w) ? 2 : as.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { best = f; bestScore = score; }
  }
  return bestScore >= Math.min(3, words.length + 1) ? best : null;
}

export function AssistantWidget() {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [site, setSite] = useState<Site["settings"] | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState("");
  const [online, setOnline] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);

  const say = (...m: Msg[]) => setMsgs((x) => [...x, ...m]);

  const ask = useCallback(async (text: string, list: Faq[] = faqs, aiOn = ai) => {
    say({ kind: "text", role: "user", content: text });
    const hit = list.find((f) => f.question === text) || matchFaq(text, list);
    if (hit) return say({ kind: "text", role: "assistant", content: hit.answer });
    if (!aiOn) return say({ kind: "text", role: "assistant", content: t("handoffIntro") }, { kind: "handoff", question: text });
    setBusy(true);
    try {
      const r = await api<{ reply: string; session: string }>("/assistant/chat/", { body: { message: text, language: locale, session }, auth: false });
      setSession(r.session);
      say({ kind: "text", role: "assistant", content: r.reply });
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) setAi(false);
      say({ kind: "text", role: "assistant", content: t("handoffIntro") }, { kind: "handoff", question: text });
    } finally { setBusy(false); }
  }, [faqs, ai, locale, session, t]);  

  // load FAQ, contacts and AI status once, the first time the widget opens
  useEffect(() => {
    if (!open || ai !== null) return;
    setOnline(isOnline());
    Promise.all([
      api<{ configured: boolean }>("/assistant/status/", { auth: false }).then((r) => r.configured).catch(() => false),
      api<Faq[]>("/public/faqs/", { auth: false }).catch(() => [] as Faq[]),
      api<Site>("/public/site/", { auth: false }).then((r) => r.settings).catch(() => null),
    ]).then(([aiOn, list, s]) => {
      setAi(aiOn);
      setFaqs(list);
      setSite(s);
      if (pending.current) { void ask(pending.current, list, aiOn); pending.current = null; }
    });
  }, [open, ai, ask]);

  // other parts of the site can open the widget: window.dispatchEvent(new CustomEvent("mm:open-support"))
  useEffect(() => {
    const onOpen = (e: Event) => {
      const q = (e as CustomEvent<{ question?: string }>).detail?.question;
      setOpen(true);
      if (q) { if (ai === null) pending.current = q; else void ask(q); }
    };
    window.addEventListener("mm:open-support", onOpen);
    return () => window.removeEventListener("mm:open-support", onOpen);
  }, [ai, ask]);

  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void ask(text);
  };

  const tel = site?.phone?.replace(/[^\d+]/g, "");
  const isPatient = user?.portal === "dashboard";
  const started = msgs.length > 0;

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} aria-label={t("title")} aria-expanded={open}
        className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-navy-900 text-white shadow-lift transition hover:scale-105">
        {!open && <span className="absolute inset-0 rounded-full bg-teal-500/40 animate-pulse-ring" />}
        {open ? <X className="relative size-6" /> : <MessagesSquare className="relative size-6 text-teal-300" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label={t("title")} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-24 right-4 z-40 flex h-[min(600px,calc(100vh-8rem))] w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-lift">
            <div className="bg-hero px-5 pb-4 pt-4 text-white">
              <div className="flex items-center gap-3">
                <div className="relative grid size-10 place-items-center rounded-2xl bg-white/10"><Headset className="size-5 text-teal-300" />
                  <span className={cn("absolute -right-0.5 -top-0.5 size-3 rounded-full ring-2 ring-navy-900", online ? "bg-green-400" : "bg-amber-400")} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[15px] font-bold text-white">{t("title")}</div>
                  <div className="text-[11px] text-white/65">{online ? t("online") : t("offline")}</div>
                </div>
                {started && <button onClick={() => setMsgs([])} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-white/70 hover:bg-white/10 hover:text-white">{t("restart")}</button>}
                <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} title={t("close")}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
              </div>
              <div className="mt-3 flex gap-2 [&>*]:flex-1">
                {site?.socials?.telegram && <Quick href={site.socials.telegram} icon={<Send className="size-4" />} label="Telegram" external />}
                {tel && <Quick href={`tel:${tel}`} icon={<Phone className="size-4" />} label={t("call")} external />}
                {isPatient
                  ? <Quick href="/dashboard/support" icon={<MessagesSquare className="size-4" />} label={t("operator")} onClick={() => setOpen(false)} />
                  : <button type="button" onClick={() => say({ kind: "text", role: "assistant", content: t("handoffIntro") }, { kind: "handoff", question: "" })}
                      className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-2 text-[11px] font-semibold text-white transition hover:bg-white/20"><MessagesSquare className="size-4" />{t("operator")}</button>}
              </div>
            </div>
            <div ref={box} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto bg-mist p-4">
              <Bubble role="assistant">{t("greeting")}</Bubble>
              {!started && faqs.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t("popular")}</div>
                  <div className="flex flex-col items-start gap-1.5">
                    {faqs.slice(0, 6).map((f) => (
                      <button key={f.id} type="button" onClick={() => void ask(f.question)}
                        className="rounded-2xl border border-teal-200 bg-white px-3 py-1.5 text-left text-[13px] font-medium text-teal-800 transition hover:border-teal-400 hover:bg-teal-50">{f.question}</button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => m.kind === "text" ? <Bubble key={i} role={m.role}>{m.content}</Bubble>
                : m.kind === "handoff" ? <Handoff key={i} question={m.question} onDone={(ref) => say({ kind: "done", reference: ref })} />
                : <Bubble key={i} role="assistant"><span className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-green-600" />{t("sent", { ref: m.reference })}</span></Bubble>)}
              {busy && <Bubble role="assistant"><span className="inline-flex gap-1"><Dot /><Dot d={0.15} /><Dot d={0.3} /></span></Bubble>}
              {started && !busy && lastIsAnswer(msgs) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button type="button" onClick={() => say({ kind: "handoff", question: lastUser(msgs) })}
                    className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-navy-900 hover:border-teal-300">{t("notHelpful")}</button>
                  {isPatient && <Link href="/dashboard/support" onClick={() => setOpen(false)} className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-navy-900 hover:border-teal-300">{t("operator")}</Link>}
                </div>
              )}
            </div>
            <form onSubmit={submit} className="flex items-center gap-2 border-t border-line p-3">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("placeholder")} maxLength={2000} aria-label={t("placeholder")}
                className="h-11 flex-1 rounded-xl bg-mist px-3.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/30" />
              <button type="submit" disabled={busy || !input.trim()} aria-label={t("send")}
                className="grid size-11 place-items-center rounded-xl bg-teal-500 text-white transition hover:bg-teal-600 disabled:opacity-40"><Send className="size-4" /></button>
            </form>
            <div className="border-t border-line bg-white px-4 py-1.5 text-center text-[10px] text-ink-muted">
              {ai ? <span className="inline-flex items-center gap-1"><Sparkles className="size-3" />{t("disclaimer")}</span> : t("notDoctor")}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function lastIsAnswer(msgs: Msg[]) {
  const m = msgs[msgs.length - 1];
  return m?.kind === "text" && m.role === "assistant";
}

function lastUser(msgs: Msg[]) {
  for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i]; if (m.kind === "text" && m.role === "user") return m.content; }
  return "";
}

function Quick({ href, icon, label, external, onClick }: { href: string; icon: React.ReactNode; label: string; external?: boolean; onClick?: () => void }) {
  const cls = "flex flex-col items-center gap-1 rounded-xl bg-white/10 py-2 text-[11px] font-semibold text-white transition hover:bg-white/20";
  return external
    ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={cls}>{icon}{label}</a>
    : <Link href={href} onClick={onClick} className={cls}>{icon}{label}</Link>;
}

/** Inline "send this to a coordinator" form: name + phone (+ the question). Creates a CRM request. */
function Handoff({ question, onDone }: { question: string; onDone: (reference: string) => void }) {
  const t = useTranslations("assistant");
  const { user } = useAuth();
  const [name, setName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "+998 ");
  const [text, setText] = useState(question);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) return null;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ reference: string }>("/forms/consultation/", {
        auth: false,
        body: { full_name: name, phone, message: text, consent: true, source: "assistant_widget",
          source_detail: typeof window !== "undefined" ? window.location.pathname : "" },
      });
      setSent(true);
      onDone(r.reference);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? (Object.values(e2.fieldErrors())[0] || e2.message) : t("error"));
    } finally { setBusy(false); }
  };
  const field = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20";
  return (
    <form onSubmit={send} className="space-y-2 rounded-2xl border border-teal-200 bg-white p-3 shadow-card">
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("yourName")} autoComplete="name" required minLength={2} />
      <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998" type="tel" autoComplete="tel" required />
      <textarea className={cn(field, "h-auto min-h-16 py-2")} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("yourQuestion")} rows={2} maxLength={2000} />
      <p className="text-[10px] leading-snug text-ink-muted">{t("consentNote")} <Link href="/p/privacy-policy" target="_blank" className="underline">{t("privacy")}</Link></p>
      {err && <p className="text-xs text-danger">{err}</p>}
      <button type="submit" disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, "").length < 9}
        className="h-10 w-full rounded-xl bg-teal-500 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-40">{busy ? "…" : t("sendToOperator")}</button>
    </form>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={cn("max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
      role === "user" ? "ml-auto rounded-br-md bg-navy-900 text-white" : "rounded-bl-md bg-white text-ink shadow-card")}>
      {children}
    </div>
  );
}
function Dot({ d = 0 }: { d?: number }) {
  return <motion.span className="size-1.5 rounded-full bg-ink-muted" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: d }} />;
}
