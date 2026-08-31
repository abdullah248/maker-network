import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { deletePortfolioItem, updatePortfolioItem } from "@/lib/services/portfolio";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const PUT = withApi(async (request: Request, context: Context) => {
  const userId = await requireSessionUserId();
  const { id } = await context.params;
  const body = await readJson(request);
  return NextResponse.json(await updatePortfolioItem(userId, id, body));
});

export const DELETE = withApi(async (_request: Request, context: Context) => {
  const userId = await requireSessionUserId();
  const { id } = await context.params;
  await deletePortfolioItem(userId, id);
  return NextResponse.json({ ok: true });
});
