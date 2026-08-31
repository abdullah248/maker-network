import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { createReview } from "@/lib/services/reviews";

export const dynamic = "force-dynamic";

export const POST = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const body = await readJson(request);
  return NextResponse.json(await createReview(userId, body), { status: 201 });
});
