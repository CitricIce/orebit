"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False during server render and hydration, true after. Lets components read
 * browser-only data (localStorage, the local date) during render without a
 * hydration mismatch.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
