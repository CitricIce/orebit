import "server-only";
import { createClient } from "redis";

// Bug reports and suggestions from the Feedback form. Stores the type, the
// message and the page it came from. No names, emails or IP addresses.

const REDIS_URL = process.env.REDIS_URL;
const KEY = "feedback";
const KEEP = 2000;

export const FEEDBACK_TYPES = ["bug", "suggestion", "missing-answer"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export interface FeedbackEntry {
  at: string;
  type: FeedbackType;
  message: string;
  page: string;
}

type Client = ReturnType<typeof createClient>;
let client: Promise<Client> | null = null;
function redis(): Promise<Client> {
  if (!client) {
    const c = createClient({ url: REDIS_URL, socket: { connectTimeout: 3000 } });
    c.on("error", () => {});
    client = c.connect().catch((err) => {
      client = null;
      throw err;
    });
  }
  return client;
}

export const feedbackEnabled = Boolean(REDIS_URL);

export async function saveFeedback(entry: FeedbackEntry): Promise<void> {
  const r = await redis();
  await r.multi().lPush(KEY, JSON.stringify(entry)).lTrim(KEY, 0, KEEP - 1).exec();
}

/** Newest first. */
export async function listFeedback(since?: string): Promise<FeedbackEntry[]> {
  if (!feedbackEnabled) return [];
  const r = await redis();
  const rows = (await r.lRange(KEY, 0, KEEP - 1)).map((x) => JSON.parse(x) as FeedbackEntry);
  return since ? rows.filter((e) => e.at >= since) : rows;
}
