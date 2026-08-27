import { NextResponse } from "next/server";

import { readJson, requireSessionUserId, withApi } from "@/lib/api";
import { createMaterial, listMaterials } from "@/lib/services/inventory";
import { getOwnProfile } from "@/lib/services/profiles";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const userId = await requireSessionUserId();
  const profile = await getOwnProfile(userId);
  const materials = profile ? await listMaterials(profile.id) : [];
  return NextResponse.json(materials);
});

export const POST = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const body = await readJson(request);
  const material = await createMaterial(userId, body);
  return NextResponse.json(material, { status: 201 });
});
