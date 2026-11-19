"use client";

import { useSvgIds } from "@/lib/client/useSvgIds";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { STOPS } from "@/lib/journey";
import { useMounted } from "@/lib/client/useMounted";
import Landscape from "./Landscape";
import s from "./SpaceWorld.module.css";

/**
 * What the camera is doing. The camera follows the rocket the whole time.
 * ground:  on the launch pad.              launch:  climbing, the land drops away.
 * cruise:  flying toward asteroid `target`. descent: braking and landing on it.
 * orbit:   landed, countdown.              work:    landed and drilling.
 * space:   coasting, nothing ahead.
 */
export type World = "ground" | "launch" | "cruise" | "descent" | "orbit" | "work" | "space";

type RockState = "ahead" | "near" | "work" | "passed";
type PlanetState = "ahead" | "visible" | "passed";

/** Where each rock's surface is at its center (the landing spot), as a share
 * of the image height. Measured from the paths below. */
const ROCK_SURFACE = [0.06, 0.0726, 0.0489];

/** Slope of each rock's surface at the landing spot, in degrees clockwise.
 * The landed rocket tilts by this much so it stands square to the ground. */
const ROCK_TILT = [-2.9, -12, -5.3];

const ROCK_PATHS = [
  "M104 12 C140 10 172 34 184 70 C196 106 186 146 156 170 C128 192 84 194 52 176 C22 160 8 124 14 90 C20 54 46 28 74 18 C84 14 94 12 104 12 Z",
  "M96 16 C132 6 176 26 188 64 C198 98 180 120 182 146 C184 172 150 192 112 188 C76 186 40 182 22 150 C6 122 14 92 24 66 C36 38 66 24 96 16 Z",
  "M110 10 C150 18 178 46 186 84 C194 120 178 160 146 178 C114 196 70 194 44 172 C18 150 6 116 16 82 C26 50 52 22 82 14 C92 11 100 9 110 10 Z",
];

const IN_TRANSIT: World[] = ["cruise", "descent", "orbit", "work"];

// Rocks wait below the screen, rise up under the rocket as it lands, and
// drop away beneath it when it leaves.
function rockState(i: number, world: World, target: number): RockState {
  if (IN_TRANSIT.includes(world)) {
    if (i < target) return "passed";
    if (i > target) return "ahead";
    if (world === "cruise") return "ahead";
    return world === "work" ? "work" : "near";
  }
  if (world === "space" && i <= target) return "passed";
  return "ahead";
}

// Each region's planet drifts down past the window during the trip there.
function planetState(i: number, world: World, target: number): PlanetState {
  if (IN_TRANSIT.includes(world)) {
    if (i < target) return "passed";
    if (i > target) return "ahead";
    return "visible";
  }
  if (world === "space" && i <= target) return "passed";
  return "ahead";
}

type RocketState = "pad" | "rise" | "cruise" | "descent" | "landed";

function rocketState(world: World): RocketState {
  if (world === "ground") return "pad";
  if (world === "launch") return "rise";
  if (world === "descent") return "descent";
  if (world === "orbit" || world === "work") return "landed";
  return "cruise";
}

function seeded(n: number, seed: number): number[] {
  let x = seed;
  return Array.from({ length: n }, () => {
    x = (x * 16807) % 2147483647;
    return (x % 10000) / 10000;
  });
}

