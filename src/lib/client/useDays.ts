"use client";

import { useSyncExternalStore } from "react";
import { daysSnapshot, serverDaysSnapshot, subscribeDays, type DayRecord } from "./storage";

/** Every saved run, kept up to date when a run is saved (here or in another tab). */
export function useDays(): Record<string, DayRecord> {
  return useSyncExternalStore(subscribeDays, daysSnapshot, serverDaysSnapshot);
}
