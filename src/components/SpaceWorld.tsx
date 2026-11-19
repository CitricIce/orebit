"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import { STOPS } from "@/lib/journey";
import { useMounted } from "@/lib/client/useMounted";
import s from "./SpaceWorld.module.css";

/**
 * What the camera is doing.
 * ground: on Earth, rocket on the pad.   launch: rocket climbing, Earth falls away.
 * cruise: warping toward asteroid `target`. orbit: parked at `target`, countdown.
 * work: drilling `target`, rock eases behind the console.  space: drifting, nothing ahead.
 */
export type World = "ground" | "launch" | "cruise" | "orbit" | "work" | "space";

type RockState = "ahead" | "near" | "work" | "passed";
type PlanetState = "ahead" | "visible" | "passed";

const ROCK_PATHS = [
  "M104 12 C140 10 172 34 184 70 C196 106 186 146 156 170 C128 192 84 194 52 176 C22 160 8 124 14 90 C20 54 46 28 74 18 C84 14 94 12 104 12 Z",
  "M96 16 C132 6 176 26 188 64 C198 98 180 120 182 146 C184 172 150 192 112 188 C76 186 40 182 22 150 C6 122 14 92 24 66 C36 38 66 24 96 16 Z",
  "M110 10 C150 18 178 46 186 84 C194 120 178 160 146 178 C114 196 70 194 44 172 C18 150 6 116 16 82 C26 50 52 22 82 14 C92 11 100 9 110 10 Z",
];

function rockState(i: number, world: World, target: number): RockState {
  if (world === "cruise" || world === "orbit" || world === "work") {
    if (i < target) return "passed";
    if (i > target) return "ahead";
    return world === "work" ? "work" : "near";
  }
  if (world === "space" && i <= target) return "passed";
  return "ahead";
}

function planetState(i: number, world: World, target: number): PlanetState {
  const r = rockState(i, world, target);
  return r === "passed" ? "passed" : r === "ahead" ? "ahead" : "visible";
}

function seeded(n: number, seed: number): number[] {
  let x = seed;
  return Array.from({ length: n }, () => {
    x = (x * 16807) % 2147483647;
    return (x % 10000) / 10000;
  });
}

function Rocket() {
  return (
    <svg className={s.rocketSvg} viewBox="0 0 60 140">
      <defs>
        <linearGradient id="sw-hull" x1="0" x2="1">
          <stop offset="0" stopColor="#8f88a0" />
          <stop offset="0.45" stopColor="#f4f0fb" />
          <stop offset="1" stopColor="#6b6578" />
        </linearGradient>
        <linearGradient id="sw-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="0.35" stopColor="#ffb547" />
          <stop offset="1" stopColor="#ff4b2b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className={s.flame}>
        <path d="M22 96 Q30 140 38 96 Z" fill="url(#sw-flame)" />
        <path d="M26 96 Q30 122 34 96 Z" fill="#fffbe9" />
      </g>
      <path d="M8 78 L20 66 L20 92 L8 98 Z" fill="#ff9a3c" />
      <path d="M52 78 L40 66 L40 92 L52 98 Z" fill="#ff9a3c" />
      <path d="M30 4 C44 18 44 50 42 94 H18 C16 50 16 18 30 4 Z" fill="url(#sw-hull)" />
      <circle cx="30" cy="44" r="7" fill="#1b1030" stroke="#ffb547" strokeWidth="2.5" />
      <circle cx="28" cy="42" r="2" fill="#6ff3e6" />
      <path d="M18 94 H42 L39 100 H21 Z" fill="#4a4456" />
    </svg>
  );
}

function Asteroid({ i }: { i: number }) {
  const [light, mid, dark] = STOPS[i].rock;
  const id = `sw-rock-${i}`;
  return (
    <svg className={s.rockSvg} viewBox="0 0 200 200">
      <defs>
        <radialGradient id={id} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <path d={ROCK_PATHS[i % ROCK_PATHS.length]} fill={`url(#${id})`} />
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
export default function SpaceWorld({ world, target }: { world: World; target: number }) {
  const mounted = useMounted();
  const streaks = useMemo(() => {
    const r = seeded(160, 11);
    return Array.from({ length: 80 }, (_, i) => ({
      angle: r[i * 2] * 360,
      delay: r[i * 2 + 1] * 900,
      len: 30 + ((i * 37) % 80),
    }));
  }, []);

  if (!mounted) return null;

  const earth = world === "ground" ? "here" : world === "launch" ? "falling" : "gone";
  const rocket = world === "ground" ? "pad" : world === "launch" ? "rise" : "gone";

  return createPortal(
    <div className={s.world} data-world={world} aria-hidden="true">
      <div className={s.starsFar} />
      <div className={s.stars} />
      <div className={s.sky} data-s={earth} />

      {STOPS.map((stop, i) => (
        <div key={stop.planet} className={s.planet} data-planet={stop.planet} data-s={planetState(i, world, target)} />
      ))}

      <div className={s.warp}>
        {streaks.map((w, i) => (
          <span
            key={i}
            style={
              {
                "--a": `${w.angle}deg`,
                "--len": `${w.len}px`,
                animationDelay: `${w.delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {STOPS.map((_, i) => (
        <div key={i} className={s.rock} data-s={rockState(i, world, target)} data-side={i % 2 ? "right" : "left"}>
          <Asteroid i={i} />
        </div>
      ))}

      <div className={s.earth} data-s={earth} />
      <div className={s.rocket} data-s={rocket}>
        <div className={s.smoke}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <Rocket />
      </div>
      <div className={s.vignette} />
    </div>,
    document.body,
  );
}
