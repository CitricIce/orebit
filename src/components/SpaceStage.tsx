"use client";

import { useMemo, type ReactNode } from "react";
import { stopFor } from "@/lib/journey";
import s from "./SpaceStage.module.css";

export type Scene = "launch" | "approach" | "arrived";

/** Deterministic pseudo-random numbers so server and client agree. */
function seeded(n: number, seed: number): number[] {
  let x = seed;
  return Array.from({ length: n }, () => {
    x = (x * 16807) % 2147483647;
    return (x % 10000) / 10000;
  });
}

function Rocket() {
  return (
    <svg className={s.rocketSvg} viewBox="0 0 60 140" aria-hidden="true">
      <defs>
        <linearGradient id="hull" x1="0" x2="1">
          <stop offset="0" stopColor="#8f88a0" />
          <stop offset="0.45" stopColor="#f4f0fb" />
          <stop offset="1" stopColor="#6b6578" />
        </linearGradient>
        <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="0.35" stopColor="#ffb547" />
          <stop offset="1" stopColor="#ff4b2b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className={s.flame}>
        <path d="M22 96 Q30 140 38 96 Z" fill="url(#flame)" />
        <path d="M26 96 Q30 122 34 96 Z" fill="#fffbe9" />
      </g>
      <path d="M8 78 L20 66 L20 92 L8 98 Z" fill="#ff9a3c" />
      <path d="M52 78 L40 66 L40 92 L52 98 Z" fill="#ff9a3c" />
      <path d="M30 4 C44 18 44 50 42 94 H18 C16 50 16 18 30 4 Z" fill="url(#hull)" />
      <circle cx="30" cy="44" r="7" fill="#1b1030" stroke="#ffb547" strokeWidth="2.5" />
      <circle cx="28" cy="42" r="2" fill="#6ff3e6" />
      <path d="M18 94 H42 L39 100 H21 Z" fill="#4a4456" />
    </svg>
  );
}

function Asteroid({ colors }: { colors: [string, string, string] }) {
  const [light, mid, dark] = colors;
  return (
    <svg className={s.asteroidSvg} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="rock-shade" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <path
        d="M104 12 C140 10 172 34 184 70 C196 106 186 146 156 170 C128 192 84 194 52 176 C22 160 8 124 14 90 C20 54 46 28 74 18 C84 14 94 12 104 12 Z"
        fill="url(#rock-shade)"
      />
      <g fill={dark} opacity="0.55">
        <ellipse cx="72" cy="70" rx="16" ry="13" />
        <ellipse cx="128" cy="118" rx="22" ry="17" />
        <ellipse cx="62" cy="138" rx="10" ry="8" />
        <ellipse cx="140" cy="58" rx="9" ry="7" />
        <ellipse cx="104" cy="160" rx="7" ry="5" />
      </g>
      <g fill={light} opacity="0.35">
        <path d="M66 62 a16 13 0 0 1 20 4" stroke={light} strokeWidth="3" fill="none" />
        <path d="M118 108 a22 17 0 0 1 26 6" stroke={light} strokeWidth="3" fill="none" />
      </g>
      <path d="M150 150 l6 -6 l6 6 l-6 6 z" fill="#6ff3e6" className={s.glint} />
    </svg>
  );
}

/**
 * The space backdrop shown before each round. "launch" lifts off from
 * Earth, "approach" warps toward the round's asteroid, and "arrived" holds
 * on the asteroid while the countdown plays. Children render on top.
 */
export default function SpaceStage({
  scene,
  round,
  onSkip,
  children,
}: {
  scene: Scene;
  round: number;
  onSkip?: () => void;
  children?: ReactNode;
}) {
  const stop = stopFor(round);
  const warp = useMemo(() => {
    const r = seeded(140, 7 + round * 31);
    return Array.from({ length: 70 }, (_, i) => ({
      angle: r[i * 2] * 360,
      delay: r[i * 2 + 1] * 900,
      len: 30 + ((i * 37) % 70),
    }));
  }, [round]);

  return (
    <div
      className={s.stage}
      data-scene={scene}
      data-planet={stop.planet}
      onClick={onSkip}
      role={onSkip ? "button" : undefined}
      aria-label={onSkip ? "Skip animation" : undefined}
      tabIndex={onSkip ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSkip && (e.key === "Enter" || e.key === " ")) onSkip();
      }}
      style={{ "--rock-light": stop.rock[0] } as React.CSSProperties}
    >
      <div className={s.stars} />
      <div className={s.starsFar} />

      {scene === "launch" && (
        <>
          <div className={s.sky} />
          <div className={s.earth} />
          <div className={s.smoke}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
          <div className={s.rocket}>
            <Rocket />
          </div>
          <p className={s.caption}>
            <span className={s.captionA}>Lift off</span>
            <span className={s.captionB}>Leaving Earth</span>
          </p>
        </>
      )}

      {scene !== "launch" && (
        <>
          <div className={s.planet} />
          {scene === "approach" && (
            <div className={s.warp}>
              {warp.map((w, i) => (
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
          )}
          <div className={s.asteroid}>
            <Asteroid colors={stop.rock} />
          </div>
          {scene === "approach" && (
            <p className={s.location}>
              <span className={s.locationRegion}>{stop.region}</span>
              <span className={s.locationDetail}>{stop.detail}</span>
            </p>
          )}
        </>
      )}

      {children && <div className={s.overlay}>{children}</div>}
      {onSkip && <span className={s.skip}>Tap to skip</span>}
    </div>
  );
}
