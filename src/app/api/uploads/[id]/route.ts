import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { requireSessionUserId, withApi } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import {
  deleteUpload,
  getAccessibleFile,
  resolveStoragePath,
} from "@/lib/services/uploads";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * Streams a design file back to an authorised participant.
 *
 * Files are always served as an opaque attachment. Design formats such as SVG
 * can contain script, so never let the browser render one inline from our
 * origin.
 */
export const GET = withApi(async (_request: Request, context: Context) => {
  const userId = await requireSessionUserId();
  const { id } = await context.params;
  const file = await getAccessibleFile(userId, id);

  let bytes: Buffer;
  try {
    bytes = await readFile(resolveStoragePath(file.storageKey));
  } catch {
    throw new NotFoundError("That file is no longer available.");
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(file.sizeBytes),
      "content-disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cache-control": "private, no-store",
    },
  });
});

export const DELETE = withApi(async (_request: Request, context: Context) => {
  const userId = await requireSessionUserId();
  const { id } = await context.params;
  await deleteUpload(userId, id);
  return NextResponse.json({ ok: true });
});
