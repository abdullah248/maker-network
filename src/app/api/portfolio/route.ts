import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { requireOwnedProfile } from "@/lib/services/authz";
import { createPortfolioItem, listPortfolio } from "@/lib/services/portfolio";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const userId = await requireSessionUserId();
  const profile = await requireOwnedProfile(userId);
  return NextResponse.json(await listPortfolio(profile.id));
});

export const POST = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const body = await readJson(request);
  return NextResponse.json(await createPortfolioItem(userId, body), { status: 201 });
});
