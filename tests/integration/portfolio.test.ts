import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/constants";
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import {
  createPortfolioItem,
  deletePortfolioItem,
  listPortfolio,
  listPublicPortfolio,
  updatePortfolioItem,
} from "@/lib/services/portfolio";
import { portfolioItemSchema } from "@/lib/validation";
import { createProviderWithInventory, createUser } from "../setup/factories";

const validItem = (overrides: Record<string, unknown> = {}) => ({
  title: "Articulated dragon",
  imageUrl: "https://images.example.com/dragon.jpg",
  featured: false,
  sortOrder: 0,
  ...overrides,
});

describe("portfolioItemSchema", () => {
  it("accepts a minimal item", () => {
    expect(portfolioItemSchema.safeParse(validItem()).success).toBe(true);
  });

  it("requires a title", () => {
    expect(portfolioItemSchema.safeParse(validItem({ title: "   " })).success).toBe(false);
  });

  it("requires an image URL", () => {
    expect(portfolioItemSchema.safeParse(validItem({ imageUrl: "" })).success).toBe(false);
  });

  it("rejects a javascript: image URL", () => {
     
    expect(portfolioItemSchema.safeParse(validItem({ imageUrl: "javascript:alert(1)" })).success).toBe(
      false,
    );
  });

  it("rejects a data: image URL", () => {
    expect(
      portfolioItemSchema.safeParse(
        validItem({ imageUrl: "data:image/svg+xml,<svg onload=alert(1)>" }),
      ).success,
    ).toBe(false);
  });

  it("rejects a title over the limit", () => {
    expect(
      portfolioItemSchema.safeParse(validItem({ title: "x".repeat(LIMITS.portfolioTitle + 1) }))
        .success,
    ).toBe(false);
  });

  it("rejects unknown extra keys", () => {
    expect(portfolioItemSchema.safeParse(validItem({ profileId: "victim" })).success).toBe(false);
  });

  it("accepts an http image URL", () => {
    expect(
      portfolioItemSchema.safeParse(validItem({ imageUrl: "http://images.example.com/a.png" }))
        .success,
    ).toBe(true);
  });
});

describe("portfolio service", () => {
  it("creates an item on the caller's own profile", async () => {
    const { user, profile } = await createProviderWithInventory();
    const item = await createPortfolioItem(user.id, validItem());

    expect(item.profileId).toBe(profile.id);
    expect(item.title).toBe("Articulated dragon");
  });

  it("links an item to one of the owner's machines", async () => {
    const { user, machine } = await createProviderWithInventory();
    const item = await createPortfolioItem(user.id, validItem({ machineId: machine.id }));
    expect(item.machineId).toBe(machine.id);
    expect(item.machine?.model).toBe("X1 Carbon");
  });

  it("rejects a machine belonging to another provider", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();

    await expect(
      createPortfolioItem(attacker.user.id, validItem({ machineId: victim.machine.id })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("requires a profile", async () => {
    const user = await createUser();
    await expect(createPortfolioItem(user.id, validItem())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("requires authentication", async () => {
    await expect(createPortfolioItem(null, validItem())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("blocks editing another provider's item", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();
    const item = await createPortfolioItem(victim.user.id, validItem());

    await expect(
      updatePortfolioItem(attacker.user.id, item.id, validItem({ title: "Hijacked" })),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const unchanged = await prisma.portfolioItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(unchanged.title).toBe("Articulated dragon");
  });

  it("blocks deleting another provider's item", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();
    const item = await createPortfolioItem(victim.user.id, validItem());

    await expect(deletePortfolioItem(attacker.user.id, item.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await prisma.portfolioItem.count({ where: { id: item.id } })).toBe(1);
  });

  it("lets the owner delete their own item", async () => {
    const { user } = await createProviderWithInventory();
    const item = await createPortfolioItem(user.id, validItem());
    await deletePortfolioItem(user.id, item.id);
    expect(await prisma.portfolioItem.count({ where: { id: item.id } })).toBe(0);
  });

  it("enforces the per-profile item cap", async () => {
    const { user, profile } = await createProviderWithInventory();
    await prisma.portfolioItem.createMany({
      data: Array.from({ length: LIMITS.portfolioMax }, (_, index) => ({
        profileId: profile.id,
        title: `Item ${index}`,
        imageUrl: `https://images.example.com/${index}.jpg`,
      })),
    });

    await expect(createPortfolioItem(user.id, validItem())).rejects.toBeInstanceOf(ValidationError);
  });

  it("orders featured items first", async () => {
    const { user, profile } = await createProviderWithInventory();
    await createPortfolioItem(user.id, validItem({ title: "Plain", sortOrder: 0 }));
    await createPortfolioItem(user.id, validItem({ title: "Starred", featured: true, sortOrder: 5 }));

    const items = await listPortfolio(profile.id);
    expect(items[0].title).toBe("Starred");
  });

  it("limits the public listing", async () => {
    const { user, profile } = await createProviderWithInventory();
    await createPortfolioItem(user.id, validItem({ title: "One" }));
    await createPortfolioItem(user.id, validItem({ title: "Two" }));

    const items = await listPublicPortfolio(profile.id, 1);
    expect(items).toHaveLength(1);
  });

  it("cascades when the profile is deleted", async () => {
    const { user, profile } = await createProviderWithInventory();
    await createPortfolioItem(user.id, validItem());

    await prisma.profile.delete({ where: { id: profile.id } });
    expect(await prisma.portfolioItem.count({ where: { profileId: profile.id } })).toBe(0);
  });

  it("keeps the item when its machine is deleted", async () => {
    const { user, machine } = await createProviderWithInventory();
    const item = await createPortfolioItem(user.id, validItem({ machineId: machine.id }));

    await prisma.machine.delete({ where: { id: machine.id } });
    const after = await prisma.portfolioItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.machineId).toBeNull();
  });
});
