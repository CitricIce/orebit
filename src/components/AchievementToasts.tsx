"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Achievement } from "@/lib/achievements";
import s from "./AchievementToasts.module.css";

const SHOW_MS = 3000;

/** Pops each newly unlocked achievement in the top-right corner, one at a time. */
export default function AchievementToasts({ items }: { items: Achievement[] }) {
  const [index, setIndex] = useState(0);
  const current = items[index];

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setIndex((i) => i + 1), SHOW_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current || typeof document === "undefined") return null;
  // Portal to <body>: an animated parent would otherwise trap position: fixed.
  return createPortal(
    <div className={s.stack} aria-live="polite">
      <div key={current.id} className={s.toast} role="status">
        <span className={s.badge} aria-hidden="true">
          {"★"}
        </span>
        <span className={s.text}>
          <span className={s.kicker}>Achievement unlocked</span>
          <strong>{current.title}</strong>
          <span className={s.desc}>{current.description}</span>
        </span>
        {items.length > 1 && (
          <span className={s.count}>
            {index + 1}/{items.length}
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}
