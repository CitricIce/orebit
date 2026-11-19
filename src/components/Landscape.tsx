"use client";

import { useEffect, useRef } from "react";
import { useSvgIds } from "@/lib/client/useSvgIds";
import { FAR, FAR_BACK, FAR_RIDGE, MID, MID_RIDGE, NEAR, NEAR_FLORA, NEAR_RIDGE } from "@/lib/terrain";
import s from "./Landscape.module.css";

type Kind = "bulb" | "spire" | "cap";

/** Landscape colors: dusk for today's survey, daylight for archive runs. */
const PALETTES = {
  dusk: {
  farTop: "#d77a9c",
  farMid: "#b8608f",
  farBottom: "#f2a083",
  backTop: "#e99aa4",
  backBottom: "#ffbe8e",
  rimA: "#ffd3a0",
  rimB: "#fff0d0",
  midTop: "#7a4a92",
  midBottom: "#3b2a66",
  hazeA: "#f2a083",
  hazeB: "#d77a9c",
  nearTop: "#226068",
  nearBottom: "#123048",
  groundTop: "#173048",
  groundBottom: "#070f1a",
},
  day: {
  farTop: "#9cb8dc",
  farMid: "#7f9fcf",
  farBottom: "#c7dcf2",
  backTop: "#bcd3ee",
  backBottom: "#dceafa",
  rimA: "#ffffff",
  rimB: "#ffffff",
  midTop: "#6b8fb8",
  midBottom: "#4a6c96",
  hazeA: "#dceafa",
  hazeB: "#c7dcf2",
  nearTop: "#4fa36b",
  nearBottom: "#2d6e4c",
  groundTop: "#3d7a52",
  groundBottom: "#1c3d2b",
},
};

/** One alien plant, drawn with its base at (0, 0) growing upward. */
function Plant({ kind, glow }: { kind: Kind; glow: string }) {
  if (kind === "bulb") {
    return (
      <g>
        <path d="M0 0 C-3 -12 4 -22 1 -34" stroke="#0d2a33" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0 -8 C6 -12 10 -10 13 -14" stroke="#0d2a33" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="13" cy="-15" r="2.6" fill="#6ff3e6" filter={glow} />
        <circle cx="1" cy="-37" r="8" fill="#6ff3e6" opacity="0.35" filter={glow} />
        <circle cx="1" cy="-37" r="5" fill="#b9fff6" />
      </g>
    );
  }
  if (kind === "spire") {
    return (
      <g>
        <path d="M-6 0 L-2 -30 L2 0 Z" fill="#c24fb0" />
        <path d="M-2 -30 L2 0 L-1 0 Z" fill="#ff8fe0" opacity="0.8" />
        <path d="M1 0 L7 -20 L10 0 Z" fill="#9a3f9a" />
        <path d="M7 -20 L10 0 L8 0 Z" fill="#ff8fe0" opacity="0.7" />
        <path d="M-10 0 L-8 -14 L-4 0 Z" fill="#8a3a92" />
        <ellipse cx="-1" cy="-2" rx="14" ry="3" fill="#ff6fd8" opacity="0.35" filter={glow} />
      </g>
    );
  }
  return (
    <g>
      <path d="M-2 0 C-3 -10 -1 -16 0 -20 L3 -20 C3 -14 4 -8 3 0 Z" fill="#2a1f3d" />
      <path d="M-14 -20 C-12 -32 14 -32 16 -20 C10 -17 -8 -17 -14 -20 Z" fill="#ffb547" />
      <path d="M-14 -20 C-8 -17 10 -17 16 -20 C10 -15 -8 -15 -14 -20 Z" fill="#ff7a2b" />
      <ellipse cx="1" cy="-17" rx="14" ry="4" fill="#ffd36e" opacity="0.4" filter={glow} />
      <circle cx="-5" cy="-26" r="1.6" fill="#fff3d0" />
      <circle cx="6" cy="-27" r="1.2" fill="#fff3d0" />
    </g>
  );
}

