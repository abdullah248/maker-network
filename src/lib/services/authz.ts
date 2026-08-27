import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";

/**
 * Resolves the profile owned by `userId`, or throws. Every mutating service
 * routes through this so a caller can never act on someone else's profile by
 * passing a foreign id (IDOR protection).
 */
export async function requireOwnedProfile(userId: string | null | undefined) {
  if (!userId) throw new UnauthorizedError();
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    throw new NotFoundError("You have not created a maker profile yet.");
  }
  return profile;
}

/** Confirms a child record belongs to the caller's profile before mutation. */
export async function assertOwnsProfile(userId: string | null | undefined, profileId: string) {
  const profile = await requireOwnedProfile(userId);
  if (profile.id !== profileId) {
    throw new ForbiddenError();
  }
  return profile;
}

export function requireUserId(userId: string | null | undefined): string {
  if (!userId) throw new UnauthorizedError();
  return userId;
}
