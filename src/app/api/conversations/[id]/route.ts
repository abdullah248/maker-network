import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { archiveConversation, getConversation } from "@/lib/services/messaging";

export const dynamic = "force-dynamic";

export const GET = withApi(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    const { conversation, role } = await getConversation(userId, id);
    return NextResponse.json({ conversation, role });
  },
);

export const PATCH = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    const body = (await readJson(request)) as { archived?: boolean };
    const conversation = await archiveConversation(userId, id, body.archived ?? true);
    return NextResponse.json(conversation);
  },
);
