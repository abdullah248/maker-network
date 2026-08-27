import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { createAvailabilitySlot, listAvailability } from "@/lib/services/inventory";
import { getOwnProfile } from "@/lib/services/profiles";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const profile = await getOwnProfile(userId);
  if (!profile) return NextResponse.json([]);

  const params = new URL(request.url).searchParams;
  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;

  const range =
    (from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))
      ? {
          from: from && !Number.isNaN(from.getTime()) ? from : undefined,
          to: to && !Number.isNaN(to.getTime()) ? to : undefined,
        }
      : undefined;

  const slots = await listAvailability(profile.id, range);
  return NextResponse.json(slots);
});

export const POST = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const body = await readJson(request);
  const slot = await createAvailabilitySlot(userId, body);
  return NextResponse.json(slot, { status: 201 });
});
