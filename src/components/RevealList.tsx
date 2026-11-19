"use client";

import { useState } from "react";
import { TIER_LIST, TIERS, type TierId } from "@/lib/tiers";
import type { FoundOre } from "@/lib/client/storage";
import s from "./RevealList.module.css";

/** Every answer in the rock, grouped by tier, with the player's finds lit up. */
export default function RevealList({
  answers,
  found,
}: {
  answers: { name: string; tier: TierId }[] | null;
  found: FoundOre[];
}) {
  // One tier can be opened at a time to see every answer in it.
  const [open, setOpen] = useState<TierId | null>(null);
  if (!answers) return <div className={s.loading}>Analyzing core sample…</div>;

  const mine = new Set(found.map((o) => o.name));
  const groups = [...TIER_LIST].reverse().map((t) => ({
    tier: t,
    items: answers.filter((a) => a.tier === t.id),
  }));

  return (
    <div className={s.wrap}>
      {groups.map(({ tier, items }) => {
        if (!items.length) return null;
        const got = items.filter((a) => mine.has(a.name)).length;
        const expanded = open === tier.id;
        const preview = tier.id === 1 ? 18 : 24;
        const limit = expanded ? items.length : preview;
        return (
          <section
            key={tier.id}
            className={s.group}
            style={{ "--c": TIERS[tier.id].color } as React.CSSProperties}
          >
            <h3 className={s.head}>
              <span className={s.gem} data-tier={tier.id} />
              {tier.name}
              <span className={s.count}>
                {got}/{items.length} · {tier.depth} m each
              </span>
            </h3>
            <ul className={s.list} data-expanded={expanded}>
              {items
                .slice()
                .sort((a, b) => Number(mine.has(b.name)) - Number(mine.has(a.name)))
                .slice(0, limit)
                .map((a) => (
                  <li key={a.name} className={s.item} data-found={mine.has(a.name)}>
                    {a.name}
                  </li>
                ))}
            </ul>
            {items.length > preview && (
              <button
                type="button"
                className={s.toggle}
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : tier.id)}
              >
                {expanded ? `Show fewer` : `Show all ${items.length.toLocaleString("en-US")} ${tier.name}`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
