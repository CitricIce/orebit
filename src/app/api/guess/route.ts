import { isPlayable } from "@/lib/dates";
import { categoriesForDate, matchGuess } from "@/lib/server/catalog";
import type { GuessRequest, GuessResponse } from "@/lib/api-types";

const MAX_GUESS_LENGTH = 80;

export async function POST(req: Request) {
  let body: Partial<GuessRequest>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const { date, round, guess } = body;
  if (
    typeof date !== "string" ||
    typeof round !== "number" ||
    typeof guess !== "string" ||
    guess.length > MAX_GUESS_LENGTH
  ) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (!isPlayable(date)) {
    return Response.json({ error: "That day isn't open." }, { status: 404 });
  }
  const cat = categoriesForDate(date)?.[round];
  if (!cat) {
    return Response.json({ error: "No such round." }, { status: 404 });
  }

  const hit = matchGuess(cat, guess);
  const res: GuessResponse = hit ? { result: "hit", name: hit.name, tier: hit.tier } : { result: "miss" };
  return Response.json(res);
}