const FORE_PLANTS: { left: string; size: number; kind: Kind; flip?: boolean }[] = [
  { left: "6%", size: 70, kind: "bulb" },
  { left: "14%", size: 46, kind: "cap" },
  { left: "22%", size: 58, kind: "spire" },
  { left: "33%", size: 40, kind: "bulb", flip: true },
  { left: "64%", size: 44, kind: "cap", flip: true },
  { left: "73%", size: 66, kind: "spire", flip: true },
  { left: "84%", size: 52, kind: "bulb" },
  { left: "93%", size: 74, kind: "cap" },
];

function ForePlant({ left, size, kind, flip, i }: (typeof FORE_PLANTS)[number] & { i: number }) {
  const u = useSvgIds();
  return (
    <svg
      className={s.forePlant}
      viewBox="-20 -46 40 48"
      style={{ left, width: size, height: size * 1.2, transform: flip ? "scaleX(-1)" : undefined }}
    >
      <defs>
        <filter id={u(`fp-glow-${i}`)} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      <g className={s.plant} data-plant="true">
        <Plant kind={kind} glow={`url(#${u(`fp-glow-${i}`)})`} />
      </g>
    </svg>
  );
}

/**
 * The alien landing site at dusk. Four layers (far peaks, mesas, hills,
 * ground) each drop away at their own speed when the rocket lifts off.
 */
