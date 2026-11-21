import { missesEnabled, missesFor } from "@/lib/server/misses";

// Missed guesses for one day, for the daily answer review. Needs
// "Authorization: Bearer <MISSES_KEY>".
export async function GET(req: Request) {
  const key = process.env.MISSES_KEY;
  if (!key || req.headers.get("authorization") !== `Bearer ${key}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Use ?date=YYYY-MM-DD." }, { status: 400 });
  }
  return Response.json(
    { date, enabled: missesEnabled, misses: await missesFor(date) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
