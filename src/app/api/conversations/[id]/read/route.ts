import { NextResponse } from "next/server";

import { requireSessionUserId, withApi } from "@/lib/api";
import { markConversationRead } from "@/lib/services/messaging";

export const dynamic = "force-dynamic";

export const POST = withApi(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    const count = await markConversationRead(userId, id);
    return NextResponse.json({ read: count });
  },
);
