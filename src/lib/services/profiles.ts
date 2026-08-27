import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { AccountType } from "@/lib/constants";
import {
  onboardingSchema,
  profileInputSchema,
  slugSchema,
  type ProfileInput,
} from "@/lib/validation";
import { requireOwnedProfile, requireUserId } from "./authz";

const PUBLIC_PROFILE_INCLUDE = {
  machines: { orderBy: { createdAt: "asc" } },
  materials: { orderBy: { name: "asc" } },
  operatingHours: { orderBy: { dayOfWeek: "asc" } },
  user: { select: { id: true, name: true, image: true } },
} satisfies Prisma.ProfileInclude;

export type PublicProfile = Prisma.ProfileGetPayload<{
  include: typeof PUBLIC_PROFILE_INCLUDE;
}>;

/** Records the account type the user picked during onboarding. */
export async function completeOnboarding(userId: string | null | undefined, input: unknown) {
  const id = requireUserId(userId);
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  return prisma.user.update({
    where: { id },
    data: {
      accountType: parsed.data.accountType satisfies AccountType,
      onboardedAt: new Date(),
    },
    select: { id: true, accountType: true, onboardedAt: true },
  });
}

function toProfileData(input: ProfileInput) {
  const shared = {
    type: input.type,
    slug: input.slug,
    displayName: input.displayName,
    headline: input.headline ?? null,
    bio: input.bio ?? null,
    avatarUrl: input.avatarUrl ?? null,
    city: input.city,
    region: input.region ?? null,
    country: input.country,
    postalCode: input.postalCode ?? null,
    websiteUrl: input.websiteUrl ?? null,
    contactEmail: input.contactEmail ?? null,
    phone: input.phone ?? null,
    acceptingRequests: input.acceptingRequests,
    published: input.published,
  };

  if (input.type === "MAKERSPACE") {
    return {
      ...shared,
      requiresAppointment: input.requiresAppointment,
      requiresMembership: input.requiresMembership,
      requiresLibraryCard: input.requiresLibraryCard,
      membershipDetails: input.membershipDetails ?? null,
      accessNotes: input.accessNotes ?? null,
      // Fulfilment flags are meaningless for a walk-in space.
      offersShipping: false,
      offersLocalPickup: true,
      canCustomOrderMaterials: false,
      customOrderNotes: null,
    };
  }

  return {
    ...shared,
    offersShipping: input.offersShipping,
    offersLocalPickup: input.offersLocalPickup,
    canCustomOrderMaterials: input.canCustomOrderMaterials,
    customOrderNotes: input.customOrderNotes ?? null,
    requiresAppointment: false,
    requiresMembership: false,
    requiresLibraryCard: false,
    membershipDetails: null,
    accessNotes: null,
  };
}

/**
 * Creates or updates the caller's own profile. The profile is always keyed on
 * the session user id, so a `userId` or `id` supplied by the client is ignored.
 */
export async function upsertOwnProfile(userId: string | null | undefined, input: unknown) {
  const id = requireUserId(userId);
  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const data = toProfileData(parsed.data);

  try {
    const profile = await prisma.profile.upsert({
      where: { userId: id },
      create: { ...data, userId: id },
      update: data,
    });

    await prisma.user.update({
      where: { id },
      data: {
        accountType: parsed.data.type,
        onboardedAt: new Date(),
      },
    });

    return profile;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("That handle is already taken. Try another one.");
    }
    throw error;
  }
}

export async function getOwnProfile(userId: string | null | undefined) {
  const id = requireUserId(userId);
  return prisma.profile.findUnique({
    where: { userId: id },
    include: PUBLIC_PROFILE_INCLUDE,
  });
}

/** Fetches a published profile for the public directory. */
export async function getPublicProfileBySlug(slug: string): Promise<PublicProfile | null> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;

  return prisma.profile.findFirst({
    where: { slug: parsed.data, published: true },
    include: PUBLIC_PROFILE_INCLUDE,
  });
}

/**
 * Same as {@link getPublicProfileBySlug} but allows the owner to preview their
 * own unpublished profile.
 */
export async function getProfileBySlugForViewer(
  slug: string,
  viewerId: string | null | undefined,
): Promise<PublicProfile | null> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;

  const profile = await prisma.profile.findUnique({
    where: { slug: parsed.data },
    include: PUBLIC_PROFILE_INCLUDE,
  });

  if (!profile) return null;
  if (!profile.published && profile.userId !== viewerId) return null;
  return profile;
}

export async function isSlugAvailable(slug: string, forUserId?: string | null) {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return false;
  const existing = await prisma.profile.findUnique({
    where: { slug: parsed.data },
    select: { userId: true },
  });
  if (!existing) return true;
  return Boolean(forUserId) && existing.userId === forUserId;
}

/** Suggests a unique handle derived from a display name. */
export async function suggestSlug(displayName: string) {
  const base =
    displayName
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "maker";

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (candidate.length < 3) continue;
    if (await isSlugAvailable(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 60);
}

export async function setPublished(userId: string | null | undefined, published: boolean) {
  const profile = await requireOwnedProfile(userId);
  return prisma.profile.update({
    where: { id: profile.id },
    data: { published },
  });
}

export async function deleteOwnProfile(userId: string | null | undefined) {
  const profile = await requireOwnedProfile(userId);
  await prisma.profile.delete({ where: { id: profile.id } });
}

export async function getProfileOrThrow(slug: string) {
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) throw new NotFoundError("That maker profile could not be found.");
  return profile;
}
