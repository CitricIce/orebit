"use client";

import { useMemo } from "react";
import { TIERS, type TierId } from "@/lib/tiers";
import s from "./DrillShaft.module.css";

const PX_PER_M = 1.6;
const MARK_EVERY = 50;

/** The asteroid cross-section on the left. The rock scrolls up as you go deeper. */
export default function DrillShaft({
  depth,
  drilling,
  lastHit,
  heat,
}: {
  depth: number;
  drilling: boolean;
  lastHit: { id: number; tier: TierId } | null;
  heat: number;
}) {
  const marks = useMemo(() => {
    const out: number[] = [];
    const from = Math.max(0, Math.floor((depth - 260) / MARK_EVERY) * MARK_EVERY);
    for (let m = from; m <= depth + 400; m += MARK_EVERY) out.push(m);
    return out;
  }, [depth]);

  const sparks = useMemo(() => {
    if (!lastHit) return [];
    const n = lastHit.tier >= 5 ? 18 : 10;
    return Array.from({ length: n }, (_, i) => {
      const a = (Math.PI * 2 * i) / n + ((lastHit.id * 37) % 10) / 10;
      const r = 40 + ((i * 53 + lastHit.id * 17) % 50);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7 - 10, d: (i % 4) * 40 };
    });
  }, [lastHit]);

  return (
    <div
      className={s.shaft}
      data-drilling={drilling}
      style={{ "--heat": heat.toFixed(2), "--offset": `${-depth * PX_PER_M}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className={s.strata} />
      <div className={s.marks}>
        {marks.map((m) => (
          <span key={m} className={s.mark} style={{ transform: `translateY(${(m - depth) * PX_PER_M}px)` }}>
            {m} m
          </span>
        ))}
      </div>
      <div className={s.bore} />
      <div className={s.rig}>
        <svg className={s.drill} viewBox="0 0 40 96">
          <defs>
            <linearGradient id="drill-body" x1="0" x2="1">
              <stop offset="0" stopColor="#6b6578" />
              <stop offset="0.5" stopColor="#d9d3e6" />
              <stop offset="1" stopColor="#4a4456" />
            </linearGradient>
            <linearGradient id="drill-hot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffb547" stopOpacity="0" />
              <stop offset="1" stopColor="#ff6a2b" />
            </linearGradient>
          </defs>
          <rect x="10" y="0" width="20" height="50" rx="3" fill="url(#drill-body)" />
          <g className={s.threads}>
            {[8, 18, 28, 38].map((y) => (
              <path key={y} d={`M10 ${y} L30 ${y + 6}`} stroke="#2a2533" strokeWidth="2" />
            ))}
          </g>
          <path d="M8 50 H32 L20 94 Z" fill="url(#drill-body)" />
          <path className={s.hot} d="M8 50 H32 L20 94 Z" fill="url(#drill-hot)" />
        </svg>
        <div key={lastHit?.id ?? 0} className={s.sparks}>
          {sparks.map((p, i) => (
            <span
              key={i}
              className={s.spark}
              style={
                {
                  "--x": `${p.x}px`,
                  "--y": `${p.y}px`,
                  "--c": lastHit ? TIERS[lastHit.tier].color : "white",
                  animationDelay: `${p.d}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
