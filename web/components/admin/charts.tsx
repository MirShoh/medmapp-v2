"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Point = { label: string; value: number };
const MARK = "var(--color-teal-600)";

/** Vertical bars for a time series. Hover tooltip, recessive grid, rounded data-ends at the top only. */
export function BarChart({ data, height = 200, format = (v: number) => String(v), empty }: { data: Point[]; height?: number; format?: (v: number) => string; empty: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length || data.every((d) => !d.value)) return <EmptyChart text={empty} height={height} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const W = 600;
  const pad = { l: 36, r: 8, t: 10, b: 22 };
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const bw = iw / data.length;
  const gap = Math.min(4, bw * 0.25);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" onMouseLeave={() => setHover(null)}>
        {ticks.map((tk) => {
          const y = pad.t + ih - (tk / max) * ih;
          return (
            <g key={tk}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--color-line)" strokeWidth={1} />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-muted)">{format(tk)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = Math.max(d.value ? 2 : 0, (d.value / max) * ih);
          const x = pad.l + i * bw + gap / 2;
          const w = Math.max(1, bw - gap);
          const y = pad.t + ih - h;
          const r = Math.min(4, w / 2, h);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={ih} fill="transparent" />
              <path d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`}
                fill={MARK} opacity={hover === null || hover === i ? 1 : 0.45} />
            </g>
          );
        })}
        {data.length <= 14
          ? data.map((d, i) => <text key={d.label} x={pad.l + i * bw + bw / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink-muted)">{short(d.label)}</text>)
          : [0, Math.floor(data.length / 2), data.length - 1].map((i) => <text key={i} x={pad.l + i * bw + bw / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink-muted)">{short(data[i].label)}</text>)}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs text-white shadow-lift"
          style={{ left: `${((pad.l + hover * bw + bw / 2) / W) * 100}%`, transform: "translateX(-50%)" }}>
          <div className="text-white/60">{data[hover].label}</div>
          <div className="font-semibold">{format(data[hover].value)}</div>
        </div>
      )}
    </div>
  );
}

function short(label: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(label) ? label.slice(5) : /^\d{4}-\d{2}$/.test(label) ? label.slice(2) : label.slice(0, 8);
}

/** Ranked horizontal bars with direct value labels (magnitude by category). */
export function HBarList({ data, empty, format = (v: number) => String(v) }: { data: Point[]; empty: string; format?: (v: number) => string }) {
  if (!data.length) return <EmptyChart text={empty} height={160} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="group" title={`${d.label}: ${format(d.value)}`}>
          <div className="mb-1 flex justify-between gap-3 text-xs">
            <span className="truncate font-medium text-ink">{d.label}</span>
            <span className="shrink-0 font-semibold text-navy-900">{format(d.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-mist">
            <div className="h-full rounded-full transition-all group-hover:opacity-80" style={{ width: `${(d.value / max) * 100}%`, background: MARK }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Funnel: each step's width relative to the first, with conversion vs. the previous step. */
export function Funnel({ data, empty }: { data: Point[]; empty: string }) {
  const first = data[0]?.value || 0;
  if (!first) return <EmptyChart text={empty} height={160} />;
  return (
    <ul className="space-y-1.5">
      {data.map((d, i) => {
        const prev = i ? data[i - 1].value : d.value;
        const pct = prev ? Math.round((d.value / prev) * 100) : 0;
        return (
          <li key={d.label} className="grid grid-cols-[minmax(0,8.5rem)_1fr_3rem] items-center gap-3 text-xs" title={`${d.label}: ${d.value}`}>
            <span className="truncate text-ink-soft">{d.label}</span>
            <div className="h-6 rounded-md bg-mist">
              <div className="flex h-full items-center justify-end rounded-md px-2 text-[11px] font-semibold text-white" style={{ width: `${Math.max(6, (d.value / first) * 100)}%`, background: MARK, opacity: 1 - i * 0.07 }}>
                {d.value}
              </div>
            </div>
            <span className={cn("text-right font-semibold", i ? "text-navy-900" : "text-ink-muted")}>{i ? `${pct}%` : ""}</span>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyChart({ text, height }: { text: string; height: number }) {
  return <div className="grid place-items-center rounded-xl border border-dashed border-line text-xs text-ink-muted" style={{ height }}>{text}</div>;
}
