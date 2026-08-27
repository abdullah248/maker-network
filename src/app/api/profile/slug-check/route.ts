import { NextResponse } from "next/server";

import { requireSessionUserId, withApi } from "@/lib/api";
import { isSlugAvailable } from "@/lib/services/profiles";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const available = await isSlugAvailable(slug, userId);
  return NextResponse.json({ available });
});
