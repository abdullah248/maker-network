import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { getConversation, sendMessage } from "@/lib/services/messaging";

export const dynamic = "force-dynamic";

type MessagePayload = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
};

/**
 * Returns messages in a conversation. With `?after=<ISO date>` only messages
 * created strictly after that timestamp are returned, which the thread view
 * uses for light polling. `getConversation` runs first so non-participants get
 * a 404 rather than any message data.
 */
export const GET = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    const { conversation } = await getConversation(userId, id);

    const afterParam = new URL(request.url).searchParams.get("after");
    const after = afterParam ? new Date(afterParam) : null;
    const hasAfter = after && !Number.isNaN(after.getTime());

    const messages: MessagePayload[] = conversation.messages
      .filter((message) => (hasAfter ? message.createdAt.getTime() > after.getTime() : true))
      .map((message) => ({
        id: message.id,
        body: message.body,
        senderId: message.senderId,
        createdAt: message.createdAt.toISOString(),
      }));

    return NextResponse.json({ messages });
  },
);

export const POST = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    const body = (await readJson(request)) as { body?: unknown };
    const message = await sendMessage(userId, { conversationId: id, body: body.body });
    return NextResponse.json(message, { status: 201 });
  },
);
