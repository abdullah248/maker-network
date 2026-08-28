import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { decideOnRequest } from "@/lib/services/requests";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi(async (request: Request, context: Context) => {
  const userId = await requireSessionUserId();
  const { id } = await context.params;
  const body = (await readJson(request)) as Record<string, unknown>;

  // The id in the path always wins over anything in the body.
  return NextResponse.json(await decideOnRequest(userId, { ...body, requestId: id }));
});
