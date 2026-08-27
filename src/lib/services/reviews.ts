import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { reviewResponseSchema, reviewSchema, reviewUpdateSchema } from "@/lib/validation";
import { requireOwnedProfile, requireUserId } from "./authz";

const REVIEW_INCLUDE = {
  author: { select: { id: true, name: true, image: true } },
} as const;

export type ReviewWithAuthor = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

export type RatingSummary = {
  average: number;
  count: number;
  /** Number of reviews at each star level, indexed 1-5. */
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
};

/**
 * Recomputes a profile's denormalised rating aggregates. Always called inside
 * the same transaction as the review write so the two can never drift.
 */
async function recomputeRating(tx: Prisma.TransactionClient, profileId: string) {
  const result = await tx.review.aggregate({
    where: { profileId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const count = result._count.rating;
  const average = count === 0 ? 0 : Math.round((result._avg.rating ?? 0) * 100) / 100;

  await tx.profile.update({
    where: { id: profileId },
    data: { ratingAverage: average, ratingCount: count },
  });

  return { average, count };
}

/** A review is "verified" when the author completed a request with this maker. */
async function hasCompletedRequest(
  tx: Prisma.TransactionClient,
  profileId: string,
  authorId: string,
) {
  const completed = await tx.printRequest.count({
    where: {
      status: "COMPLETED",
      conversation: { providerProfileId: profileId, requesterId: authorId },
    },
  });
  return completed > 0;
}

export async function listReviews(profileId: string, take = 50) {
  return prisma.review.findMany({
    where: { profileId },
    orderBy: [{ createdAt: "desc" }],
    include: REVIEW_INCLUDE,
    take,
  });
}

export async function getRatingSummary(profileId: string): Promise<RatingSummary> {
  const grouped = await prisma.review.groupBy({
    by: ["rating"],
    where: { profileId },
    _count: { rating: true },
  });

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as RatingSummary["breakdown"];
  let total = 0;
  let sum = 0;

  for (const row of grouped) {
    const rating = row.rating as 1 | 2 | 3 | 4 | 5;
    if (rating >= 1 && rating <= 5) {
      breakdown[rating] = row._count.rating;
      total += row._count.rating;
      sum += rating * row._count.rating;
    }
  }

  return {
    average: total === 0 ? 0 : Math.round((sum / total) * 100) / 100,
    count: total,
    breakdown,
  };
}

/** The signed-in user's own review of a profile, if they have written one. */
export async function getOwnReview(profileId: string, userId: string | null | undefined) {
  if (!userId) return null;
  return prisma.review.findUnique({
    where: { profileId_authorId: { profileId, authorId: userId } },
    include: REVIEW_INCLUDE,
  });
}

export async function createReview(userId: string | null | undefined, input: unknown) {
  const authorId = requireUserId(userId);
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const profile = await prisma.profile.findFirst({
    where: { slug: parsed.data.profileSlug, published: true },
    select: { id: true, userId: true },
  });
  if (!profile) throw new NotFoundError("That maker profile could not be found.");
  if (profile.userId === authorId) {
    throw new ValidationError("You cannot review your own profile.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const verified = await hasCompletedRequest(tx, profile.id, authorId);

      const review = await tx.review.create({
        data: {
          profileId: profile.id,
          authorId,
          rating: parsed.data.rating,
          title: parsed.data.title ?? null,
          body: parsed.data.body,
          verified,
        },
        include: REVIEW_INCLUDE,
      });

      await recomputeRating(tx, profile.id);
      return review;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("You have already reviewed this maker. Edit your review instead.");
    }
    throw error;
  }
}

export async function updateReview(
  userId: string | null | undefined,
  reviewId: string,
  input: unknown,
) {
  const authorId = requireUserId(userId);
  const parsed = reviewUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) throw new NotFoundError("Review not found.");
  if (existing.authorId !== authorId) throw new ForbiddenError("You can only edit your own review.");

  return prisma.$transaction(async (tx) => {
    const review = await tx.review.update({
      where: { id: reviewId },
      data: {
        rating: parsed.data.rating,
        title: parsed.data.title ?? null,
        body: parsed.data.body,
      },
      include: REVIEW_INCLUDE,
    });
    await recomputeRating(tx, existing.profileId);
    return review;
  });
}

export async function deleteReview(userId: string | null | undefined, reviewId: string) {
  const authorId = requireUserId(userId);

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { profile: { select: { userId: true } } },
  });
  if (!existing) throw new NotFoundError("Review not found.");

  // Authors may remove their own review. Profile owners deliberately cannot
  // delete criticism of their own shop.
  if (existing.authorId !== authorId) {
    throw new ForbiddenError("You can only delete your own review.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: reviewId } });
    await recomputeRating(tx, existing.profileId);
  });
}

/** Lets the profile owner post a single public reply beneath a review. */
export async function respondToReview(
  userId: string | null | undefined,
  reviewId: string,
  input: unknown,
) {
  const profile = await requireOwnedProfile(userId);
  const parsed = reviewResponseSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) throw new NotFoundError("Review not found.");
  if (existing.profileId !== profile.id) {
    throw new ForbiddenError("You can only reply to reviews of your own profile.");
  }

  return prisma.review.update({
    where: { id: reviewId },
    data: { providerResponse: parsed.data.body, providerRespondedAt: new Date() },
    include: REVIEW_INCLUDE,
  });
}

/** Reviews written by the signed-in user, for their own account page. */
export async function listOwnReviews(userId: string | null | undefined) {
  const authorId = requireUserId(userId);
  return prisma.review.findMany({
    where: { authorId },
    orderBy: { createdAt: "desc" },
    include: {
      profile: { select: { slug: true, displayName: true, avatarUrl: true } },
    },
    take: 100,
  });
}

/** Reviews left on the caller's own profile, for the dashboard. */
export async function listReviewsForOwnProfile(userId: string | null | undefined) {
  const profile = await requireOwnedProfile(userId);
  const [reviews, summary] = await Promise.all([
    listReviews(profile.id),
    getRatingSummary(profile.id),
  ]);
  return { profile, reviews, summary };
}
