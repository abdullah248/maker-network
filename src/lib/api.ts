import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { AppError, UnauthorizedError, isAppError } from "@/lib/errors";

export type ApiHandler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

/** Body size ceiling for JSON requests (64 KB) — blocks trivial payload DoS. */
const MAX_BODY_BYTES = 64 * 1024;

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new AppError("Expected a JSON request body.", 415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    throw new AppError("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new AppError("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  }
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("Request body is not valid JSON.", 400, "INVALID_JSON");
  }
}

export function jsonError(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details ?? undefined },
      { status: error.status },
    );
  }

  console.error("[api] unhandled error", error);
  return NextResponse.json(
    { error: "Something went wrong on our end.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

/** Wraps a handler so service errors become consistent JSON responses. */
export function withApi<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      return jsonError(error);
    }
  };
}

export async function requireSessionUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new UnauthorizedError();
  return id;
}
