import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { getOwnProfile, upsertOwnProfile } from "@/lib/services/profiles";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const userId = await requireSessionUserId();
  const profile = await getOwnProfile(userId);
  return NextResponse.json(profile);
});

export const PUT = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const body = await readJson(request);
  const profile = await upsertOwnProfile(userId, body);
  return NextResponse.json(profile);
});
