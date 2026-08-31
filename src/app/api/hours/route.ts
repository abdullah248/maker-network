import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { listOperatingHours, replaceOperatingHours } from "@/lib/services/inventory";
import { getOwnProfile } from "@/lib/services/profiles";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const userId = await requireSessionUserId();
  const profile = await getOwnProfile(userId);
  const hours = profile ? await listOperatingHours(profile.id) : [];
  return NextResponse.json(hours);
});

export const PUT = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const body = await readJson(request);
  const hours = await replaceOperatingHours(userId, body);
  return NextResponse.json(hours);
});
