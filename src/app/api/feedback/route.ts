import { FEEDBACK_TYPES, feedbackEnabled, listFeedback, saveFeedback, type FeedbackType } from "@/lib/server/feedback";

const MAX_MESSAGE = 1000;

// A light per-instance limit so one visitor can't flood the list. Counts are
// kept in memory for 10 minutes and never stored.
const recent = new Map<string, number[]>();
function tooMany(req: Request): boolean {
  const who = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const now = Date.now();
  const hits = (recent.get(who) ?? []).filter((t) => now - t < 10 * 60_000);
  hits.push(now);
  recent.set(who, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > 5;
}

export async function POST(req: Request) {
  let body: { type?: unknown; message?: unknown; page?: unknown; website?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  // "website" is a hidden field only bots fill in.
  if (body.website) return Response.json({ ok: true });
  const type = body.type as FeedbackType;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const page = typeof body.page === "string" ? body.page.slice(0, 120) : "";
  if (!FEEDBACK_TYPES.includes(type) || message.length < 3 || message.length > MAX_MESSAGE) {
    return Response.json({ error: "Please write a short message (up to 1,000 characters)." }, { status: 400 });
  }
  if (!feedbackEnabled) return Response.json({ error: "Feedback isn't set up yet." }, { status: 503 });
  if (tooMany(req)) return Response.json({ error: "Thanks! That's a lot of reports. Try again in a few minutes." }, { status: 429 });
  try {
    await saveFeedback({ at: new Date().toISOString(), type, message, page });
  } catch {
    return Response.json({ error: "Couldn't send that. Try again in a moment." }, { status: 500 });
  }
  return Response.json({ ok: true });
}

// Reports for the daily review. Needs "Authorization: Bearer <MISSES_KEY>".
// ?since=2026-11-21T00:00:00Z limits it to newer reports.
export async function GET(req: Request) {
  const key = process.env.MISSES_KEY;
  if (!key || req.headers.get("authorization") !== `Bearer ${key}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  return Response.json({ feedback: await listFeedback(since) }, { headers: { "Cache-Control": "no-store" } });
}
