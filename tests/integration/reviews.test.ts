import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import {
  createReview,
  deleteReview,
  getOwnReview,
  getRatingSummary,
  listOwnReviews,
  listReviews,
  listReviewsForOwnProfile,
  respondToReview,
  updateReview,
} from "@/lib/services/reviews";
import { createPrintRequest, updateRequestStatus } from "@/lib/services/messaging";
import { parseSearchParams, searchProfiles } from "@/lib/services/search";
import { reviewSchema } from "@/lib/validation";
import { createProviderWithInventory, createUser } from "../setup/factories";

const validReview = (overrides: Record<string, unknown> = {}) => ({
  profileSlug: "review-shop",
  rating: 5,
  title: "Fantastic work",
  body: "Great quality and quick turnaround. Would absolutely use again.",
  ...overrides,
});

describe("reviewSchema", () => {
  it("accepts a valid review", () => {
    expect(reviewSchema.safeParse(validReview()).success).toBe(true);
  });

  it.each([0, 6, -1, 2.5])("rejects a rating of %s", (rating) => {
    expect(reviewSchema.safeParse(validReview({ rating })).success).toBe(false);
  });

  it("rejects a body that is too short", () => {
    expect(reviewSchema.safeParse(validReview({ body: "meh" })).success).toBe(false);
  });

  it("rejects a body over the limit", () => {
    expect(reviewSchema.safeParse(validReview({ body: "x".repeat(4001) })).success).toBe(false);
  });

  it("rejects unknown extra keys", () => {
    expect(reviewSchema.safeParse(validReview({ verified: true })).success).toBe(false);
  });

  it("coerces a numeric string rating from a form post", () => {
    const parsed = reviewSchema.parse(validReview({ rating: "4" }));
    expect(parsed.rating).toBe(4);
  });
});

