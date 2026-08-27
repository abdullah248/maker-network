import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { respondToReview } from "@/lib/services/reviews";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi(async (request: Request, context: Context) => {
  const userId = await requireSessionUserId();
  const { id } = await context.params;
  const body = await readJson(request);
  return NextResponse.json(await respondToReview(userId, id, body));
});
