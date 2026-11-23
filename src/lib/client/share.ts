"use client";

import { ores, rankFor, type TierId } from "../tiers";
import type { RoundResult } from "./storage";

export interface ShareData {
  number: number;
  date: string;
  total: number;
  rounds: RoundResult[];
  url: string;
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

  const rowH = Math.min(82, 290 / Math.max(1, d.rounds.length));
  const roomy = rowH >= 70;
  d.rounds.forEach((r, i) => {
    const y = 322 + i * rowH + (roomy ? 28 : 20);
    g.fillStyle = "#f3eefc";
    g.font = `600 ${roomy ? 32 : 24}px ${sans}`;
    // "Asteroid 1", never the category: the card mustn't spoil the day.
    g.fillText(`Asteroid ${i + 1}`, 64, y);
    g.fillStyle = "#b9b0cc";
    g.font = `500 ${roomy ? 26 : 19}px ${mono}`;
    g.fillText(`${ores(r.found.length)} · ${r.depth} m`, 64, y + (roomy ? 36 : 25));
    // Ore pips, sorted rarest first.
    const size = roomy ? 10 : 8;
    const pips = [...r.found].sort((a, b) => b.tier - a.tier).slice(0, 24);
    pips.forEach((o, j) => {
      g.fillStyle = COLORS[o.tier];
      const x = 520 + j * (size * 2.6);
      const cy = y - size;
      if (o.tier === 6) {
        g.save();
        g.shadowColor = COLORS[6];
        g.shadowBlur = 18;
      }
      g.beginPath();
      g.moveTo(x, cy - size * 1.2);
      g.lineTo(x + size, cy);
      g.lineTo(x, cy + size * 1.2);
      g.lineTo(x - size, cy);
      g.closePath();
      g.fill();
      if (o.tier === 6) g.restore();
    });
  });

  g.fillStyle = "#b9b0cc";
  g.font = `500 26px ${mono}`;
  g.textAlign = "right";
  g.fillText(d.url.replace(/^https?:\/\//, ""), W - 56, H - 44);
  g.textAlign = "left";

  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
}
