"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Loader2, MessageCircle, Phone, Search, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/portal/shell";
import { Empty, Input } from "@/components/ui";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cn, date, initials } from "@/lib/utils";

export type ChatMessage = { id: number; text: string; from_staff: boolean; author_name: string | null; created_at: string; read_at: string | null };

function time(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Message list + composer. `mine` decides which side a message sits on. Enter sends, Shift+Enter adds a line. */
function Conversation({ messages, mine, onSend, placeholder, emptyText, loading }: {
  messages: ChatMessage[]; mine: (m: ChatMessage) => boolean; onSend: (text: string) => Promise<void>;
  placeholder: string; emptyText: string; loading?: boolean;
}) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight; // scroll only the message box, never the page
  }, [messages.length]);
  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try { await onSend(v); setText(""); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  let lastDay = "";
  return (
    <div className="flex h-[calc(100vh-15rem)] min-h-[26rem] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-card">
      <div ref={box} className="scrollbar-thin flex-1 space-y-2 overflow-y-auto bg-mist/40 p-4 sm:p-6">
        {loading ? <div className="grid h-full place-items-center"><Loader2 className="size-6 animate-spin text-teal-600" /></div>
          : !messages.length ? (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-sm">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-600"><MessageCircle className="size-6" /></span>
                <p className="mt-3 text-sm text-ink-soft">{emptyText}</p>
              </div>
            </div>
          ) : messages.map((m) => {
            const day = date(m.created_at, locale);
            const showDay = day !== lastDay;
            lastDay = day;
            const own = mine(m);
            return (
              <div key={m.id}>
                {showDay && <div className="my-3 text-center text-[11px] font-semibold text-ink-muted">{day}</div>}
                <div className={cn("flex", own ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                    own ? "rounded-br-md bg-teal-500 text-white" : "rounded-bl-md bg-white text-navy-900 ring-1 ring-line")}>
                    {!own && m.author_name && <div className="mb-0.5 text-[11px] font-bold text-teal-700">{m.author_name}</div>}
                    <div className="whitespace-pre-line break-words">{m.text}</div>
                    <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", own ? "text-white/70" : "text-ink-muted")}>
                      {time(m.created_at)}{own && m.read_at && <CheckCheck className="size-3" aria-label={t("read")} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        <div ref={end} />
      </div>
      <div className="flex items-end gap-2 border-t border-line bg-white p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={4000} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-line-strong bg-white px-3.5 py-2.5 text-sm text-navy-900 outline-none placeholder:text-ink-muted focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15" />
        <button onClick={() => void send()} disabled={!text.trim() || busy} aria-label={t("send")}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-500 text-white transition hover:bg-teal-600 disabled:opacity-40">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Patient: "Support" chat with the MedMapp team ---------------- */
type SiteContacts = { settings: { phone: string; socials: Record<string, string> } };

export function PatientChat() {
  const t = useTranslations("chat");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me-chat"], queryFn: () => api<ChatMessage[]>("/me/chat/"), refetchInterval: 5000 });
  const site = useQuery({ queryKey: ["site-contacts"], queryFn: () => api<SiteContacts>("/public/site/", { auth: false }), staleTime: 600_000 });
  const s = site.data?.settings;
  const tel = s?.phone?.replace(/[^\d+]/g, "");
  useEffect(() => { qc.invalidateQueries({ queryKey: ["me-chat-unread"] }); }, [q.data, qc]);
  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} actions={<>
        {tel && <a href={`tel:${tel}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold"><Phone className="size-4" />{s?.phone}</a>}
        {s?.socials?.telegram && <a href={s.socials.telegram} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white"><Send className="size-4" />Telegram</a>}
      </>} />
      <div className="max-w-4xl">
        <Conversation messages={q.data || []} loading={q.isLoading} mine={(m) => !m.from_staff}
          placeholder={t("placeholder")} emptyText={t("emptyPatient")}
          onSend={async (text) => { await api("/me/chat/", { body: { text } }); await q.refetch(); }} />
        <p className="mt-3 text-xs text-ink-muted">{t("hint")}</p>
      </div>
    </>
  );
}

/* ---------------- Staff: all conversations ---------------- */
type ChatRow = { patient: number; name: string; phone: string; last_at: string; unread: number; last_text: string; last_from_staff: boolean };
type Thread = { patient: { id: number; name: string; phone: string; email: string }; messages: ChatMessage[] };

export function StaffChats({ initial }: { initial?: number }) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<number | null>(initial ?? null);
  const list = useQuery({ queryKey: ["chats", search], queryFn: () => api<ChatRow[]>(`/admin/chats/${search ? `?q=${encodeURIComponent(search)}` : ""}`), refetchInterval: 8000 });
  const thread = useQuery({ queryKey: ["chat", active], queryFn: () => api<Thread>(`/admin/chats/${active}/`), enabled: !!active, refetchInterval: 5000 });
  useEffect(() => { if (!active && list.data?.length) setActive(list.data[0].patient); }, [list.data, active]);
  useEffect(() => { qc.invalidateQueries({ queryKey: ["chats"] }); }, [thread.data?.messages.length, qc]);
  const open = (id: number) => { setActive(id); router.replace(`${pathname}?patient=${id}`, { scroll: false }); };
  return (
    <>
      <PageTitle title={t("staffTitle")} subtitle={t("staffSubtitle")} />
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="card flex max-h-[calc(100vh-13rem)] flex-col overflow-hidden">
          <div className="relative border-b border-line p-3">
            <Search className="absolute left-6 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <Input className="h-9 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPatient")} />
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {!list.data?.length ? <p className="p-6 text-center text-sm text-ink-muted">{t("noChats")}</p> : list.data.map((c) => (
              <button key={c.patient} onClick={() => open(c.patient)}
                className={cn("flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition hover:bg-mist", active === c.patient && "bg-teal-50")}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-bold text-white">{initials(c.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-navy-900">{c.name}</span>
                    <span className="shrink-0 text-[10px] text-ink-muted">{date(c.last_at, locale)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-ink-muted">{c.last_from_staff ? `${t("you")}: ` : ""}{c.last_text}</span>
                    {c.unread > 0 && <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-teal-500 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          {!active ? <Empty title={t("pick")} /> : (
            <>
              {thread.data && (
                <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-display text-lg font-bold text-navy-900">{thread.data.patient.name}</span>
                  {thread.data.patient.phone && <a href={`tel:${thread.data.patient.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-teal-700 hover:underline"><Phone className="size-3.5" />{thread.data.patient.phone}</a>}
                  <Link href={`/admin/patients/${thread.data.patient.id}`} className="text-xs font-semibold text-ink-muted hover:text-navy-900">{t("openPatient")} →</Link>
                </div>
              )}
              <Conversation messages={thread.data?.messages || []} loading={thread.isLoading} mine={(m) => m.from_staff}
                placeholder={t("replyPlaceholder")} emptyText={t("emptyStaff")}
                onSend={async (text) => { await api(`/admin/chats/${active}/`, { body: { text } }); await thread.refetch(); }} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
