"use client";

import { useSvgIds } from "@/lib/client/useSvgIds";
import s from "./GameTitle.module.css";

/**
 * The OREBIT title. The O is the asteroid: same warm gradient as the
 * letters, craters and a cyan glint, with an orbit ring around it. A spark
 * of light travels the ring; the back half of the ring passes behind the
 * rock and the front half crosses in front.
 */
function AsteroidO() {
  const u = useSvgIds();
  const ring = "M4 54 A46 15 0 1 1 96 54 A46 15 0 1 1 4 54";
  return (
    <svg className={s.o} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={u("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8ec" />
          <stop offset="0.45" stopColor="#ffd18a" />
          <stop offset="1" stopColor="#ff8a3c" />
        </linearGradient>
        <linearGradient id={u("ring")} x1="0" x2="1">
          <stop offset="0" stopColor="#ffd18a" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff0d8" />
          <stop offset="1" stopColor="#ffd18a" stopOpacity="0.35" />
        </linearGradient>
        <clipPath id={u("back")}>
          <rect x="-10" y="-10" width="120" height="64" />
        </clipPath>
        <clipPath id={u("front")}>
          <rect x="-10" y="54" width="120" height="60" />
        </clipPath>
      </defs>

      <g transform="rotate(-18 50 54)">
        <g clipPath={`url(#${u("back")})`}>
          <path d={ring} pathLength={100} className={s.ring} stroke={`url(#${u("ring")})`} />
          <path d={ring} pathLength={100} className={s.spark} />
        </g>
      </g>

      <g className={s.rock}>
        <path
          d="M52 12c19 1 34 16 34 38 0 23-16 39-38 39C27 89 13 73 14 51 15 29 31 11 52 12z"
          fill={`url(#${u("body")})`}
        />
        <g fill="#c4602a" opacity="0.45">
          <ellipse cx="37" cy="38" rx="8" ry="6.5" />
          <ellipse cx="63" cy="64" rx="10" ry="7.5" />
          <ellipse cx="34" cy="68" rx="5" ry="4" />
          <ellipse cx="66" cy="31" rx="4.5" ry="3.5" />
        </g>
        <path d="M30 34c2-3 8-4 12-1" stroke="#fff8ec" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.7" />
        <path d="M72 46l4 4-4 4-4-4z" fill="#6ff3e6" className={s.glint} />
      </g>

      <g transform="rotate(-18 50 54)">
        <g clipPath={`url(#${u("front")})`}>
          <path d={ring} pathLength={100} className={s.ring} stroke={`url(#${u("ring")})`} />
          <path d={ring} pathLength={100} className={s.spark} />
        </g>
      </g>
    </svg>
  );
}

export default function GameTitle() {
  return (
    <h1 className={s.title} aria-label="Orebit">
      <span className={s.letters} aria-hidden="true">
        <AsteroidO />
        <span className={s.rest}>REBIT</span>
      </span>
    </h1>
  );
}
