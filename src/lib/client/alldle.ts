"use client";

// Alldle SDK (loaded in the root layout). It reports finished surveys to the
// Alldle dashboard and ticks Orebit off in players' Alldle daily lineup.
// Every call is optional: if the script is blocked or slow, nothing breaks.

interface AlldleSdk {
  startMode(mode: string): void;
  completeMode(mode: string, result: { won: boolean; attempts?: number; maxAttempts?: number; puzzleId?: string }): void;
  track(event: string, props?: Record<string, string | number | boolean>): void;
}

declare global {
  interface Window {
    alldle?: AlldleSdk;
  }
}

/** Run fn once the SDK is ready, waiting up to 10 seconds for it to load. */
function withSdk(fn: (sdk: AlldleSdk) => void, tries = 20): void {
  if (typeof window === "undefined") return;
  const sdk = window.alldle;
  if (sdk) {
    try {
      fn(sdk);
    } catch {
      // Analytics must never break the game.
    }
    return;
  }
  if (tries > 0) setTimeout(() => withSdk(fn, tries - 1), 500);
}

export type PlayMode = "daily" | "archive";

export const alldle = {
  start(mode: PlayMode) {
    withSdk((a) => a.startMode(mode));
  },
  /** Orebit has no losing, so a finished survey counts as a win. */
  complete(mode: PlayMode, surveyNumber: number) {
    withSdk((a) => a.completeMode(mode, { won: true, puzzleId: String(surveyNumber) }));
  },
  track(event: string, props?: Record<string, string | number | boolean>) {
    withSdk((a) => a.track(event, props));
  },
};
