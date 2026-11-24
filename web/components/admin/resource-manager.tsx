"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImageOff, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/portal/shell";
import { Button, Checkbox, Empty, ErrorBox, Field, Input, LoadingBlock, Modal, Select, Textarea } from "@/components/ui";
import { ApiError, api, type Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { cn, date } from "@/lib/utils";
import { RESOURCES, type ColumnDef, type FieldDef, type FilterDef } from "./resources";

type Row = Record<string, unknown> & { id: number };
const LANGS = ["uz", "ru", "en"] as const;

/** Labels in resources.ts are English keys; show them in the admin's language (messages "adminRes"/"adminVal"). */
function useLabels() {
  const t = useTranslations();
  const key = (s: string) => s.replace(/\./g, "");
  return {
    label: (s: string) => (s && t.has(`adminRes.${key(s)}`) ? t(`adminRes.${key(s)}`) : s),
    value: (s: string) => (s && t.has(`adminVal.${key(s)}`) ? t(`adminVal.${key(s)}`) : s),
  };
}

function cell(v: unknown, locale: string) {
  if (v === true) return <Check className="size-4 text-success" />;
  if (v === false) return <X className="size-4 text-ink-muted" />;
  if (v === null || v === undefined || v === "") return <span className="text-ink-muted">—</span>;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return date(v, locale);
  return String(v);
}

/** One table cell, by column type. Toggles save immediately. */
function Cell({ col, row, locale, writable, onToggle, value }: {
  col: ColumnDef; row: Row; locale: string; writable: boolean; onToggle: (row: Row, field: string) => void; value: (s: string) => string;
}) {
  const v = row[col.key];
  if (col.type === "image") {
    const src = typeof v === "string" && v ? mediaUrl(v) : null;
     
    return src ? <img src={src} alt="" className="size-10 rounded-lg object-cover" />
      : <span className="grid size-10 place-items-center rounded-lg bg-danger-soft text-danger"><ImageOff className="size-4" /></span>;
  }
  if (col.type === "toggle") {
    const on = !!v;
    return (
      <button type="button" role="switch" aria-checked={on} aria-label={col.label} disabled={!writable} onClick={() => onToggle(row, col.key)}
        className={cn("relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-teal-500" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    );
  }
  if (col.type === "tr") {
    const missing = (v as string[]) || [];
    return missing.length
      ? <span className="flex gap-1">{missing.map((l) => <span key={l} className="rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning">{l}</span>)}</span>
      : <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success">UZ·RU·EN</span>;
  }
  if (col.type === "value" && typeof v === "string") return <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-medium text-ink-soft">{value(v)}</span>;
  const prefix = col.prefix ? row[col.prefix] : null;
  const sub = col.sub ? row[col.sub] : null;
  return (
    <>
      {prefix ? <span className="mr-1">{String(prefix)}</span> : null}{cell(v, locale)}
      {sub ? <span className="block text-xs text-ink-muted">{String(sub)}</span> : null}
    </>
  );
}

function FilterSelect({ f, value, onChange, all, label, valueLabel }: {
  f: FilterDef; value: string; onChange: (v: string) => void; all: string; label: string; valueLabel: (s: string) => string;
}) {
  const refOpts = useOptions(f.ref, f.refLabel);
  const opts = f.ref ? refOpts : (f.options || []).map((o) => ({ value: o.value, label: valueLabel(o.label) }));
  return (
    <Select className={cn("h-9 w-auto max-w-56", value && "border-teal-500 font-semibold text-teal-700")} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}: {all}</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  );
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[‘’'`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

function useOptions(ref?: string, label?: string) {
  const q = useQuery({
    queryKey: ["ref-opts", ref],
    queryFn: () => api<Paginated<Row>>(`/admin/${ref}/?page_size=500`),
    enabled: !!ref, staleTime: 120_000,
  });
  return (q.data?.results || []).map((r) => ({ value: String(r.id), label: String(r[label || "name"] ?? r.id) }));
}

export function ResourceManager({ resource }: { resource: string }) {
  const def = RESOURCES[resource];
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const L = useLabels();
  useEffect(() => { const id = setTimeout(() => { setTerm(search); setPage(1); }, 300); return () => clearTimeout(id); }, [search]);
  const qs = new URLSearchParams({ page: String(page), page_size: "25", ...(term ? { search: term } : {}), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
  const q = useQuery({ queryKey: ["res", resource, qs.toString()], queryFn: () => api<Paginated<Row>>(`/admin/${resource}/?${qs}`), enabled: !!def });
  if (!def) return <ErrorBox message={`Unknown resource: ${resource}`} />;
  const writable = can(def.perm);

  const refresh = () => qc.invalidateQueries({ queryKey: ["res", resource] });
  const toggle = async (row: Row, field: string) => {
    try {
      await api(`/admin/${resource}/${row.id}/`, { method: "PATCH", body: { [field]: !row[field] } });
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };
  const runBulk = async (field: string, value: boolean) => {
    try {
      const r = await api<{ updated: number }>(`/admin/${resource}/bulk/`, { body: { ids: selected, field, value } });
      toast.success(`${t("common.saved")} · ${r.updated}`);
      setSelected([]);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };
  const ids = (q.data?.results || []).map((r) => r.id);
  const allOnPage = ids.length > 0 && ids.every((id) => selected.includes(id));
  const bulkable = writable && !!def.bulk?.length;

  const remove = async (row: Row) => {
    if (!confirm(t("admin.confirmDelete"))) return;
    try {
      await api(`/admin/${resource}/${row.id}/`, { method: "DELETE" });
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["res", resource] });
    } catch (e) { toast.error((e as Error).message); }
  };
  const pages = Math.ceil((q.data?.count || 0) / 25);
  return (
    <>
      <PageTitle title={t(def.title)} subtitle={q.data ? `${q.data.count} ${t("common.results")}` : undefined}
        actions={writable && <Button onClick={() => setEditing("new")}><Plus className="size-4" />{t("common.add")}</Button>} />
      {(def.search || def.filters) && (
        <div className="card mb-4 flex flex-wrap gap-2 p-3">
          {def.search && <div className="relative min-w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" /><Input className="h-9 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.searchPlaceholder")} /></div>}
          {def.filters?.map((f) => (
            <FilterSelect key={f.name} f={f} value={filters[f.name] || ""} all={t("common.all")} label={L.label(f.label)} valueLabel={(x) => (L.label(x) !== x ? L.label(x) : L.value(x))}
              onChange={(v) => { setFilters({ ...filters, [f.name]: v }); setPage(1); setSelected([]); }} />
          ))}
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => { setFilters({}); setPage(1); }} className="flex h-9 items-center gap-1 px-2 text-sm text-ink-muted hover:text-danger"><X className="size-4" />{t("common.reset")}</button>
          )}
        </div>
      )}
      {bulkable && selected.length > 0 && (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-navy-900 px-4 py-3 text-sm text-white shadow-lift">
          <span className="font-semibold">{t("adminUi.selected", { n: selected.length })}</span>
          <span className="mx-1 h-5 w-px bg-white/20" />
          {def.bulk!.map((b) => (
            <button key={`${b.field}-${b.value}`} onClick={() => runBulk(b.field, b.value)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/15 transition hover:bg-teal-500">{L.label(b.label)}</button>
          ))}
          <button onClick={() => setSelected([])} className="ml-auto rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label={t("common.cancel")}><X className="size-4" /></button>
        </div>
      )}
      {q.isLoading ? <LoadingBlock /> : q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} /> : !q.data?.results.length ? (
        <Empty title={t("common.empty")} action={writable && <Button onClick={() => setEditing("new")}><Plus className="size-4" />{t("common.add")}</Button>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm [&_td]:align-middle">
            <thead className="bg-mist/70 text-left text-xs font-semibold text-ink-muted"><tr>
              {bulkable && <th className="w-10 p-3"><input type="checkbox" aria-label={t("common.all")} checked={allOnPage} onChange={(e) => setSelected(e.target.checked ? [...new Set([...selected, ...ids])] : selected.filter((x) => !ids.includes(x)))} className="size-4 accent-teal-500" /></th>}
              {def.columns.map((c) => <th key={c.key} className="p-3">{L.label(c.label)}</th>)}<th className="w-24 p-3" />
            </tr></thead>
            <tbody className="divide-y divide-line">
              {q.data.results.map((r) => (
                <tr key={r.id} className={cn("hover:bg-mist/50", selected.includes(r.id) && "bg-teal-50/60")}>
                  {bulkable && <td className="p-3"><input type="checkbox" aria-label={String(r.id)} checked={selected.includes(r.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))} className="size-4 accent-teal-500" /></td>}
                  {def.columns.map((c) => {
                    const main = c.key === def.columns.find((x) => !x.type)?.key;
                    return (
                      <td key={c.key} className={cn("max-w-64 truncate p-3", main && "font-semibold text-navy-900")}>
                        {main && writable
                          ? <button onClick={() => setEditing(r)} className="max-w-64 text-left">
                              <span className="block truncate hover:text-teal-700 hover:underline">{cell(r[c.key], locale)}</span>
                              {c.sub && r[c.sub] ? <span className="block truncate text-xs font-normal text-ink-muted">{String(r[c.sub])}</span> : null}
                            </button>
                          : <Cell col={c} row={r} locale={locale} writable={writable} onToggle={toggle} value={L.value} />}
                      </td>
                    );
                  })}
                  <td className="p-3 text-right">
                    {writable && <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(r)} className="rounded-lg p-1.5 text-ink-muted hover:bg-mist hover:text-navy-900" aria-label={t("common.edit")}><Pencil className="size-4" /></button>
                      {resource !== "site-settings" && <button onClick={() => remove(r)} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" aria-label={t("common.delete")}><Trash2 className="size-4" /></button>}
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-line p-3 text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.back")}</Button>
              <span>{page}/{pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("common.next")}</Button>
            </div>
          )}
        </div>
      )}
      {editing && <EditForm resource={resource} row={editing === "new" ? null : editing} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["res", resource] }); qc.invalidateQueries({ queryKey: ["ref-opts", resource] }); }} />}
    </>
  );
}

