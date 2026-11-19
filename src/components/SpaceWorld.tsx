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

function Asteroid({ i }: { i: number }) {
  const u = useSvgIds();
  const [light, mid, dark] = STOPS[i].rock;
  const id = u(`sw-rock-${i}`);
  return (
    <svg className={s.rockSvg} viewBox="0 0 200 200">
      <defs>
        <radialGradient id={id} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <path d={ROCK_PATHS[i % ROCK_PATHS.length]} fill={`url(#${id})`} stroke={light} strokeWidth="1.2" strokeOpacity="0.55" />
      {/* Surface detail along the top, where the rocket lands */}
      <g fill={dark} opacity="0.5">
        <ellipse cx="70" cy="30" rx="8" ry="2.6" />
        <ellipse cx="132" cy="27" rx="6" ry="2" />
        <ellipse cx="152" cy="42" rx="10" ry="3.4" />
        <ellipse cx="50" cy="46" rx="7" ry="2.6" />
        <ellipse cx="96" cy="36" rx="4" ry="1.4" />
        <ellipse cx="118" cy="48" rx="5" ry="1.8" />
      </g>
      <g fill={light} opacity="0.45">
        <ellipse cx="70" cy="28.6" rx="7" ry="1" />
        <ellipse cx="152" cy="40.4" rx="9" ry="1.2" />
      </g>
      <g fill={mid}>
        <path d="M80 15 l3 -2.5 l3 1 l1 2.5 z" />
        <path d="M122 14 l2.5 -2 l3 0.8 l0.8 2 z" />
        <path d="M60 22 l2 -1.6 l2.4 0.6 l0.6 1.6 z" />
      </g>
      <g fill={dark} opacity="0.55">
        <ellipse cx="72" cy="70" rx="16" ry="13" />
        <ellipse cx="128" cy="118" rx="22" ry="17" />
        <ellipse cx="62" cy="138" rx="10" ry="8" />
        <ellipse cx="140" cy="58" rx="9" ry="7" />
        <ellipse cx="104" cy="160" rx="7" ry="5" />
      </g>
      <g stroke={light} strokeWidth="3" fill="none" opacity="0.35">
        <path d="M66 62 a16 13 0 0 1 20 4" />
        <path d="M118 108 a22 17 0 0 1 26 6" />
      </g>
      <path d="M150 150 l6 -6 l6 6 l-6 6 z" fill="#6ff3e6" className={s.glint} />
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
    <div className={s.world} data-world={world} data-time={time} data-armed={armed && world === "ground"} aria-hidden="true">
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
