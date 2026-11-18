import type { NextRequest } from "next/server";
import { isPlayable } from "@/lib/dates";
import { categoriesForDate } from "@/lib/server/catalog";
import type { RevealResponse } from "@/lib/api-types";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/reveal/[date]/[round]">) {
  const { date, round } = await ctx.params;
  const r = Number(round);
  if (!isPlayable(date) || !Number.isInteger(r)) {
    return Response.json({ error: "That day isn't open." }, { status: 404 });
  }
  const cat = categoriesForDate(date)[r];
  if (!cat) {
    return Response.json({ error: "No such round." }, { status: 404 });
  }
  const body: RevealResponse = {
    answers: cat.answers
      .map((a) => ({ name: a.name, tier: a.tier }))
      .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name)),
  };
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
