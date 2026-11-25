"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCheck, ChevronDown, Download, FileText, Headset, Loader2, MessagesSquare, Paperclip, Phone, Send, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { playPing } from "@/lib/sound";
import { cn, fileSize } from "@/lib/utils";
import { ConsultButton } from "./hero-actions";

/**
 * Floating live chat. Visitors write to a MedMapp operator, who answers in real time from the admin "Chats" page.
 * Text, photos and documents both ways. Signed-in patients use their own patient chat (same thread as in the
 * cabinet); everyone else gets a visitor chat whose token lives in localStorage. Chats are not leads — leads come
 * only from the free-consultation form (the "Consultation" button here opens it).
 */
type Faq = { id: number; question: string; answer: string };
type Site = { settings: { phone: string; socials: Record<string, string> } };
type Attachment = { name: string; size: number; type: string; is_image: boolean; url: string | null };
type Msg = { id: number; text: string; from_staff: boolean; author_name: string | null; created_at: string; read_at: string | null; attachment?: Attachment | null };
type VisitorThread = { chat: { id: number; name: string; phone: string }; messages: Msg[] };

const TOKEN_KEY = "mm_live_chat";
const CONTACT_KEY = "mm_live_chat_contact";
const ALLOWED = /\.(pdf|jpe?g|png|webp|dcm|docx?|txt|zip)$/i;
const MAX_MB = 25;

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** Office hours in Tashkent (UTC+5): Mon–Sat 9:00–19:00. */
function isOnline() {
  const now = new Date(Date.now() + 5 * 3600_000);
  const day = now.getUTCDay();
  const h = now.getUTCHours();
  return day !== 0 && h >= 9 && h < 19;
}