export default function Landscape({
  state,
  time = "dusk",
}: {
  state: "here" | "falling" | "gone";
  time?: "dusk" | "day";
}) {
  const c = PALETTES[time];
  const landRef = useRef<HTMLDivElement>(null);

  // The scene sits behind the page and ignores the mouse, so plants can't
  // feel a hover themselves. Watch the pointer instead and give any plant
  // it passes over a small rustle, leaning away from the cursor.
  useEffect(() => {
    const land = landRef.current;
    if (!land || state !== "here") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const plants = Array.from(land.querySelectorAll<SVGGElement>("[data-plant]"));
    const busy = new WeakSet<Element>();
    let frame = 0;
    let x = 0;
    let y = 0;

    const check = () => {
      frame = 0;
      for (const plant of plants) {
        if (busy.has(plant)) continue;
        const r = plant.getBoundingClientRect();
        if (x < r.left - 6 || x > r.right + 6 || y < r.top - 6 || y > r.bottom + 4) continue;
        plant.style.setProperty("--dir", x < r.left + r.width / 2 ? "1" : "-1");
        plant.setAttribute("data-rustle", "true");
        busy.add(plant);
        window.setTimeout(() => {
          plant.removeAttribute("data-rustle");
          busy.delete(plant);
        }, 900);
      }
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [state]);
  const u = useSvgIds();
  return (
    <div ref={landRef} className={s.land} data-s={state} data-time={time}>
      <svg className={s.far} viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id={u("ls-far")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.farTop} />
            <stop offset="0.6" stopColor={c.farMid} />
            <stop offset="1" stopColor={c.farBottom} />
          </linearGradient>
          <linearGradient id={u("ls-far-back")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.backTop} />
            <stop offset="1" stopColor={c.backBottom} />
          </linearGradient>
          <linearGradient id={u("ls-rim")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={c.rimA} stopOpacity="0" />
            <stop offset="0.7" stopColor={c.rimA} stopOpacity="0.5" />
            <stop offset="1" stopColor={c.rimB} stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path d={FAR_BACK} fill={`url(#${u("ls-far-back")})`} opacity="0.75" />
        <path d={FAR} fill={`url(#${u("ls-far")})`} />
        <path d={FAR_RIDGE} fill="none" stroke={`url(#${u("ls-rim")})`} strokeWidth="2" />
      </svg>

      <svg className={s.mid} viewBox="0 0 1600 220" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id={u("ls-mid")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.midTop} />
            <stop offset="1" stopColor={c.midBottom} />
          </linearGradient>
          <linearGradient id={u("ls-haze")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor={c.hazeA} stopOpacity="0" />
            <stop offset="1" stopColor={c.hazeB} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <path d={MID} fill={`url(#${u("ls-mid")})`} />
        <path d={MID_RIDGE} fill="none" stroke={`url(#${u("ls-rim")})`} strokeWidth="2.5" />
        <rect width="1600" height="220" fill={`url(#${u("ls-haze")})`} />
      </svg>

      <svg className={s.near} viewBox="0 0 1600 160" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id={u("ls-near")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.nearTop} />
            <stop offset="1" stopColor={c.nearBottom} />
          </linearGradient>
          <filter id={u("ls-glow")} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <path d={NEAR} fill={`url(#${u("ls-near")})`} />
        <path d={NEAR_RIDGE} fill="none" stroke={`url(#${u("ls-rim")})`} strokeWidth="2" opacity="0.8" />
        {NEAR_FLORA.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.s * 1.6})`}>
            <g className={s.plant} data-plant="true">
              <Plant kind={p.kind} glow={`url(#${u("ls-glow")})`} />
            </g>
          </g>
        ))}
      </svg>

      <div className={s.ground}>
        <svg className={s.groundSvg} viewBox="0 0 1600 130" preserveAspectRatio="none">
          <defs>
            <linearGradient id={u("ls-ground")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c.groundTop} />
              <stop offset="1" stopColor={c.groundBottom} />
            </linearGradient>
          </defs>
          <path d="M0 22 C200 6 420 24 600 14 L1000 14 C1180 24 1400 6 1600 20 L1600 130 L0 130 Z" fill={`url(#${u("ls-ground")})`} />
          <path
            d="M0 22 C200 6 420 24 600 14 L1000 14 C1180 24 1400 6 1600 20"
            fill="none"
            stroke="#ffb98a"
            strokeOpacity="0.35"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {/* Rocks and glowing moss */}
          <g>
            <ellipse cx="1013" cy="44" rx="21" ry="7" fill="#0b1a28" />
            <ellipse cx="1391" cy="58" rx="25" ry="9" fill="#0b1a28" />
            <ellipse cx="1158" cy="89" rx="26" ry="9" fill="#0b1a28" />
            <ellipse cx="76" cy="87" rx="21" ry="7" fill="#0b1a28" />
            <ellipse cx="1078" cy="72" rx="11" ry="4" fill="#0b1a28" />
            <ellipse cx="315" cy="87" rx="13" ry="5" fill="#0b1a28" />
            <ellipse cx="121" cy="68" rx="18" ry="6" fill="#0b1a28" />
            <ellipse cx="61" cy="100" rx="16" ry="6" fill="#0b1a28" />
            <ellipse cx="1241" cy="41" rx="27" ry="10" fill="#0b1a28" />
            <ellipse cx="1543" cy="117" rx="25" ry="9" fill="#0b1a28" />
            <ellipse cx="186" cy="67" rx="14" ry="5" fill="#0b1a28" />
          </g>
          <g className={s.moss}>
            <ellipse cx="602" cy="42" rx="2.9" ry="1.8" fill="#6ff3e6" opacity="0.52" />
            <ellipse cx="963" cy="60" rx="3.1" ry="1.8" fill="#6ff3e6" opacity="0.71" />
            <ellipse cx="284" cy="115" rx="3.1" ry="1.9" fill="#ffd36e" opacity="0.43" />
            <ellipse cx="391" cy="40" rx="2.2" ry="1.3" fill="#6ff3e6" opacity="0.74" />
            <ellipse cx="619" cy="97" rx="1.4" ry="0.8" fill="#ff6fd8" opacity="0.45" />
            <ellipse cx="370" cy="101" rx="3.0" ry="1.8" fill="#ff6fd8" opacity="0.81" />
            <ellipse cx="639" cy="61" rx="1.3" ry="0.8" fill="#6ff3e6" opacity="0.79" />
            <ellipse cx="105" cy="64" rx="2.2" ry="1.3" fill="#6ff3e6" opacity="0.47" />
            <ellipse cx="1169" cy="107" rx="3.1" ry="1.9" fill="#6ff3e6" opacity="0.41" />
            <ellipse cx="1417" cy="48" rx="1.2" ry="0.7" fill="#6ff3e6" opacity="0.42" />
            <ellipse cx="1452" cy="75" rx="2.3" ry="1.4" fill="#6ff3e6" opacity="0.56" />
            <ellipse cx="1016" cy="38" rx="2.4" ry="1.4" fill="#6ff3e6" opacity="0.82" />
            <ellipse cx="1143" cy="34" rx="1.7" ry="1.0" fill="#6ff3e6" opacity="0.72" />
            <ellipse cx="1170" cy="82" rx="1.3" ry="0.8" fill="#ffd36e" opacity="0.83" />
            <ellipse cx="389" cy="85" rx="1.3" ry="0.8" fill="#ff6fd8" opacity="0.77" />
            <ellipse cx="1093" cy="108" rx="1.4" ry="0.9" fill="#ff6fd8" opacity="0.58" />
            <ellipse cx="1558" cy="82" rx="1.2" ry="0.7" fill="#ff6fd8" opacity="0.35" />
            <ellipse cx="194" cy="50" rx="1.7" ry="1.0" fill="#6ff3e6" opacity="0.50" />
            <ellipse cx="464" cy="77" rx="1.3" ry="0.8" fill="#ffd36e" opacity="0.74" />
            <ellipse cx="1280" cy="75" rx="2.6" ry="1.6" fill="#6ff3e6" opacity="0.63" />
            <ellipse cx="123" cy="88" rx="1.4" ry="0.8" fill="#ffd36e" opacity="0.60" />
            <ellipse cx="1511" cy="80" rx="1.5" ry="0.9" fill="#ff6fd8" opacity="0.44" />
            <ellipse cx="1336" cy="53" rx="1.3" ry="0.8" fill="#6ff3e6" opacity="0.48" />
            <ellipse cx="276" cy="41" rx="1.5" ry="0.9" fill="#6ff3e6" opacity="0.38" />
            <ellipse cx="345" cy="65" rx="2.4" ry="1.5" fill="#ff6fd8" opacity="0.49" />
            <ellipse cx="453" cy="117" rx="2.7" ry="1.6" fill="#ff6fd8" opacity="0.70" />
            <ellipse cx="122" cy="71" rx="2.6" ry="1.6" fill="#ffd36e" opacity="0.64" />
            <ellipse cx="1272" cy="90" rx="1.7" ry="1.0" fill="#ffd36e" opacity="0.52" />
            <ellipse cx="1460" cy="55" rx="1.5" ry="0.9" fill="#6ff3e6" opacity="0.43" />
            <ellipse cx="1252" cy="107" rx="1.6" ry="1.0" fill="#ffd36e" opacity="0.58" />
            <ellipse cx="626" cy="46" rx="2.2" ry="1.3" fill="#ff6fd8" opacity="0.62" />
            <ellipse cx="1488" cy="33" rx="3.2" ry="1.9" fill="#ffd36e" opacity="0.62" />
            <ellipse cx="1439" cy="36" rx="2.5" ry="1.5" fill="#ff6fd8" opacity="0.38" />
            <ellipse cx="370" cy="42" rx="1.4" ry="0.8" fill="#ffd36e" opacity="0.58" />
          </g>
        </svg>
        {FORE_PLANTS.map((p, i) => (
          <ForePlant key={p.left} {...p} i={i} />
        ))}
        <svg className={s.pad} viewBox="0 0 160 120">
          <defs>
            <linearGradient id={u("ls-metal")} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#6c6680" />
              <stop offset="1" stopColor="#2a2535" />
            </linearGradient>
          </defs>
          {/* Tower */}
          <rect x="22" y="8" width="10" height="94" fill={`url(#${u("ls-metal")})`} />
          <path
            d="M22 14 L32 26 M32 26 L22 38 M22 38 L32 50 M32 50 L22 62 M22 62 L32 74 M32 74 L22 86 M22 86 L32 98"
            stroke="#1b1724"
            strokeWidth="1.5"
          />
          <rect x="32" y="30" width="26" height="3" fill="#6c6680" />
          <rect x="32" y="56" width="20" height="3" fill="#6c6680" />
          <circle className={s.beacon} cx="27" cy="6" r="3" fill="#ff4b5c" />
          {/* Platform */}
          <path d="M20 100 H140 L134 112 H26 Z" fill={`url(#${u("ls-metal")})`} />
          <rect x="20" y="99" width="120" height="2" fill="#ffb547" opacity="0.8" />
          <circle className={s.light} cx="34" cy="106" r="1.8" fill="#6ff3e6" />
          <circle className={s.light} cx="126" cy="106" r="1.8" fill="#6ff3e6" style={{ animationDelay: "0.6s" }} />
          <ellipse cx="80" cy="114" rx="70" ry="5" fill="#ffb547" opacity="0.18" />
        </svg>
      </div>
    </div>
  );
}
