import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { createMachine, listMachines } from "@/lib/services/inventory";
import { getOwnProfile } from "@/lib/services/profiles";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const userId = await requireSessionUserId();
  const profile = await getOwnProfile(userId);
  const machines = profile ? await listMachines(profile.id) : [];
  return NextResponse.json(machines);
});

export const POST = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const body = await readJson(request);
  const machine = await createMachine(userId, body);
  return NextResponse.json(machine, { status: 201 });
});
