/**
 * Adversarial coverage for the project gallery and reviews. These model abuse
 * that is specific to user-generated images and public reputation.
 */
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createPortfolioItem,
  deletePortfolioItem,
  updatePortfolioItem,
} from "@/lib/services/portfolio";
import {
  createReview,
  deleteReview,
  getRatingSummary,
  respondToReview,
  updateReview,
} from "@/lib/services/reviews";
import { createProviderWithInventory, createUser } from "../setup/factories";

const item = (overrides: Record<string, unknown> = {}) => ({
  title: "A print",
  imageUrl: "https://images.example.com/a.jpg",
  ...overrides,
});

const review = (overrides: Record<string, unknown> = {}) => ({
  profileSlug: "target-shop",
  rating: 5,
  body: "A perfectly ordinary review body that is long enough.",
  ...overrides,
});

describe("gallery abuse", () => {
  it.each([
    ["javascript", "javascript:alert(document.cookie)"],
    ["data URI", "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+"],
    ["vbscript", "vbscript:msgbox(1)"],
    ["file", "file:///etc/passwd"],
    ["relative path", "/etc/passwd"],
    ["protocol relative", "//evil.example/x.jpg"],
  ])("rejects a %s image URL", async (_label, imageUrl) => {
    const { user } = await createProviderWithInventory();
    await expect(createPortfolioItem(user.id, item({ imageUrl }))).rejects.toThrow();
    expect(await prisma.portfolioItem.count()).toBe(0);
  });

  it("rejects an image URL that is absurdly long", async () => {
    const { user } = await createProviderWithInventory();
    const imageUrl = `https://images.example.com/${"a".repeat(4000)}.jpg`;
    await expect(createPortfolioItem(user.id, item({ imageUrl }))).rejects.toThrow();
  });

  it("stores HTML in a caption verbatim so React escapes it", async () => {
    const { user } = await createProviderWithInventory();
    const payload = '<img src=x onerror="alert(1)">';
    const created = await createPortfolioItem(user.id, item({ description: payload }));
    expect(created.description).toBe(payload);
  });

  it("keeps a forged profileId from redirecting the item", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();

    await expect(
      createPortfolioItem(attacker.user.id, item({ profileId: victim.profile.id })),
    ).rejects.toThrow();
    expect(await prisma.portfolioItem.count({ where: { profileId: victim.profile.id } })).toBe(0);
  });

  it("prevents cross-tenant edits and deletes", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();
    const created = await createPortfolioItem(victim.user.id, item());

    await expect(
      updatePortfolioItem(attacker.user.id, created.id, item({ title: "Defaced" })),
    ).rejects.toThrow();
    await expect(deletePortfolioItem(attacker.user.id, created.id)).rejects.toThrow();

    const after = await prisma.portfolioItem.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.title).toBe("A print");
  });
});

describe("review manipulation", () => {
  it("stops a maker inflating their own rating", async () => {
    const provider = await createProviderWithInventory({ slug: "target-shop" });
    await expect(createReview(provider.user.id, review())).rejects.toThrow();
    expect(await prisma.review.count()).toBe(0);
  });

  it("stops a maker deleting a bad review", async () => {
    const provider = await createProviderWithInventory({ slug: "target-shop" });
    const critic = await createUser();
    const bad = await createReview(critic.id, review({ rating: 1 }));

    await expect(deleteReview(provider.user.id, bad.id)).rejects.toThrow();

    const summary = await getRatingSummary(provider.profile.id);
    expect(summary.count).toBe(1);
    expect(summary.average).toBe(1);
  });

  it("stops a maker rewriting a bad review", async () => {
    const provider = await createProviderWithInventory({ slug: "target-shop" });
    const critic = await createUser();
    const bad = await createReview(critic.id, review({ rating: 1 }));

    await expect(
      updateReview(provider.user.id, bad.id, {
        rating: 5,
        body: "Actually this shop is wonderful, says the shop.",
      }),
    ).rejects.toThrow();

    const unchanged = await prisma.review.findUniqueOrThrow({ where: { id: bad.id } });
    expect(unchanged.rating).toBe(1);
  });

  it("stops one person stuffing the ballot with repeat reviews", async () => {
    const provider = await createProviderWithInventory({ slug: "target-shop" });
    const fan = await createUser();

    await createReview(fan.id, review({ rating: 5 }));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(createReview(fan.id, review({ rating: 5 }))).rejects.toThrow();
    }

    const summary = await getRatingSummary(provider.profile.id);
    expect(summary.count).toBe(1);
  });

  it("cannot forge the verified badge through the payload", async () => {
    await createProviderWithInventory({ slug: "target-shop" });
    const customer = await createUser();

    await expect(createReview(customer.id, review({ verified: true }))).rejects.toThrow();

    // Without the extra key the review is created, but unverified.
    const created = await createReview(customer.id, review());
    expect(created.verified).toBe(false);
  });

  it("cannot forge a provider response through the payload", async () => {
    await createProviderWithInventory({ slug: "target-shop" });
    const customer = await createUser();

    await expect(
      createReview(customer.id, review({ providerResponse: "We love this customer" })),
    ).rejects.toThrow();
  });

  it("stops a stranger replying on behalf of a maker", async () => {
    await createProviderWithInventory({ slug: "target-shop" });
    const customer = await createUser();
    const stranger = await createUser();
    const created = await createReview(customer.id, review());

    await expect(
      respondToReview(stranger.id, created.id, { body: "Speaking for a shop I do not own." }),
    ).rejects.toThrow();
  });

  it("keeps aggregates consistent after a churn of writes", async () => {
    const provider = await createProviderWithInventory({ slug: "target-shop" });

    const authors = await Promise.all([createUser(), createUser(), createUser()]);
    const created = [];
    for (const [index, author] of authors.entries()) {
      created.push(await createReview(author.id, review({ rating: index + 3 })));
    }

    await updateReview(authors[0].id, created[0].id, {
      rating: 1,
      body: "Changed my mind after a second order.",
    });
    await deleteReview(authors[2].id, created[2].id);

    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: provider.profile.id } });
    const summary = await getRatingSummary(provider.profile.id);

    // Remaining ratings are 1 and 4.
    expect(summary.count).toBe(2);
    expect(summary.average).toBe(2.5);
    expect(profile.ratingCount).toBe(summary.count);
    expect(profile.ratingAverage).toBe(summary.average);
  });

  it("rejects a rating outside the one-to-five range", async () => {
    await createProviderWithInventory({ slug: "target-shop" });
    const customer = await createUser();

    for (const rating of [0, 6, 99, -3, 4.5]) {
      await expect(createReview(customer.id, review({ rating }))).rejects.toThrow();
    }
    expect(await prisma.review.count()).toBe(0);
  });

  it("removes reviews when the reviewer's account is deleted", async () => {
    const provider = await createProviderWithInventory({ slug: "target-shop" });
    const customer = await createUser();
    await createReview(customer.id, review());

    await prisma.user.delete({ where: { id: customer.id } });
    expect(await prisma.review.count({ where: { profileId: provider.profile.id } })).toBe(0);
  });
});
