import { NextResponse } from "next/server";

import { requireSessionUserId, withApi } from "@/lib/api";
import { deleteAvailabilitySlot } from "@/lib/services/inventory";

export const dynamic = "force-dynamic";

export const DELETE = withApi(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    await deleteAvailabilitySlot(userId, id);
    return NextResponse.json({ ok: true });
  },
);