function EditForm({ resource, row, onClose, onSaved }: { resource: string; row: Row | null; onClose: () => void; onSaved: () => void }) {
  const def = RESOURCES[resource];
  const t = useTranslations();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    def.fields.forEach((f) => {
      if (f.tr) LANGS.forEach((l) => (init[`${f.name}_${l}`] = row?.[`${f.name}_${l}`] ?? ""));
      else if (f.type === "bool") init[f.name] = row ? !!row[f.name] : ["is_active", "is_enabled", "is_published"].includes(f.name);
      else if (f.type === "m2m") init[f.name] = (row?.[f.name] as number[]) || [];
      else if (f.type === "json") init[f.name] = row ? JSON.stringify(row[f.name] ?? [], null, 2) : "[]";
      else if (f.type === "image" || f.type === "file") init[f.name] = null;
      else init[f.name] = row?.[f.name] ?? (f.type === "select" ? f.options?.[0] : "");
    });
    return init;
  });
  const [lang, setLang] = useState<(typeof LANGS)[number]>("uz");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setValues((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    setErrors({});
    const hasFile = def.fields.some((f) => (f.type === "image" || f.type === "file") && values[f.name] instanceof File);
    const payload: Record<string, unknown> = {};
    for (const f of def.fields) {
      if (f.tr) {
        LANGS.forEach((l) => (payload[`${f.name}_${l}`] = values[`${f.name}_${l}`]));
        payload[f.name] = values[`${f.name}_uz`] || values[`${f.name}_ru`] || values[`${f.name}_en`] || "";
      } else if (f.type === "image" || f.type === "file") {
        if (values[f.name] instanceof File) payload[f.name] = values[f.name];
      } else if (f.type === "json") {
        try { payload[f.name] = JSON.parse(String(values[f.name] || "[]")); } catch { setErrors({ [f.name]: "Invalid JSON" }); setBusy(false); return; }
      } else if (f.type === "fk" || f.type === "number" || f.type === "date" || f.type === "datetime") {
        const empty = values[f.name] === "" || values[f.name] === null || values[f.name] === undefined;
        if (empty && !row) continue; // new record: leave empty optional fields to the model defaults
        payload[f.name] = empty ? null : f.type === "datetime" ? new Date(String(values[f.name])).toISOString() : values[f.name];
      } else payload[f.name] = values[f.name];
    }
    try {
      const url = row ? `/admin/${resource}/${row.id}/` : `/admin/${resource}/`;
      const method = row ? "PATCH" : "POST";
      if (hasFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v === null || v === undefined) return;
          if (Array.isArray(v)) v.forEach((x) => fd.append(k, typeof x === "object" ? JSON.stringify(x) : String(x)));
          else if (v instanceof File) fd.append(k, v);
          else if (typeof v === "object") fd.append(k, JSON.stringify(v));
          else fd.append(k, String(v));
        });
        await api(url, { method, form: fd });
      } else await api(url, { method, body: payload });
      toast.success(t("common.saved"));
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors());
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const hasTr = def.fields.some((f) => f.tr);
  return (
    <Modal open onClose={onClose} wide title={`${row ? t("common.edit") : t("common.create")} · ${t(def.title)}`}>
      {hasTr && (
        <div className="mb-4 flex items-center gap-2 text-xs">
          <span className="font-semibold text-ink-muted">{t("admin.translations")}:</span>
          {LANGS.map((l) => <button key={l} type="button" onClick={() => setLang(l)} className={cn("rounded-lg px-3 py-1.5 font-bold uppercase", lang === l ? "bg-navy-900 text-white" : "bg-mist text-ink-soft")}>{l}</button>)}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {def.fields.map((f) => <FieldInput key={f.name} f={f} lang={lang} values={values} set={set} errors={errors} row={row} />)}
      </div>
      <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={save} loading={busy}>{t("common.save")}</Button>
      </div>
    </Modal>
  );
}

function FieldInput({ f, lang, values, set, errors, row }: { f: FieldDef; lang: string; values: Record<string, unknown>; set: (k: string, v: unknown) => void; errors: Record<string, string>; row: Row | null }) {
  const opts = useOptions(f.type === "fk" || f.type === "m2m" ? f.ref : undefined, f.refLabel);
  const L = useLabels();
  const t = useTranslations();
  const key = f.tr ? `${f.name}_${lang}` : f.name;
  const err = errors[key] || errors[f.name];
  const label = f.tr ? `${L.label(f.label)} (${lang.toUpperCase()})` : L.label(f.label);
  const wide = f.wide || f.type === "textarea" || f.type === "rich" || f.type === "m2m" || f.type === "json";
  const v = values[key];
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => opts.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase())), [opts, filter]);

  if (f.type === "bool") return <div className="flex items-end pb-2"><Checkbox label={L.label(f.label)} checked={!!v} onChange={(e) => set(key, e.target.checked)} /></div>;
  return (
    <Field label={label} error={err} required={f.required && (!f.tr || lang === "uz")} hint={f.help && L.label(f.help)} className={wide ? "sm:col-span-2" : ""}>
      {f.type === "textarea" || f.type === "rich" ? <Textarea rows={f.type === "rich" ? 6 : 3} value={String(v ?? "")} onChange={(e) => set(key, e.target.value)} />
        : f.type === "json" ? <Textarea rows={5} className="font-mono text-xs" value={String(v ?? "")} onChange={(e) => set(key, e.target.value)} />
        : f.type === "select" ? <Select value={String(v ?? "")} onChange={(e) => set(key, e.target.value)}>{f.options?.map((o) => <option key={o} value={o}>{L.value(o)}</option>)}</Select>
        : f.type === "fk" ? <Select value={String(v ?? "")} onChange={(e) => set(key, e.target.value)}><option value="">—</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
        : f.type === "m2m" ? (
          <div className="rounded-xl border border-line-strong p-2">
            <Input className="mb-2 h-8 text-xs" placeholder={t("ui.typeToSearch")} value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="scrollbar-thin flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
              {shown.map((o) => {
                const sel = ((v as number[]) || []).map(String).includes(o.value);
                return <button type="button" key={o.value} onClick={() => set(key, sel ? (v as number[]).filter((x) => String(x) !== o.value) : [...((v as number[]) || []), Number(o.value)])}
                  className={cn("rounded-full border px-2.5 py-1 text-xs", sel ? "border-teal-500 bg-teal-500 text-white" : "border-line text-ink-soft hover:border-teal-300")}>{o.label}</button>;
              })}
            </div>
          </div>
        )
        : f.type === "image" || f.type === "file" ? (
          <div className="flex items-center gap-3">
            { }
            {typeof row?.[f.name] === "string" && !!row[f.name] && <img src={mediaUrl(row[f.name] as string)!} alt="" className="size-12 rounded-lg object-cover" />}
            <input type="file" accept={f.type === "image" ? "image/*" : undefined} onChange={(e) => set(key, e.target.files?.[0] || null)} className="text-xs" />
          </div>
        )
        : <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : "text"} step={f.type === "number" ? "any" : undefined}
            value={f.type === "datetime" && v ? String(v).slice(0, 16) : String(v ?? "")}
            onChange={(e) => set(key, e.target.value)}
            onFocus={() => {
              if (f.type !== "slug" || v) return;
              const src = ["name_en", "title_en", "full_name_en", "name_uz", "title_uz", "full_name_uz", "name", "code"].map((k) => values[k]).find(Boolean);
              if (src) set(key, slugify(String(src)));
            }} />}
    </Field>
  );
}
