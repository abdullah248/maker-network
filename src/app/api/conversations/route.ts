import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { listConversations, startConversation } from "@/lib/services/messaging";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const userId = await requireSessionUserId();
  const conversations = await listConversations(userId);
  return NextResponse.json(conversations);
});

export const POST = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const body = await readJson(request);
  const conversation = await startConversation(userId, body);
  return NextResponse.json(conversation, { status: 201 });
});
