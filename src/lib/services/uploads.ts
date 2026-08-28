import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/db";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
} from "@/lib/print-specs";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { requireUserId } from "./authz";

/**
 * Design files are written to disk rather than the database. The directory is
 * configurable so a deployment can point it at a mounted volume; it defaults to
 * a gitignored folder in the project root.
 */
export const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads"),
);

/**
 * Reduces an arbitrary client filename to something safe to display and to
 * echo back in a Content-Disposition header. This value is never used to build
 * a path — the storage key is generated server-side.
 */
export function sanitizeFilename(raw: string): string {
  const base = raw.split(/[/\\]/).pop() ?? "file";
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  const safe = cleaned.length > 0 ? cleaned : "file";
  return safe.slice(0, 120);
}

export function extensionOf(filename: string): string {
  const match = /\.[A-Za-z0-9]+$/.exec(filename);
  return match ? match[0].toLowerCase() : "";
}

/**
 * Resolves a storage key to an absolute path, refusing anything that escapes
 * the upload root even if the key were somehow tampered with.
 */
export function resolveStoragePath(storageKey: string): string {
  const resolved = path.resolve(UPLOAD_ROOT, storageKey);
  const root = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : `${UPLOAD_ROOT}${path.sep}`;
  if (!resolved.startsWith(root)) {
    throw new ForbiddenError("Invalid file location.");
  }
  return resolved;
}

export type UploadInput = {
  filename: string;
  mimeType?: string | null;
  bytes: Buffer | Uint8Array;
};

/** Stores one uploaded design file against the caller, unattached to a request. */
export async function storeUpload(userId: string | null | undefined, input: UploadInput) {
  const uploaderId = requireUserId(userId);

  const filename = sanitizeFilename(input.filename);
  const extension = extensionOf(filename);

  if (!extension) {
    throw new ValidationError("That file has no extension, so we can't tell what it is.");
  }
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(extension)) {
    throw new ValidationError(
      `${extension} files aren't supported. Accepted types: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}.`,
    );
  }

  const size = input.bytes.byteLength;
  if (size === 0) {
    throw new ValidationError("That file is empty.");
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `Files must be ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB or smaller.`,
    );
  }

  // Cap how many unattached files a user can accumulate.
  const pending = await prisma.requestFile.count({
    where: { uploaderId, requestId: null },
  });
  if (pending >= MAX_FILES_PER_REQUEST) {
    throw new ValidationError(
      `You can attach up to ${MAX_FILES_PER_REQUEST} files. Remove one before adding another.`,
    );
  }

  const storageKey = path.join(uploaderId, `${randomUUID()}${extension}`);
  const absolutePath = resolveStoragePath(storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.bytes);

  return prisma.requestFile.create({
    data: {
      uploaderId,
      filename,
      storageKey,
      // The browser-supplied type is advisory only; downloads are always served
      // as an opaque attachment.
      mimeType: (input.mimeType ?? "application/octet-stream").slice(0, 120),
      sizeBytes: size,
    },
  });
}

export async function listPendingUploads(userId: string | null | undefined) {
  const uploaderId = requireUserId(userId);
  return prisma.requestFile.findMany({
    where: { uploaderId, requestId: null },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Resolves a file the caller is allowed to download: the uploader, or either
 * participant in the conversation the file's request belongs to.
 */
export async function getAccessibleFile(userId: string | null | undefined, fileId: string) {
  const viewerId = requireUserId(userId);

  const file = await prisma.requestFile.findUnique({
    where: { id: fileId },
    include: {
      request: {
        select: {
          conversation: {
            select: { requesterId: true, providerProfile: { select: { userId: true } } },
          },
        },
      },
    },
  });

  // A 404 for everyone else so file ids cannot be probed.
  if (!file) throw new NotFoundError("File not found.");

  if (file.uploaderId === viewerId) return file;

  const conversation = file.request?.conversation;
  const isParticipant =
    conversation?.requesterId === viewerId ||
    conversation?.providerProfile.userId === viewerId;

  if (!isParticipant) throw new NotFoundError("File not found.");
  return file;
}

/** Only the uploader may delete, and only while the file is still unattached. */
export async function deleteUpload(userId: string | null | undefined, fileId: string) {
  const uploaderId = requireUserId(userId);

  const file = await prisma.requestFile.findUnique({ where: { id: fileId } });
  if (!file) throw new NotFoundError("File not found.");
  if (file.uploaderId !== uploaderId) throw new NotFoundError("File not found.");
  if (file.requestId) {
    throw new ValidationError("Files attached to a submitted request cannot be removed.");
  }

  await prisma.requestFile.delete({ where: { id: file.id } });
  await unlink(resolveStoragePath(file.storageKey)).catch(() => {
    // The database row is the source of truth; a missing file is not fatal.
  });
}

/**
 * Links previously uploaded files to a request. Only the caller's own
 * unattached files can be claimed, so a client cannot attach someone else's.
 */
export async function attachFilesToRequest(
  tx: {
    requestFile: {
      updateMany: (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => Promise<{ count: number }>;
    };
  },
  userId: string,
  requestId: string,
  fileIds: string[],
) {
  if (fileIds.length === 0) return 0;

  const result = await tx.requestFile.updateMany({
    where: { id: { in: fileIds }, uploaderId: userId, requestId: null },
    data: { requestId },
  });
  return result.count;
}

export function checksum(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
