import { NextResponse } from "next/server";

import { requireSessionUserId, withApi } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { MAX_UPLOAD_BYTES } from "@/lib/print-specs";
import { listPendingUploads, storeUpload } from "@/lib/services/uploads";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const userId = await requireSessionUserId();
  return NextResponse.json(await listPendingUploads(userId));
});

export const POST = withApi(async (request: Request) => {
  const userId = await requireSessionUserId();

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new AppError("Upload a file as multipart/form-data.", 415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES + 1024 * 1024) {
    throw new AppError("That file is too large.", 413, "PAYLOAD_TOO_LARGE");
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new AppError("No file was included in the upload.", 400, "MISSING_FILE");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await storeUpload(userId, {
    filename: file.name,
    mimeType: file.type,
    bytes,
  });

  return NextResponse.json(stored, { status: 201 });
});
