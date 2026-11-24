/**
 * MedMapp signature visual: two-way care routes.
 * Blue routes: patients from Uzbekistan travel to partner clinics abroad.
 * Green routes: patients from neighbouring countries come to Uzbekistan for treatment.
 * Schematic positions (not to scale), arranged so labels never overlap.
 */
type P = { x: number; y: number; label: string };

const HUB: P = { x: 470, y: 200, label: "Uzbekistan" };
const OUT: P[] = [
  { x: 95, y: 95, label: "Germany" },
  { x: 215, y: 185, label: "Turkey" },
  { x: 320, y: 120, label: "Azerbaijan" },
  { x: 345, y: 305, label: "UAE" },
  { x: 520, y: 330, label: "India" },
  { x: 680, y: 350, label: "Thailand" },
  { x: 745, y: 230, label: "China" },
  { x: 835, y: 150, label: "Korea" },
];
const IN: P[] = [  // CIS countries whose patients come to Uzbekistan
  { x: 560, y: 70, label: "Kazakhstan" },
  { x: 665, y: 140, label: "Kyrgyzstan" },
  { x: 615, y: 265, label: "Tajikistan" },
  { x: 335, y: 245, label: "Turkmenistan" },
  { x: 420, y: 55, label: "Russia" },
  { x: 215, y: 50, label: "Belarus" },
];

function arc(a: P, b: P, lift = 0.3) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - Math.hypot(a.x - b.x, a.y - b.y) * lift - 10;
  return `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`;
}

const BLUE = "#5FA8F5";
const GREEN = "#2BD67F";

export function RouteMap({ caption, labels = {}, legendOut, legendIn }: {
  caption?: string; labels?: Record<string, string>; legendOut?: string; legendIn?: string;
}) {
  const L = (k: string) => labels[k] || k;
  return (
    <div className="relative">
      {(legendOut || legendIn) && (
        <div className="mb-1 flex flex-wrap items-center justify-center gap-2 text-[13px] font-semibold text-white">
          {legendOut && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#0D7BE8]/20 px-3 py-1.5 ring-1 ring-[#5FA8F5]/40">
              <span className="size-2.5 rounded-full bg-[#5FA8F5]" />{legendOut}
            </span>
          )}
          {legendIn && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#0FB861]/20 px-3 py-1.5 ring-1 ring-[#2BD67F]/40">
              <span className="size-2.5 rounded-full bg-[#2BD67F]" />{legendIn}
            </span>
          )}
        </div>
      )}
      <svg viewBox="40 22 840 373" className="w-full" role="img" aria-label={[caption, legendOut, legendIn].filter(Boolean).join(". ")}>
        <defs>
          <radialGradient id="mm-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2BD67F" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#2BD67F" stopOpacity="0" />
          </radialGradient>
          <pattern id="mm-dots" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.2" fill="rgba(255,255,255,0.13)" />
          </pattern>
        </defs>
        {/* stylised Eurasia made of dots */}
        <path fill="url(#mm-dots)" d="M60,90 C95,55 190,45 260,60 C330,35 430,30 520,40 C620,30 740,45 830,75 C880,95 890,140 870,175 C850,215 800,225 770,250 C745,290 740,350 700,375 C670,365 640,335 600,345 C570,370 540,370 520,350 C495,315 450,330 400,330 C360,335 330,320 310,300 C290,275 250,250 210,240 C160,230 110,210 85,180 C55,150 40,115 60,90 Z" />

        {/* outbound: Uzbekistan -> abroad */}
        {OUT.map((d, i) => {
          const path = arc(HUB, d);
          return (
            <g key={d.label}>
              <path d={path} fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" className="route-line mm-fade" style={{ animationDelay: `0s, ${0.2 + i * 0.1}s` }} />
              <circle r="3" fill="#fff">
                <animateMotion dur={`${3.2 + (i % 3) * 0.6}s`} begin={`${i * 0.35}s`} repeatCount="indefinite" path={path} />
              </circle>
              <g className="mm-pop" style={{ animationDelay: `${0.7 + i * 0.1}s`, transformOrigin: `${d.x}px ${d.y}px` }}>
                <circle cx={d.x} cy={d.y} r="6" fill="#fff" />
                <circle cx={d.x} cy={d.y} r="3" fill="#0D7BE8" />
                <text x={d.x} y={d.y + 24} textAnchor="middle" fontSize="17" fontWeight="700" fill="rgba(255,255,255,0.92)" fontFamily="var(--font-manrope)">{L(d.label)}</text>
              </g>
            </g>
          );
        })}

        {/* inbound: neighbouring countries -> Uzbekistan */}
        {IN.map((s, i) => {
          const path = arc(s, HUB, 0.22);
          return (
            <g key={s.label}>
              <path d={path} fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" className="route-line mm-fade" style={{ animationDelay: `0s, ${0.4 + i * 0.1}s` }} />
              <circle r="3" fill={GREEN}>
                <animateMotion dur={`${2.6 + (i % 2) * 0.5}s`} begin={`${0.2 + i * 0.4}s`} repeatCount="indefinite" path={path} />
              </circle>
              <g className="mm-pop" style={{ animationDelay: `${0.9 + i * 0.1}s`, transformOrigin: `${s.x}px ${s.y}px` }}>
                <circle cx={s.x} cy={s.y} r="5" fill="#0b2545" stroke={GREEN} strokeWidth="2" />
                <text x={s.x} y={s.y - 11} textAnchor="middle" fontSize="14" fontWeight="700" fill="#7CF0B0" fontFamily="var(--font-manrope)">{L(s.label)}</text>
              </g>
            </g>
          );
        })}

        {/* hub */}
        <circle cx={HUB.x} cy={HUB.y} r="46" fill="url(#mm-glow)" />
        <circle cx={HUB.x} cy={HUB.y} r="16" fill="none" stroke={GREEN} strokeOpacity="0.5" strokeWidth="1.5">
          <animate attributeName="r" values="10;26;10" dur="3s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx={HUB.x} cy={HUB.y} r="9" fill="#0FB861" stroke="#fff" strokeWidth="3" />
        <rect x={HUB.x - 74} y={HUB.y + 16} width="148" height="32" rx="16" fill="rgba(7,26,51,0.85)" stroke="rgba(255,255,255,0.25)" />
        <text x={HUB.x} y={HUB.y + 38} textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff" fontFamily="var(--font-manrope)">{L(HUB.label)}</text>
      </svg>

      {caption && <p className="mt-3 text-center text-sm font-semibold text-white/70">{caption}</p>}
    </div>
  );
}