const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export function AssistantWidget() {
  const t = useTranslations("assistant");
  const tc = useTranslations("chat");
  const locale = useLocale();
  const { user } = useAuth();
  const isPatient = user?.portal === "dashboard";
  const [open, setOpen] = useState(false);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [shownFaq, setShownFaq] = useState<Faq[]>([]);
  const [site, setSite] = useState<Site["settings"] | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [token, setToken] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [askContact, setAskContact] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notice, setNotice] = useState<{ author: string; text: string } | null>(null);
  const lastStaff = useRef<number | null>(null); // newest operator message id already seen (null = not loaded yet)
  const lastCount = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasChat = isPatient || !!token;

  useEffect(() => { setToken(store.get(TOKEN_KEY)); }, []);

  /** Fetch the conversation. `peek` (widget closed) does not mark operator replies as read. */
  const load = useCallback(async (peek = false) => {
    try {
      if (isPatient) {
        // the patient chat marks replies read on GET; while closed only ask for the unread count
        if (peek) {
          const n = (await api<{ count: number }>("/me/chat/unread/")).count;
          if (lastCount.current !== null && n > lastCount.current) {
            playPing();
            setNotice({ author: t("operatorName"), text: "" });
          }
          lastCount.current = n;
          setUnread(n);
          return;
        }
        const list = await api<Msg[]>("/me/chat/");
        setMsgs(list);
        noticeNew(list, false);
        lastCount.current = 0;
        setUnread(0);
      } else if (token) {
        const r = await api<VisitorThread>(`/live-chat/?token=${encodeURIComponent(token)}${peek ? "&peek=1" : ""}`, { auth: false });
        setMsgs(r.messages);
        noticeNew(r.messages, peek);
        setUnread(peek ? r.messages.filter((m) => m.from_staff && !m.read_at).length : 0);
      }
      setLoaded(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && !isPatient) { store.set(TOKEN_KEY, ""); setToken(""); setMsgs([]); }
    }
  }, [isPatient, token]); // eslint-disable-line react-hooks/exhaustive-deps

  /** A new operator message the visitor has not seen yet: ping + preview card (closed widget or background tab). */
  function noticeNew(list: Msg[], quiet: boolean) {
    const newest = [...list].reverse().find((m) => m.from_staff);
    if (!newest) { lastStaff.current = lastStaff.current ?? 0; return; }
    if (lastStaff.current !== null && newest.id > lastStaff.current && quiet) {
      playPing();
      setNotice({ author: newest.author_name || t("operatorName"), text: newest.text || (newest.attachment ? `📎 ${newest.attachment.name}` : "") });
    }
    lastStaff.current = Math.max(lastStaff.current ?? 0, newest.id);
  }

  // Real time: every 3 s while open and visible (marks replies read). Otherwise peek every 8 s for the badge,
  // the sound and the preview card, without marking anything read.
  useEffect(() => {
    if (!hasChat) return;
    const tick = () => { const active = open && document.visibilityState === "visible"; void load(!active); };
    tick();
    const id = setInterval(tick, open ? 3000 : 8000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [open, hasChat, load]);

  // unread count in the tab title; the preview card goes away once the chat is open
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread ? `(${unread}) ${base}` : base;
  }, [unread]);
  useEffect(() => { if (open) setNotice(null); }, [open]);

  // FAQ and contacts, the first time the widget opens
  useEffect(() => {
    if (!open || site) return;
    setOnline(isOnline());
    Promise.all([
      api<Faq[]>("/public/faqs/", { auth: false }).catch(() => [] as Faq[]),
      api<Site>("/public/site/", { auth: false }).then((r) => r.settings).catch(() => null),
    ]).then(([list, s]) => { setFaqs(list); setSite(s || { phone: "", socials: {} }); });
  }, [open, site]);

  // other parts of the site can open the widget: window.dispatchEvent(new CustomEvent("mm:open-support", {detail: {question}}))
  useEffect(() => {
    const onOpen = (e: Event) => {
      const q = (e as CustomEvent<{ question?: string }>).detail?.question;
      setOpen(true);
      if (q) setInput(q);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    window.addEventListener("mm:open-support", onOpen);
    return () => window.removeEventListener("mm:open-support", onOpen);
  }, []);

  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, shownFaq.length, open, askContact]);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const pick = (f?: File | null) => {
    if (!f) return;
    if (!ALLOWED.test(f.name)) { toast.error(tc("fileType")); return; }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(tc("fileSize", { mb: MAX_MB })); return; }
    setFile(f);
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !file) || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("text", text);
      if (file) fd.append("file", file);
      if (isPatient) {
        await api("/me/chat/", file ? { form: fd } : { body: { text } });
      } else {
        fd.append("page", window.location.pathname);
        fd.append("language", locale);
        if (token) fd.append("token", token);
        const r = await api<{ token: string }>("/live-chat/", { form: fd, auth: false });
        if (r.token !== token) { store.set(TOKEN_KEY, r.token); setToken(r.token); }
        if (!store.get(CONTACT_KEY)) setAskContact(true);
      }
      setInput("");
      setFile(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.fieldErrors())[0] || e.message) : t("failed"));
    } finally { setBusy(false); }
  };

  const tel = site?.phone?.replace(/[^\d+]/g, "");
  const lastOwn = [...msgs].reverse().find((m) => !m.from_staff);
  const waiting = !!lastOwn && !msgs.some((m) => m.from_staff && m.created_at > lastOwn.created_at);

  return (
    <>
      <AnimatePresence>
        {notice && !open && (
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-24 right-5 z-40 w-[min(20rem,calc(100vw-2.5rem))]">
            <div role="status" className="relative cursor-pointer rounded-2xl border border-line bg-white p-3.5 pr-9 shadow-lift" onClick={() => setOpen(true)}>
              <div className="flex items-center gap-2.5">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-hero text-teal-300"><Headset className="size-4" />
                  <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-green-400 ring-2 ring-white" /></span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-navy-900">{notice.author}</p>
                  <p className="text-[11px] text-ink-muted">{t("newReply")}</p>
                </div>
              </div>
              {notice.text && <p className="mt-2 line-clamp-3 break-words text-sm leading-snug text-ink">{notice.text}</p>}
              <span className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-500 px-3 text-xs font-semibold text-white"><MessagesSquare className="size-3.5" />{t("replyNow")}</span>
              <button type="button" aria-label={t("close")} onClick={(e) => { e.stopPropagation(); setNotice(null); }}
                className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-ink-muted hover:bg-mist hover:text-navy-900"><X className="size-4" /></button>
              <span className="absolute -bottom-1.5 right-7 size-3 rotate-45 border-b border-r border-line bg-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={() => setOpen((v) => !v)} aria-label={t("title")} aria-expanded={open}
        className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-navy-900 text-white shadow-lift transition hover:scale-105">
        {!open && !unread && <span className="absolute inset-0 rounded-full bg-teal-500/40 animate-pulse-ring" />}
        {open ? <ChevronDown className="relative size-6" /> : <MessagesSquare className="relative size-6 text-teal-300" />}
        {!open && unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-6 place-items-center rounded-full bg-danger px-1.5 text-xs font-bold text-white ring-2 ring-white">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label={t("title")} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-2 bottom-2 top-2 z-[60] flex flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-lift sm:inset-x-auto sm:bottom-24 sm:right-4 sm:top-auto sm:h-[min(620px,calc(100vh-8rem))] sm:w-[25rem]"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
            <div className="bg-hero px-5 pb-4 pt-4 text-white">
              <div className="flex items-center gap-3">
                <div className="relative grid size-10 place-items-center rounded-2xl bg-white/10"><Headset className="size-5 text-teal-300" />
                  <span className={cn("absolute -right-0.5 -top-0.5 size-3 rounded-full ring-2 ring-navy-900", online ? "bg-green-400" : "bg-amber-400")} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[15px] font-bold text-white">{t("title")}</div>
                  <div className="text-[11px] text-white/65">{online ? t("online") : t("offline")}</div>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} title={t("close")}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
              </div>
              <div className="mt-3 flex gap-2 [&>*]:flex-1">
                {site?.socials?.telegram && <Quick href={site.socials.telegram} icon={<Send className="size-4" />} label="Telegram" />}
                {tel && <Quick href={`tel:${tel}`} icon={<Phone className="size-4" />} label={t("call")} />}
                <ConsultButton source="assistant_widget" label={t("consult")} icon
                  className="!h-auto flex-col !gap-1 !rounded-xl !bg-white/10 !px-0 !py-2 !text-[11px] !font-semibold !text-white !shadow-none hover:!bg-white/20" />
              </div>
            </div>
            <div ref={box} className="scrollbar-thin flex-1 space-y-2.5 overflow-y-auto bg-mist p-4">
              <Bubble staff>{t("greeting")}</Bubble>
              {!msgs.length && faqs.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t("popular")}</div>
                  <div className="flex flex-col items-start gap-1.5">
                    {faqs.filter((f) => !shownFaq.includes(f)).slice(0, 5).map((f) => (
                      <button key={f.id} type="button" onClick={() => setShownFaq((x) => [...x, f])}
                        className="rounded-2xl border border-teal-200 bg-white px-3 py-1.5 text-left text-[13px] font-medium text-teal-800 transition hover:border-teal-400 hover:bg-teal-50">{f.question}</button>
                    ))}
                  </div>
                </div>
              )}
              {shownFaq.map((f) => (
                <div key={f.id} className="space-y-2.5"><Bubble>{f.question}</Bubble><Bubble staff>{f.answer}</Bubble></div>
              ))}
              {hasChat && !loaded && <div className="grid place-items-center py-4"><Loader2 className="size-5 animate-spin text-teal-600" /></div>}
              {msgs.map((m) => (
                <Bubble key={m.id} staff={m.from_staff} author={m.from_staff ? (m.author_name || t("operatorName")) : undefined}
                  time={hhmm(m.created_at)} read={!m.from_staff && !!m.read_at}>
                  {m.attachment && <AttachmentView a={m.attachment} own={!m.from_staff} />}
                  {m.text}
                </Bubble>
              ))}
              {waiting && <p className="px-1 text-center text-[11px] text-ink-muted">{online ? t("waiting") : t("offlineNote")}</p>}
              {askContact && !isPatient && token && <ContactCard token={token} onClose={() => { store.set(CONTACT_KEY, "1"); setAskContact(false); }} />}
            </div>
            {file && (
              <div className="flex items-center gap-3 border-t border-line bg-mist/60 px-3 py-2">
                {preview ? <img src={preview} alt="" className="size-11 rounded-lg object-cover" /> : <span className="grid size-11 place-items-center rounded-lg bg-white text-teal-600"><FileText className="size-5" /></span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-navy-900">{file.name}</span><span className="text-[11px] text-ink-muted">{fileSize(file.size)}</span></span>
                <button type="button" onClick={() => setFile(null)} aria-label={tc("removeFile")} className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-white hover:text-danger"><X className="size-4" /></button>
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2 border-t border-line p-3">
              <button type="button" onClick={() => picker.current?.click()} aria-label={t("attach")} title={t("attach")}
                className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-soft transition hover:bg-mist hover:text-teal-600"><Paperclip className="size-5" /></button>
              <input ref={picker} type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm,.doc,.docx,.txt,.zip,image/*" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={4000} placeholder={t("placeholder")} aria-label={t("placeholder")}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                onPaste={(e) => { const f = Array.from(e.clipboardData.files || [])[0]; if (f) { e.preventDefault(); pick(f); } }}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl bg-mist px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/30" />
              <button type="submit" disabled={busy || (!input.trim() && !file)} aria-label={t("send")}
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-500 text-white transition hover:bg-teal-600 disabled:opacity-40">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </form>
            <div className="border-t border-line bg-white px-4 py-1.5 text-center text-[10px] text-ink-muted">{t("notDoctor")}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Quick({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
      className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-2 text-[11px] font-semibold text-white transition hover:bg-white/20">{icon}{label}</a>
  );
}

/** Optional "leave your name and phone" card after the first message. Saved on the chat, not as a lead. */
function ContactCard({ token, onClose }: { token: string; onClose: () => void }) {
  const t = useTranslations("assistant");
  const { user } = useAuth();
  const [name, setName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "+998 ");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <Bubble staff><span className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-green-600" />{t("contactSaved")}</span></Bubble>;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/live-chat/contact/", { auth: false, body: { token, name, phone } });
      setDone(true);
      setTimeout(onClose, 2500);
    } catch (e2) {
      toast.error(e2 instanceof ApiError ? (Object.values(e2.fieldErrors())[0] || e2.message) : t("error"));
    } finally { setBusy(false); }
  };
  const field = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20";
  return (
    <form onSubmit={save} className="space-y-2 rounded-2xl border border-teal-200 bg-white p-3 shadow-card">
      <p className="text-[12px] leading-snug text-ink-soft">{t("contactTitle")}</p>
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("yourName")} autoComplete="name" />
      <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998" type="tel" autoComplete="tel" />
      <div className="flex gap-2">
        <button type="submit" disabled={busy || (name.trim().length < 2 && phone.replace(/\D/g, "").length < 9)}
          className="h-9 flex-1 rounded-xl bg-teal-500 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-40">{busy ? "…" : t("contactSave")}</button>
        <button type="button" onClick={onClose} className="h-9 rounded-xl px-3 text-sm font-semibold text-ink-muted hover:bg-mist">{t("contactSkip")}</button>
      </div>
    </form>
  );
}

