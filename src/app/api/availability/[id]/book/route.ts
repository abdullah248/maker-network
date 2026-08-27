import { NextResponse } from "next/server";

import { requireSessionUserId, withApi } from "@/lib/api";
import { bookAvailabilitySlot, releaseAvailabilitySlot } from "@/lib/services/inventory";

export const dynamic = "force-dynamic";

export const POST = withApi(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    const slot = await bookAvailabilitySlot(userId, id);
    return NextResponse.json(slot);
  },
);

export const DELETE = withApi(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    const slot = await releaseAvailabilitySlot(userId, id);
    return NextResponse.json(slot);
  },
);