function Rocket() {
  const u = useSvgIds();
  return (
    <svg className={s.rocketSvg} viewBox="0 0 80 200">
      <defs>
        <linearGradient id={u("sw-hull")} x1="0" x2="1">
          <stop offset="0" stopColor="#4b465c" />
          <stop offset="0.28" stopColor="#c9c3d8" />
          <stop offset="0.5" stopColor="#f6f3fc" />
          <stop offset="0.82" stopColor="#9c95ae" />
          <stop offset="1" stopColor="#ffd2a6" />
        </linearGradient>
        <linearGradient id={u("sw-nose")} x1="0" x2="1">
          <stop offset="0" stopColor="#b8431f" />
          <stop offset="0.5" stopColor="#ff9a3c" />
          <stop offset="1" stopColor="#ffd28a" />
        </linearGradient>
        <linearGradient id={u("sw-fin")} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ff9a3c" />
          <stop offset="1" stopColor="#8a2a1a" />
        </linearGradient>
        <radialGradient id={u("sw-glass")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#d6fffb" />
          <stop offset="0.35" stopColor="#5fd8e8" />
          <stop offset="1" stopColor="#123a6b" />
        </radialGradient>
        <linearGradient id={u("sw-nozzle")} x1="0" x2="1">
          <stop offset="0" stopColor="#24202e" />
          <stop offset="0.5" stopColor="#6b6478" />
          <stop offset="1" stopColor="#2a2535" />
        </linearGradient>
        <linearGradient id={u("sw-plume")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.25" stopColor="#ffe08a" />
          <stop offset="0.6" stopColor="#ff7a3c" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ff3b8a" stopOpacity="0" />
        </linearGradient>
        <filter id={u("sw-blur")} x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <g className={s.flameScale}>
        <g className={s.flame}>
          <path d="M27 156 Q40 214 53 156 Z" fill={`url(#${u("sw-plume")})`} filter={`url(#${u("sw-blur")})`} opacity="0.9" />
          <path d="M31 156 Q40 196 49 156 Z" fill={`url(#${u("sw-plume")})`} />
          <path d="M35 156 Q40 178 45 156 Z" fill="#fffdf2" />
          <ellipse cx="40" cy="170" rx="3" ry="2" fill="#fff" opacity="0.8" />
          <ellipse cx="40" cy="181" rx="2.2" ry="1.6" fill="#fff" opacity="0.6" />
        </g>
      </g>

      {/* Landing legs, folded up until the descent */}
      <g className={s.legs}>
        <path d="M23 126 L9 158" stroke="#4a4456" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M57 126 L71 158" stroke="#4a4456" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M3 159 H15" stroke="#9a93a8" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M65 159 H77" stroke="#9a93a8" strokeWidth="3.4" strokeLinecap="round" />
      </g>

      {/* Swept fins, back then front */}
      <path d="M26 104 C14 116 8 132 6 152 L16 150 C18 140 22 132 27 128 Z" fill={`url(#${u("sw-fin")})`} />
      <path d="M54 104 C66 116 72 132 74 152 L64 150 C62 140 58 132 53 128 Z" fill={`url(#${u("sw-fin")})`} />
      <path d="M6 152 L16 150" stroke="#ffd28a" strokeWidth="1.5" />
      <path d="M74 152 L64 150" stroke="#ffd28a" strokeWidth="1.5" />

      {/* Engine bell */}
      <path d="M29 140 H51 L55 157 H25 Z" fill={`url(#${u("sw-nozzle")})`} />
      <ellipse cx="40" cy="157" rx="15" ry="2.5" fill="#ff9a3c" opacity="0.7" />

      {/* Hull */}
      <path d="M40 4 C58 24 60 74 55 142 H25 C20 74 22 24 40 4 Z" fill={`url(#${u("sw-hull")})`} />
      <path d="M40 4 C51 15 55 26 57 36 C47 32 33 32 23 36 C25 26 29 15 40 4 Z" fill={`url(#${u("sw-nose")})`} />
      <path d="M55 142 C60 74 58 24 40 4" fill="none" stroke="#ffe0bd" strokeWidth="1.2" opacity="0.8" />

      {/* Panel seams and stripe */}
      <path d="M23 70 C34 67 46 67 57 70" stroke="#3a3548" strokeWidth="0.8" fill="none" opacity="0.6" />
      <path d="M22 118 C34 115 46 115 58 118" stroke="#3a3548" strokeWidth="0.8" fill="none" opacity="0.6" />
      <path d="M22 96 C34 93 46 93 58 96 L58 103 C46 100 34 100 22 103 Z" fill="#ff8a3c" />
      <path d="M22 105 C34 102 46 102 58 105" stroke="#6ff3e6" strokeWidth="1.2" fill="none" />
      <path d="M40 72 V116" stroke="#3a3548" strokeWidth="0.6" opacity="0.5" />

      {/* Cockpit */}
      <ellipse cx="40" cy="54" rx="10.5" ry="12.5" fill="#2a2535" />
      <ellipse cx="40" cy="54" rx="8" ry="10" fill={`url(#${u("sw-glass")})`} />
      <path d="M35 48 C36 45 39 44 42 44" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />

      {/* Centre fin and chevrons */}
      <path d="M38 124 H42 L43 150 H37 Z" fill="#c24a24" />
      <path d="M34 80 L40 84 L46 80 M34 86 L40 90 L46 86" stroke="#ff8a3c" strokeWidth="1.5" fill="none" />
      <circle cx="40" cy="132" r="1.5" fill="#6ff3e6" className={s.navLight} />

      {/* Side thrusters puff while braking */}
      <g className={s.rcs}>
        <ellipse cx="16" cy="70" rx="5" ry="2.6" fill="#f4f8ff" />
        <ellipse cx="64" cy="70" rx="5" ry="2.6" fill="#f4f8ff" />
      </g>
    </svg>
  );
}

function RingedPlanet() {
  const u = useSvgIds();
  return (
    <svg className={s.giant} viewBox="0 0 200 200">
      <defs>
        <radialGradient id={u("sw-giant")} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffd9b8" />
          <stop offset="0.45" stopColor="#c87aa6" />
          <stop offset="1" stopColor="#3a2560" />
        </radialGradient>
        <linearGradient id={u("sw-ring")} x1="0" x2="1">
          <stop offset="0" stopColor="#ffd3a0" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#fff0d8" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffd3a0" stopOpacity="0.15" />
        </linearGradient>
        <clipPath id={u("sw-front")}>
          <rect x="0" y="100" width="200" height="100" />
        </clipPath>
      </defs>
      <ellipse cx="100" cy="100" rx="92" ry="22" fill="none" stroke={`url(#${u("sw-ring")})`} strokeWidth="7" transform="rotate(-18 100 100)" />
      <circle cx="100" cy="100" r="52" fill={`url(#${u("sw-giant")})`} />
      <path d="M52 92 C80 84 120 84 150 94" stroke="#f3b7c0" strokeWidth="5" fill="none" opacity="0.35" />
      <path d="M50 108 C82 100 118 100 152 110" stroke="#7a4a92" strokeWidth="6" fill="none" opacity="0.4" />
      <g clipPath={`url(#${u("sw-front")})`} transform="rotate(-18 100 100)">
        <ellipse cx="100" cy="100" rx="92" ry="22" fill="none" stroke={`url(#${u("sw-ring")})`} strokeWidth="7" />
      </g>
    </svg>
  );
}

/** Where crystal clusters grow on each outline, measured from the paths:
 * [x, surface y, surface slope in degrees] for the left and right cluster.
 * Each cluster turns by the slope so it grows straight out of the rock. */
type Spot = [number, number, number];
const CRYSTAL_SPOTS: [Spot, Spot][] = [
  [[72, 18.7, -21.1], [146, 22.1, 30.1]],
  [[72, 23.9, -22.2], [146, 19.7, 22.6]],
  [[72, 17.4, -22.9], [146, 24.4, 33.4]],
];

/** Craters: [cx, cy, r]. Kept away from the landing spot at the top center. */
const CRATERS: [number, number, number][] = [
  [62, 46, 10],
  [138, 44, 7],
  [156, 74, 12],
  [48, 88, 8],
  [100, 66, 5],
  [124, 104, 15],
  [72, 128, 11],
  [146, 140, 8],
  [96, 160, 9],
  [40, 124, 6],
];

function seededDots(seed: number, n: number): [number, number, number, boolean][] {
  let x = seed * 9301 + 49297;
  const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => [20 + r() * 160, 20 + r() * 160, 0.5 + r() * 1.3, r() > 0.5]);
}

/** A crystal cluster growing out of the surface at (x, y). */
function Crystals({ spot, ore, flip, glow }: { spot: Spot; ore: string; flip?: boolean; glow: string }) {
  const [x, y, angle] = spot;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) translate(0 1.2) scale(${flip ? -0.65 : 0.65} 0.65)`}>
      <ellipse cx="0" cy="-3" rx="11" ry="7" fill={ore} opacity="0.45" filter={glow} />
      <path d="M-6 0 L-4 -13 L-1 0 Z" fill={ore} />
      <path d="M-4 -13 L-1 0 L-3 0 Z" fill="#fff" opacity="0.45" />
      <path d="M-1 0 L2 -19 L6 0 Z" fill={ore} />
      <path d="M2 -19 L6 0 L3.5 0 Z" fill="#fff" opacity="0.5" />
      <path d="M5 0 L9 -9 L11 0 Z" fill={ore} opacity="0.85" />
    </g>
  );
}

function Asteroid({ i }: { i: number }) {
  const u = useSvgIds();
  const stop = STOPS[i];
  const [light, mid, dark] = stop.rock;
  const ore = stop.ore;
  const shape = i % ROCK_PATHS.length;
  const path = ROCK_PATHS[shape];
  const [left, right] = CRYSTAL_SPOTS[shape];
  const dots = useMemo(() => seededDots(i + 3, 70), [i]);
  return (
    <svg className={s.rockSvg} viewBox="0 0 200 200" style={{ "--ore": ore } as React.CSSProperties}>
      <defs>
        <radialGradient id={u("base")} cx="0.64" cy="0.26" r="0.95">
          <stop offset="0" stopColor={light} />
          <stop offset="0.5" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
        {/* Shadow side, away from the sun at the upper right. */}
        <linearGradient id={u("shade")} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={u("rim")} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={light} stopOpacity="0" />
          <stop offset="0.55" stopColor={light} stopOpacity="0.15" />
          <stop offset="1" stopColor="#fffaf0" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id={u("crater")} cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor={dark} stopOpacity="0.95" />
          <stop offset="1" stopColor={dark} stopOpacity="0.45" />
        </radialGradient>
        <clipPath id={u("body")}>
          <path d={path} />
        </clipPath>
        <filter id={u("glow")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      <path d={path} fill={`url(#${u("base")})`} />
      <g clipPath={`url(#${u("body")})`}>
        {/* Speckle texture */}
        {dots.map(([x, y, r, lit], k) => (
          <circle key={k} cx={x} cy={y} r={r} fill={lit ? light : dark} opacity={lit ? 0.22 : 0.3} />
        ))}
        {/* Cracks */}
        <g stroke={dark} strokeWidth="1.2" fill="none" opacity="0.4" strokeLinecap="round">
          <path d="M30 70 Q48 76 58 92 T70 110" />
          <path d="M150 100 Q160 116 176 120" />
          <path d="M110 150 Q120 160 118 176" />
        </g>
        {/* Glowing ore veins */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 104 L44 98 L52 108 L68 102" stroke={ore} strokeWidth="5" opacity="0.35" filter={`url(#${u("glow")})`} />
          <path d="M28 104 L44 98 L52 108 L68 102" stroke={ore} strokeWidth="1.6" />
          <path d="M134 150 L146 158 L160 152 L170 160" stroke={ore} strokeWidth="5" opacity="0.35" filter={`url(#${u("glow")})`} />
          <path d="M134 150 L146 158 L160 152 L170 160" stroke={ore} strokeWidth="1.6" />
          <path d="M112 84 L120 90 L132 86" stroke={ore} strokeWidth="4" opacity="0.3" filter={`url(#${u("glow")})`} />
          <path d="M112 84 L120 90 L132 86" stroke={ore} strokeWidth="1.3" />
        </g>
        {/* Craters: dark bowl, shadowed far wall, sunlit near rim */}
        {CRATERS.map(([cx, cy, r], k) => (
          <g key={k}>
            <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.82} fill={`url(#${u("crater")})`} />
            <path
              d={`M${cx - r * 0.95} ${cy + r * 0.2} A${r} ${r * 0.82} 0 0 0 ${cx + r * 0.85} ${cy + r * 0.45}`}
              stroke={light}
              strokeWidth={Math.max(0.8, r * 0.14)}
              fill="none"
              opacity="0.55"
            />
          </g>
        ))}
        <rect width="200" height="200" fill={`url(#${u("shade")})`} />
      </g>
      {/* Sunlit rim along the upper-right edge */}
      <path d={path} fill="none" stroke={`url(#${u("rim")})`} strokeWidth="2.4" />
      <Crystals spot={left} ore={ore} glow={`url(#${u("glow")})`} />
      <Crystals spot={right} ore={ore} flip glow={`url(#${u("glow")})`} />
    </svg>
  );
}

