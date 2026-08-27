import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { updateRequestStatus } from "@/lib/services/messaging";

export const dynamic = "force-dynamic";

export const PATCH = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    const body = (await readJson(request)) as { status?: unknown };
    const updated = await updateRequestStatus(userId, { requestId: id, status: body.status });
    return NextResponse.json(updated);
  },
);
