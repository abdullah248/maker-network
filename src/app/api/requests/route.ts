import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { createPrintRequest } from "@/lib/services/messaging";

export const dynamic = "force-dynamic";

export const POST = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const body = await readJson(request);
  const conversation = await createPrintRequest(userId, body);
  return NextResponse.json(conversation, { status: 201 });
});
