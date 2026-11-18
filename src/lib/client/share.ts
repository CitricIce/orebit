"use client";

import { ores, rankFor, TIERS, type TierId } from "../tiers";
import type { RoundResult } from "./storage";

export interface ShareData {
  number: number;
  date: string;
  total: number;
  rounds: RoundResult[];
  url: string;
}

function bestTier(r: RoundResult): TierId | 0 {
  return r.found.reduce<TierId | 0>((m, o) => (o.tier > m ? o.tier : m), 0);
}

/** One bar per tier found, so friends can compare without spoilers. */
function bar(r: RoundResult): string {
  const counts = [1, 2, 3, 4, 5, 6].map((t) => r.found.filter((o) => o.tier === t).length);
  const glyphs = ["·", "▪", "▫", "◆", "◇", "✶"];
  return counts.map((c, i) => (c ? glyphs[i].repeat(Math.min(c, 6)) : "")).join("") || "—";
}

export function shareText(d: ShareData): string {
  const lines = [`Orebit #${d.number} · ${d.total.toLocaleString("en-US")} m · ${rankFor(d.total).title}`];
  d.rounds.forEach((r, i) => {
    const bt = bestTier(r);
    const best = bt === 6 ? "STARCORE" : bt ? TIERS[bt].name : "nothing";
    lines.push(`${i + 1}. ${r.title}: ${ores(r.found.length)}, ${r.depth} m, best ${best}`);
    lines.push(`   ${bar(r)}`);
  });
  lines.push(d.url);
  return lines.join("\n");
}

const COLORS: Record<TierId, string> = {
  1: "#8b8f9c",
  2: "#d0703f",
  3: "#5b8cff",
  4: "#f4c44f",
  5: "#6ff3e6",
  6: "#ff5fd2",
};

/** Draw a 1200x630 result card and return it as a PNG blob. */
export async function shareImage(d: ShareData): Promise<Blob | null> {
  const W = 1200;
  const H = 630;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  await document.fonts?.ready;

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0d0b1a");
  bg.addColorStop(1, "#1b1030");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Stars, seeded by the day number so every card for a day matches.
  let s = d.number * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.6})`;
    const r = rand() * 1.6 + 0.3;
    g.beginPath();
    g.arc(rand() * W, rand() * H, r, 0, Math.PI * 2);
    g.fill();
  }

  // Asteroid limb in the corner.
  const rock = g.createRadialGradient(1080, 680, 40, 1080, 680, 420);
  rock.addColorStop(0, "#5a4a63");
  rock.addColorStop(0.7, "#2e2438");
  rock.addColorStop(1, "rgba(46,36,56,0)");
  g.fillStyle = rock;
  g.beginPath();
  g.arc(1080, 680, 420, 0, Math.PI * 2);
  g.fill();

  const sans = '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif';
  const mono = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';

  g.fillStyle = "#ffb547";
  g.font = `700 34px ${mono}`;
  g.fillText(`OREBIT #${d.number}`, 64, 92);

  g.fillStyle = "#f3eefc";
  g.font = `700 112px ${sans}`;
  g.fillText(`${d.total.toLocaleString("en-US")} m`, 60, 214);

  g.fillStyle = "#b9b0cc";
  g.font = `500 36px ${sans}`;
  g.fillText(rankFor(d.total).title, 64, 266);

  d.rounds.forEach((r, i) => {
    const y = 350 + i * 82;
    g.fillStyle = "#f3eefc";
    g.font = `600 32px ${sans}`;
    g.fillText(r.title, 64, y);
    g.fillStyle = "#b9b0cc";
    g.font = `500 26px ${mono}`;
    g.fillText(`${ores(r.found.length)} · ${r.depth} m`, 64, y + 36);
    // Ore pips, sorted rarest first.
    const pips = [...r.found].sort((a, b) => b.tier - a.tier).slice(0, 22);
    pips.forEach((o, j) => {
      g.fillStyle = COLORS[o.tier];
      const x = 520 + j * 26;
      if (o.tier === 6) {
        g.save();
        g.shadowColor = COLORS[6];
        g.shadowBlur = 18;
      }
      g.beginPath();
      g.moveTo(x, y - 22);
      g.lineTo(x + 10, y - 10);
      g.lineTo(x, y + 2);
      g.lineTo(x - 10, y - 10);
      g.closePath();
      g.fill();
      if (o.tier === 6) g.restore();
    });
  });

  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
}
