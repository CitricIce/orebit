"use client";

import { useId } from "react";

/**
 * Unique ids for SVG gradients, filters and clip paths. Next.js keeps a
 * hidden copy of the previous page mounted, so two scenes can exist at once.
 * With fixed ids the browser can pick the hidden copy's gradient, which
 * leaves shapes unfilled. Each component instance gets its own suffix.
 */
export function useSvgIds(): (name: string) => string {
  const suffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (name: string) => `${name}-${suffix}`;
}