/**
 * The full-page space scene behind the game. Every object stays mounted and
 * moves between states with CSS transitions, so going from launch to the
 * first rock, or from one rock to the next, is one continuous shot.
 */
export default function SpaceWorld({
  world,
  target,
  armed = false,
  time = "dusk",
}: {
  world: World;
  target: number;
  /** The player is hovering Lift off: rumble, vent steam, flash the pad. */
  armed?: boolean;
  /** Archive runs start in daylight; today's survey starts at dusk. */
  time?: "dusk" | "day";
}) {
  const mounted = useMounted();
  const streaks = useMemo(() => {
    const r = seeded(180, 11);
    return Array.from({ length: 60 }, (_, i) => ({
      left: r[i * 3] * 100,
      delay: r[i * 3 + 1] * 700,
      len: 40 + r[i * 3 + 2] * 140,
    }));
  }, []);

  if (!mounted) return null;

  const earth = world === "ground" ? "here" : world === "launch" ? "falling" : "gone";
  const rocket = rocketState(world);

  return createPortal(
    <div
      className={s.world}
      data-world={world}
      data-time={time}
      data-armed={armed && world === "ground"}
      style={{ "--tilt": `${ROCK_TILT[Math.max(0, target) % ROCK_TILT.length]}deg` } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className={s.starsFar} />
      <div className={s.stars} />
      <div className={s.sky} data-s={earth}>
        <div className={s.skyStars} />
        <RingedPlanet />
        <div className={s.sun} />
      </div>

      {STOPS.map((stop, i) => (
        <div key={stop.planet} className={s.planet} data-planet={stop.planet} data-s={planetState(i, world, target)} />
      ))}

      <div className={s.warp}>
        {streaks.map((w, i) => (
          <span
            key={i}
            style={
              {
                left: `${w.left}%`,
                "--len": `${w.len}px`,
                animationDelay: `${w.delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {STOPS.map((_, i) => (
        <div
          key={i}
          className={s.rock}
          data-s={rockState(i, world, target)}
          style={{ "--surface": ROCK_SURFACE[i % ROCK_SURFACE.length] } as React.CSSProperties}
        >
          <Asteroid i={i} />
        </div>
      ))}

      <div className={s.clouds} data-s={earth}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={s.cloud} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
      <Landscape state={earth} time={time} />
      <div className={s.rocket} data-s={rocket}>
        <div className={s.smoke}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <div className={s.dust}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <div className={s.steam}>
          <span />
          <span />
        </div>
        <Rocket />
      </div>
      <div className={s.vignette} />
    </div>,
    document.body,
  );
}
