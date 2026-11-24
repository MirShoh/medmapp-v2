"use client";

/** Browser API client. Same-origin `/api/v2` (proxied to Django). Handles JWT refresh rotation. */
const BASE = "/api/v2";
const LEGACY_KEY = "medmapp.auth";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    super(extractMessage(data) || `Request failed (${status})`);
    this.status = status;
    this.data = data;
  }
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.data && typeof this.data === "object") {
      for (const [k, v] of Object.entries(this.data as Record<string, unknown>)) {
        if (Array.isArray(v)) out[k] = String(v[0]);
        else if (typeof v === "string" && k !== "detail") out[k] = v;
      }
    }
    return out;
  }
}

function extractMessage(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return data.slice(0, 200);
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.detail === "string") return d.detail;
    const first = Object.entries(d)[0];
    if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : String(first[1])}`;
  }
  return "";
}

/**
 * Session model (XSS-hardened):
 * - access token: kept in memory only (lost on reload, restored via refresh)
 * - refresh token: httpOnly cookie set by the backend on /api/v2/auth/* — never visible to JavaScript
 */
export type Tokens = { access: string };

let accessToken: string | null = null;

export function getTokens(): Tokens | null {
  return accessToken ? { access: accessToken } : null;
}

export function setTokens(t: Tokens | null) {
  accessToken = t?.access ?? null;
  try {
    window.localStorage.removeItem(LEGACY_KEY); // remove tokens stored by older versions
  } catch {
    /* storage unavailable */
  }
}

let refreshing: Promise<string | null> | null = null;

/** Exchange the httpOnly refresh cookie for a new access token. Returns null when there is no session. */
export async function refreshAccess(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      // A busy server (429) or a restart (5xx, network) is not "logged out": retry before giving up the session.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await fetch(`${BASE}/auth/refresh/`, {
            method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}",
          });
          if (r.ok) {
            accessToken = ((await r.json()) as { access: string }).access;
            return accessToken;
          }
          if (r.status !== 429 && r.status < 500) break; // 401/403: there really is no session
        } catch { /* network error: retry */ }
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
      }
      accessToken = null;
      return null;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

function currentLocale() {
  if (typeof document === "undefined") return "uz";
  return document.documentElement.lang || "uz";
}

type Opts = { method?: string; body?: unknown; form?: FormData; raw?: boolean; auth?: boolean };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const doFetch = async (token?: string | null) => {
    const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": currentLocale() };
    if (!opts.form && opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${BASE}${path}`, {
      method: opts.method || (opts.body !== undefined || opts.form ? "POST" : "GET"),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  };
  const useAuth = opts.auth !== false;
  let res = await doFetch(useAuth ? accessToken : null);
  if (res.status === 401 && useAuth) {
    const fresh = await refreshAccess();
    if (fresh) res = await doFetch(fresh);
  }
  if (opts.raw) {
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res as unknown as T;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Download a protected CSV/file through the authenticated client. */
export async function downloadAuthed(path: string, filename: string) {
  const res = await api<Response>(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Request a signed, expiring link for a private document and open it.
 * The tab is opened synchronously (inside the click) so popup blockers allow it, then pointed at the link. */
export async function openSignedLink(linkEndpoint: string) {
  const win = window.open("about:blank", "_blank");
  try {
    const { url } = await api<{ url: string }>(linkEndpoint, { method: "POST" });
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else window.location.href = url;
  } catch (e) {
    win?.close();
    throw e;
  }
}

export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };
