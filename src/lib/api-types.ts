import type { TierId } from "./tiers";

export interface RoundInfo {
  index: number;
  id: string;
  designation: string;
  title: string;
  prompt: string;
  total: number;
  tierCounts: Record<TierId, number>;
}

export interface DayResponse {
  date: string;
  number: number;
  rounds: RoundInfo[];
}

export interface GuessRequest {
  date: string;
  round: number;
  guess: string;
}

export type GuessResponse =
  | { result: "hit"; name: string; tier: TierId }
  | { result: "miss" };

export interface RevealResponse {
  answers: { name: string; tier: TierId }[];
}

export interface ApiError {
  error: string;
}