function AttachmentView({ a, own }: { a: Attachment; own: boolean }) {
  if (!a.url) return null;
  const inline = `${a.url}${a.url.includes("?") ? "&" : "?"}inline=1`;
  if (a.is_image) {
    return <a href={inline} target="_blank" rel="noopener noreferrer" className="mb-1 block overflow-hidden rounded-xl"><img src={inline} alt={a.name} className="max-h-56 w-full object-cover" loading="lazy" /></a>;
  }
  return (
    <a href={a.url} className={cn("mb-1 flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition", own ? "bg-white/15 hover:bg-white/25" : "bg-mist hover:bg-teal-50")}>
      <FileText className="size-4 shrink-0" />
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{a.name}</span><span className={cn("block text-[10px]", own ? "text-white/70" : "text-ink-muted")}>{fileSize(a.size)}</span></span>
      <Download className="size-4 shrink-0 opacity-70" />
    </a>
  );
}

function Bubble({ staff, author, time, read, children }: { staff?: boolean; author?: string; time?: string; read?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
      staff ? "rounded-bl-md bg-white text-ink shadow-card" : "ml-auto rounded-br-md bg-navy-900 text-white")}>
      {author && <div className="mb-0.5 text-[11px] font-bold text-teal-700">{author}</div>}
      {children}
      {time && <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", staff ? "text-ink-muted" : "text-white/60")}>{time}{read && <CheckCheck className="size-3" />}</div>}
    </div>
  );
}
