import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { deleteMaterial, updateMaterial } from "@/lib/services/inventory";

export const dynamic = "force-dynamic";

export const PUT = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    const body = await readJson(request);
    const material = await updateMaterial(userId, id, body);
    return NextResponse.json(material);
  },
);

export const DELETE = withApi(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const userId = await requireSessionUserId();
    const { id } = await context.params;
    await deleteMaterial(userId, id);
    return NextResponse.json({ ok: true });
  },
);
