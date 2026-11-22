"use client";

import { soundEnabled } from "./storage";
import type { TierId } from "../tiers";

/** Tiny synth sound effects. No audio files to load. */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined" || !soundEnabled()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, endFreq?: number) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const NOTES: Record<TierId, number[]> = {
  1: [330],
  2: [392],
  3: [440, 554],
  4: [523, 659, 784],
  5: [659, 830, 988, 1319],
  6: [523, 659, 784, 1047, 1319, 1568],
};

export const sfx = {
  hit(tier: TierId) {
    NOTES[tier].forEach((f, i) => tone(f, i * 0.06, 0.18 + (tier >= 5 ? 0.15 : 0), tier >= 4 ? "triangle" : "square", 0.06));
    if (tier === 6) {
      tone(80, 0, 0.6, "sine", 0.12, 40);
      // A bright sparkle run after the chord.
      [1568, 1760, 2093, 2349, 2637, 3136].forEach((f, i) => tone(f, 0.42 + i * 0.05, 0.22, "triangle", 0.035));
    }
  },
  miss() {
    tone(140, 0, 0.12, "sawtooth", 0.04, 90);
  },
  dupe() {
    tone(260, 0, 0.07, "square", 0.03);
    tone(260, 0.09, 0.07, "square", 0.03);
  },
  tick(urgent: boolean) {
    tone(urgent ? 1200 : 900, 0, 0.03, "square", 0.025);
  },
  start() {
    tone(220, 0, 0.35, "sawtooth", 0.05, 660);
  },
  count() {
    tone(660, 0, 0.08, "square", 0.04);
  },
  launch() {
    // Low rumble that climbs as the rocket clears the pad.
    tone(55, 0, 2.6, "sawtooth", 0.07, 140);
    tone(82, 0.05, 2.4, "square", 0.025, 220);
    tone(300, 1.2, 1.6, "sine", 0.03, 900);
  },
  warp() {
    tone(180, 0, 1.4, "sine", 0.05, 1400);
    tone(90, 0.1, 1.8, "triangle", 0.04, 600);
  },
  end() {
    tone(500, 0, 0.5, "sawtooth", 0.05, 120);
  },
};