describe("createReview", () => {
  it("creates a review and updates the profile aggregates", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();

    const review = await createReview(customer.id, validReview({ rating: 4 }));
    expect(review.rating).toBe(4);
    expect(review.authorId).toBe(customer.id);
    expect(review.verified).toBe(false);

    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: provider.profile.id } });
    expect(profile.ratingAverage).toBe(4);
    expect(profile.ratingCount).toBe(1);
  });

  it("averages multiple reviews", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    const first = await createUser();
    const second = await createUser();
    const third = await createUser();

    await createReview(first.id, validReview({ rating: 5 }));
    await createReview(second.id, validReview({ rating: 4 }));
    await createReview(third.id, validReview({ rating: 3 }));

    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: provider.profile.id } });
    expect(profile.ratingAverage).toBe(4);
    expect(profile.ratingCount).toBe(3);
  });

  it("marks a review verified when the author completed a request", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();

    const conversation = await createPrintRequest(customer.id, {
      profileSlug: "review-shop",
      title: "Bracket",
      description: "A small bracket",
    });
    await updateRequestStatus(provider.user.id, {
      requestId: conversation.request!.id,
      status: "COMPLETED",
    });

    const review = await createReview(customer.id, validReview());
    expect(review.verified).toBe(true);
  });

  it("does not mark a review verified for an unfinished request", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();

    await createPrintRequest(customer.id, {
      profileSlug: "review-shop",
      title: "Bracket",
      description: "A small bracket",
    });

    const review = await createReview(customer.id, validReview());
    expect(review.verified).toBe(false);
  });

  it("blocks reviewing your own profile", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    await expect(createReview(provider.user.id, validReview())).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("blocks a second review from the same person", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();

    await createReview(customer.id, validReview());
    await expect(createReview(customer.id, validReview({ rating: 1 }))).rejects.toBeInstanceOf(
      ConflictError,
    );

    expect(await prisma.review.count()).toBe(1);
  });

  it("blocks reviewing an unpublished profile", async () => {
    await createProviderWithInventory({ slug: "review-shop", published: false });
    const customer = await createUser();

    await expect(createReview(customer.id, validReview())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("requires authentication", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    await expect(createReview(null, validReview())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("stores script-like text verbatim for React to escape", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();
    const payload = '<script>alert("xss")</script> but otherwise a great print.';

    const review = await createReview(customer.id, validReview({ body: payload }));
    expect(review.body).toBe(payload);
  });
});

describe("updateReview and deleteReview", () => {
  async function seedReview() {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();
    const review = await createReview(customer.id, validReview({ rating: 2 }));
    return { provider, customer, review };
  }

  it("lets the author edit their own review and recomputes the average", async () => {
    const { provider, customer, review } = await seedReview();

    const updated = await updateReview(customer.id, review.id, {
      rating: 5,
      title: "Updated",
      body: "They fixed the issue immediately, upgrading my rating.",
    });
    expect(updated.rating).toBe(5);

    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: provider.profile.id } });
    expect(profile.ratingAverage).toBe(5);
  });

  it("blocks another user from editing someone else's review", async () => {
    const { review } = await seedReview();
    const stranger = await createUser();

    await expect(
      updateReview(stranger.id, review.id, {
        rating: 5,
        body: "Trying to rewrite someone else's review.",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks the maker from editing a review of their own shop", async () => {
    const { provider, review } = await seedReview();

    await expect(
      updateReview(provider.user.id, review.id, {
        rating: 5,
        body: "The owner should not be able to inflate their own rating.",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks the maker from deleting criticism", async () => {
    const { provider, review } = await seedReview();

    await expect(deleteReview(provider.user.id, review.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.review.count({ where: { id: review.id } })).toBe(1);
  });

  it("lets the author delete their review and resets the aggregates", async () => {
    const { provider, customer, review } = await seedReview();

    await deleteReview(customer.id, review.id);

    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: provider.profile.id } });
    expect(profile.ratingCount).toBe(0);
    expect(profile.ratingAverage).toBe(0);
  });
});

describe("respondToReview", () => {
  it("lets the maker post one public reply", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();
    const review = await createReview(customer.id, validReview());

    const updated = await respondToReview(provider.user.id, review.id, {
      body: "Thanks so much — glad it worked out!",
    });

    expect(updated.providerResponse).toBe("Thanks so much — glad it worked out!");
    expect(updated.providerRespondedAt).toBeInstanceOf(Date);
  });

  it("blocks a reply from a different maker", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    const other = await createProviderWithInventory({ slug: "other-shop" });
    const customer = await createUser();
    const review = await createReview(customer.id, validReview());

    await expect(
      respondToReview(other.user.id, review.id, { body: "Not my review to answer." }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks a reply from the review author", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();
    const review = await createReview(customer.id, validReview());

    await expect(
      respondToReview(customer.id, review.id, { body: "Replying to myself." }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects an empty reply", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();
    const review = await createReview(customer.id, validReview());

    await expect(
      respondToReview(provider.user.id, review.id, { body: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("reading reviews", () => {
  it("summarises the rating distribution", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    for (const rating of [5, 5, 3]) {
      const customer = await createUser();
      await createReview(customer.id, validReview({ rating }));
    }

    const summary = await getRatingSummary(provider.profile.id);
    expect(summary.count).toBe(3);
    expect(summary.average).toBeCloseTo(4.33, 2);
    expect(summary.breakdown[5]).toBe(2);
    expect(summary.breakdown[3]).toBe(1);
  });

  it("returns an empty summary for an unreviewed profile", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    const summary = await getRatingSummary(provider.profile.id);
    expect(summary).toMatchObject({ average: 0, count: 0 });
  });

  it("finds the viewer's own review", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();
    const stranger = await createUser();
    await createReview(customer.id, validReview());

    expect(await getOwnReview(provider.profile.id, customer.id)).not.toBeNull();
    expect(await getOwnReview(provider.profile.id, stranger.id)).toBeNull();
    expect(await getOwnReview(provider.profile.id, null)).toBeNull();
  });

  it("lists reviews newest first", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    const first = await createUser();
    const second = await createUser();
    await createReview(first.id, validReview({ title: "Older" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await createReview(second.id, validReview({ title: "Newer" }));

    const reviews = await listReviews(provider.profile.id);
    expect(reviews).toHaveLength(2);
    expect(reviews[0].author.id).toBe(second.id);
  });

  it("lists the caller's own reviews across makers", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    await createProviderWithInventory({ slug: "other-shop" });
    const customer = await createUser();

    await createReview(customer.id, validReview());
    await createReview(customer.id, validReview({ profileSlug: "other-shop" }));

    const mine = await listOwnReviews(customer.id);
    expect(mine).toHaveLength(2);
    expect(mine[0].profile.slug).toBeTruthy();
  });

  it("gives the maker their own dashboard view", async () => {
    const provider = await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();
    await createReview(customer.id, validReview());

    const result = await listReviewsForOwnProfile(provider.user.id);
    expect(result.reviews).toHaveLength(1);
    expect(result.summary.count).toBe(1);
    expect(result.profile.id).toBe(provider.profile.id);
  });

  it("refuses the dashboard view to a user without a profile", async () => {
    const user = await createUser();
    await expect(listReviewsForOwnProfile(user.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ratings in the directory", () => {
  it("filters by minimum rating", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    await createProviderWithInventory({ slug: "other-shop" });

    const happy = await createUser();
    const unhappy = await createUser();
    await createReview(happy.id, validReview({ rating: 5 }));
    await createReview(unhappy.id, validReview({ profileSlug: "other-shop", rating: 2 }));

    const result = await searchProfiles(parseSearchParams({ minRating: "4", perPage: 48 }));
    expect(result.items.map((item) => item.slug)).toEqual(["review-shop"]);
  });

  it("sorts by rating when asked", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    await createProviderWithInventory({ slug: "other-shop" });

    const happy = await createUser();
    const meh = await createUser();
    await createReview(happy.id, validReview({ rating: 5 }));
    await createReview(meh.id, validReview({ profileSlug: "other-shop", rating: 3 }));

    const result = await searchProfiles(parseSearchParams({ sort: "rating", perPage: 48 }));
    expect(result.items[0].slug).toBe("review-shop");
  });

  it("ignores an out-of-range minRating instead of throwing", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    const params = parseSearchParams({ minRating: "99" });
    expect(params.minRating).toBeUndefined();

    const result = await searchProfiles(params);
    expect(result.items).toHaveLength(1);
  });

  it("exposes rating fields on directory cards", async () => {
    await createProviderWithInventory({ slug: "review-shop" });
    const customer = await createUser();
    await createReview(customer.id, validReview({ rating: 4 }));

    const result = await searchProfiles(parseSearchParams({}));
    expect(result.items[0].ratingAverage).toBe(4);
    expect(result.items[0].ratingCount).toBe(1);
  });
});
