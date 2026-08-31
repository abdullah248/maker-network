import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/constants";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { portfolioItemSchema } from "@/lib/validation";
import { requireOwnedProfile } from "./authz";

const ITEM_INCLUDE = {
  machine: { select: { id: true, make: true, model: true, category: true } },
} as const;

export async function listPortfolio(profileId: string) {
  return prisma.portfolioItem.findMany({
    where: { profileId },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: ITEM_INCLUDE,
  });
}

/** Gallery images for the public profile page. */
export async function listPublicPortfolio(profileId: string, take: number = LIMITS.portfolioMax) {
  return prisma.portfolioItem.findMany({
    where: { profileId },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: ITEM_INCLUDE,
    take,
  });
}

async function assertMachineBelongsToProfile(machineId: string | undefined, profileId: string) {
  if (!machineId) return null;
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine || machine.profileId !== profileId) {
    throw new ValidationError("That machine does not belong to your profile.");
  }
  return machine.id;
}

export async function createPortfolioItem(userId: string | null | undefined, input: unknown) {
  const profile = await requireOwnedProfile(userId);
  const parsed = portfolioItemSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const existing = await prisma.portfolioItem.count({ where: { profileId: profile.id } });
  if (existing >= LIMITS.portfolioMax) {
    throw new ValidationError(
      `You can showcase up to ${LIMITS.portfolioMax} projects. Remove one to add another.`,
    );
  }

  const machineId = await assertMachineBelongsToProfile(parsed.data.machineId, profile.id);

  return prisma.portfolioItem.create({
    data: {
      profileId: profile.id,
      machineId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl,
      altText: parsed.data.altText ?? null,
      materialUsed: parsed.data.materialUsed ?? null,
      featured: parsed.data.featured,
      sortOrder: parsed.data.sortOrder,
    },
    include: ITEM_INCLUDE,
  });
}

export async function updatePortfolioItem(
  userId: string | null | undefined,
  itemId: string,
  input: unknown,
) {
  const profile = await requireOwnedProfile(userId);
  const parsed = portfolioItemSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const existing = await prisma.portfolioItem.findUnique({ where: { id: itemId } });
  if (!existing) throw new NotFoundError("Project not found.");
  if (existing.profileId !== profile.id) throw new ForbiddenError();

  const machineId = await assertMachineBelongsToProfile(parsed.data.machineId, profile.id);

  return prisma.portfolioItem.update({
    where: { id: itemId },
    data: {
      machineId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl,
      altText: parsed.data.altText ?? null,
      materialUsed: parsed.data.materialUsed ?? null,
      featured: parsed.data.featured,
      sortOrder: parsed.data.sortOrder,
    },
    include: ITEM_INCLUDE,
  });
}

export async function deletePortfolioItem(userId: string | null | undefined, itemId: string) {
  const profile = await requireOwnedProfile(userId);
  const existing = await prisma.portfolioItem.findUnique({ where: { id: itemId } });
  if (!existing) throw new NotFoundError("Project not found.");
  if (existing.profileId !== profile.id) throw new ForbiddenError();
  await prisma.portfolioItem.delete({ where: { id: itemId } });
}
