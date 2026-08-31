import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { deleteMachine, updateMachine } from "@/lib/services/inventory";

export const dynamic = "force-dynamic";

export const PUT = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    const body = await readJson(request);
    const machine = await updateMachine(userId, id, body);
    return NextResponse.json(machine);
  },
);

export const DELETE = withApi(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    await deleteMachine(userId, id);
    return NextResponse.json({ ok: true });
  },
);
