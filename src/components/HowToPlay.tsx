"use client";

import { useState } from "react";
import { RANKS, ROUND_SECONDS, ROUNDS_PER_DAY, TIER_LIST, TIERS, type TierId } from "@/lib/tiers";
import { useSvgIds } from "@/lib/client/useSvgIds";
import s from "./HowToPlay.module.css";

/** One real example per tier, all from the Cheeses category. */
const EXAMPLES: Record<TierId, string> = {
  1: "Cheddar",
  2: "Gouda",
  3: "Gruyère",
  4: "Taleggio",
  5: "Wagasi",
  6: "Casu Marzu",
};

const STEPS = [
  {
    title: `${ROUNDS_PER_DAY} asteroids`,
    text: "Each one is a category, like cheeses or dinosaurs.",
    icon: (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M21 6c8 0 14 6 14 14 0 9-6 15-15 15C11 35 5 29 5 21 5 12 12 6 21 6z" fill="#5e4a3f" />
        <circle cx="15" cy="17" r="3.5" fill="#3b2d27" />
        <circle cx="25" cy="26" r="2.5" fill="#3b2d27" />
        <path d="M26 13l2.5 2.5L26 18l-2.5-2.5z" fill="#6ff3e6" />
      </svg>
    ),
  },
  {
    title: `${ROUND_SECONDS} seconds each`,
    text: "Type an answer, press Enter, keep going. Gold, Crystal and Starcore finds add time.",
    icon: (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="22" r="13" fill="none" stroke="#ffb547" strokeWidth="3" />
        <path d="M20 22V14" stroke="#fff3dc" strokeWidth="3" strokeLinecap="round" />
        <path d="M20 22l6 4" stroke="#fff3dc" strokeWidth="3" strokeLinecap="round" />
        <rect x="16" y="4" width="8" height="4" rx="1.5" fill="#ffb547" />
      </svg>
    ),
  },
  {
    title: "Rare digs deeper",
    text: "Obvious answers are stone. Obscure ones are gems.",
    icon: (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 5l11 11-11 19L9 16z" fill="#6ff3e6" />
        <path d="M20 5l11 11H9z" fill="#b9fff6" />
        <path d="M20 16v19" stroke="#2a8f8a" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Share your depth",
    text: "One total for the day. No spoilers.",
    icon: (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="11" cy="20" r="5" fill="#ff6fd8" />
        <circle cx="29" cy="10" r="5" fill="#ffb547" />
        <circle cx="29" cy="30" r="5" fill="#6b97ff" />
        <path d="M15 18l10-6M15 22l10 6" stroke="#f3eefc" strokeWidth="2.5" />
      </svg>
    ),
  },
];

/** A faceted gem drawn in the tier's color. */
function TierGem({ tier }: { tier: TierId }) {
  const u = useSvgIds();
  if (tier === 1) {
    return (
      <svg viewBox="0 0 48 48" className={s.gemSvg} aria-hidden="true">
        <path d="M10 30c0-9 6-16 15-16 8 0 14 6 14 14 0 7-6 12-14 12-9 0-15-4-15-10z" fill="#8b8f9c" />
        <path d="M14 26c2-6 7-9 12-9" stroke="#c4c8d2" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="30" cy="31" r="2.5" fill="#6a6e7a" />
      </svg>
    );
  }
  const color = { 2: "#d9784a", 3: "#6b97ff", 4: "#f4c44f", 5: "#6ff3e6", 6: "#ff6fd8" }[tier];
  return (
    <svg viewBox="0 0 48 48" className={s.gemSvg} aria-hidden="true">
      {tier === 6 && (
        <defs>
          <linearGradient id={u("htp-star")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff5fd2" />
            <stop offset="0.35" stopColor="#ffd36e" />
            <stop offset="0.65" stopColor="#6ff3e6" />
            <stop offset="1" stopColor="#8f7bff" />
          </linearGradient>
        </defs>
      )}
      <path d="M24 6l15 14-15 22L9 20z" fill={tier === 6 ? `url(#${u("htp-star")})` : color} />
      <path d="M24 6l15 14H9z" fill="#fff" opacity="0.35" />
      <path d="M9 20l15 4 15-4" stroke="#000" strokeOpacity="0.2" strokeWidth="1.2" fill="none" />
      <path d="M24 24v18" stroke="#000" strokeOpacity="0.18" strokeWidth="1.2" />
      <path d="M17 13l4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

/** Steps, an interactive ore tier picker and a rank gauge. */
export default function HowToPlay() {
  const [tier, setTier] = useState<TierId>(1);
  const [rank, setRank] = useState<number | null>(null);
  const t = TIERS[tier];
  const top = RANKS[RANKS.length - 1].min * 1.25;

  return (
    <div className={s.guide}>
      <ol className={s.steps}>
        {STEPS.map((step, i) => (
          <li key={step.title} className={s.step} style={{ animationDelay: `${i * 70}ms` }}>
            <span className={s.stepIcon}>{step.icon}</span>
            <strong>{step.title}</strong>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>

      <h3 className={s.heading}>Ore tiers</h3>
      <p className={s.sub}>Hover or tap a gem.</p>
      <div className={s.gems} role="listbox" aria-label="Ore tiers">
        {TIER_LIST.map((x) => (
          <button
            key={x.id}
            type="button"
            role="option"
            aria-selected={tier === x.id}
            className={s.gem}
            data-active={tier === x.id}
            style={{ "--c": x.color } as React.CSSProperties}
            onMouseEnter={() => setTier(x.id)}
            onFocus={() => setTier(x.id)}
            onClick={() => setTier(x.id)}
          >
            <TierGem tier={x.id} />
            <span className={s.gemName}>{x.name}</span>
          </button>
        ))}
      </div>
      <div key={tier} className={s.tierCard} style={{ "--c": t.color } as React.CSSProperties} aria-live="polite">
        <div className={s.tierTop}>
          <span className={s.tierName}>{t.name}</span>
          <span className={s.tierDepth}>
            +{t.depth} m{t.bonus ? ` · +${t.bonus}s` : ""}
          </span>
        </div>
        <p className={s.tierBlurb}>{t.blurb}</p>
        <div className={s.meter}>
          <span className={s.meterFill} style={{ width: `${(t.depth / TIERS[6].depth) * 100}%` }} />
        </div>
        <p className={s.example}>
          Example from Cheeses: <strong>{EXAMPLES[tier]}</strong>
        </p>
      </div>

      <h3 className={s.heading}>Ranks</h3>
      <p className={s.sub}>Your five rocks add up to one depth for the day.</p>
      <div className={s.gauge}>
        <div className={s.track} />
        {RANKS.map((r, i) => (
          <button
            key={r.title}
            type="button"
            className={s.notch}
            data-active={rank === i}
            style={{ left: `${(r.min / top) * 100}%` }}
            onMouseEnter={() => setRank(i)}
            onMouseLeave={() => setRank(null)}
            onFocus={() => setRank(i)}
            onBlur={() => setRank(null)}
            onClick={() => setRank(i)}
            aria-label={`${r.title}, ${r.min.toLocaleString("en-US")} meters`}
          >
            <span className={s.notchDot} />
            <span className={s.notchLabel}>
              <strong>{r.title}</strong>
              {r.min.toLocaleString("en-US")} m+
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
