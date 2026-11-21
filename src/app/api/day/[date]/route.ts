import type { NextRequest } from "next/server";
import { dayNumber, isPlayable } from "@/lib/dates";
import { categoriesForDate, designation, NOT_SCHEDULED, tierCounts } from "@/lib/server/catalog";
import type { DayResponse } from "@/lib/api-types";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/day/[date]">) {
  const { date } = await ctx.params;
  if (!isPlayable(date)) {
    return Response.json({ error: "That day isn't open." }, { status: 404 });
  }
  const cats = categoriesForDate(date);
  if (!cats) {
    return Response.json({ error: NOT_SCHEDULED }, { status: 404 });
  }
  const body: DayResponse = {
    date,
    number: dayNumber(date),
    rounds: cats.map((c, index) => ({
      index,
      id: c.id,
      designation: designation(date, index),
      title: c.title,
      prompt: c.prompt,
      total: c.answers.length,
      tierCounts: tierCounts(c),
    })),
  };
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, must-revalidate" },
  });
}
