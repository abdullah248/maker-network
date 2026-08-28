import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { createDetailedRequest } from "@/lib/services/requests";

export const dynamic = "force-dynamic";

export const POST = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const body = await readJson(request);
  const conversation = await createDetailedRequest(userId, body);
  return NextResponse.json(conversation, { status: 201 });
});
