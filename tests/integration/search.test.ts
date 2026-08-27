import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  directoryStats,
  parseSearchParams,
  popularCities,
  searchProfiles,
} from "@/lib/services/search";
import { createProviderWithInventory } from "../setup/factories";

async function seedDirectory() {
  const library = await createProviderWithInventory({
    type: "MAKERSPACE",
    slug: "cedar-park-library",
    displayName: "Cedar Park Public Library",
    city: "Cedar Park",
  });
  await prisma.machine.create({
    data: {
      profileId: library.profile.id,
      category: "LASER_CUTTER",
      make: "Epilog",
      model: "Fusion Pro 36",
    },
  });
  await prisma.material.create({
    data: {
      profileId: library.profile.id,
      category: "SHEET_WOOD",
      name: "Baltic birch plywood",
      unit: "SHEET",
      pricePerUnit: 6.5,
    },
  });

  const shipper = await createProviderWithInventory({
    slug: "ada-prints",
    displayName: "Ada's Print Bench",
    city: "Austin",
    offersShipping: true,
  });

  const paused = await createProviderWithInventory({
    slug: "paused-maker",
    displayName: "On Hiatus Makes",
    city: "Austin",
    acceptingRequests: false,
  });

  const draft = await createProviderWithInventory({
    slug: "secret-lab",
    displayName: "Secret Lab",
    city: "Austin",
    published: false,
  });

  return { library, shipper, paused, draft };
}

describe("parseSearchParams", () => {
  it("applies defaults for an empty query", () => {
    const params = parseSearchParams({});
    expect(params).toMatchObject({ page: 1, perPage: 12 });
  });

  it("keeps valid filters", () => {
    const params = parseSearchParams({ type: "MAKERSPACE", category: "LASER_CUTTER", page: "2" });
    expect(params.type).toBe("MAKERSPACE");
    expect(params.category).toBe("LASER_CUTTER");
    expect(params.page).toBe(2);
  });

  it("discards a bad filter but keeps the good ones", () => {
    const params = parseSearchParams({ type: "MAKERSPACE", category: "NONSENSE" });
    expect(params.type).toBe("MAKERSPACE");
    expect(params.category).toBeUndefined();
  });

  it("survives hostile input without throwing", () => {
    const params = parseSearchParams({
      q: "'; DROP TABLE Profile; --",
      page: "-999999",
      perPage: "1e99",
      type: ["MAKERSPACE", "INDIVIDUAL"],
      city: "x".repeat(5000),
    });
    expect(params.page).toBeGreaterThanOrEqual(1);
    expect(params.perPage).toBeLessThanOrEqual(48);
  });

  it("ignores empty string values", () => {
    const params = parseSearchParams({ q: "", city: "", type: "" });
    expect(params.q).toBeUndefined();
    expect(params.city).toBeUndefined();
    expect(params.type).toBeUndefined();
  });
});

describe("searchProfiles", () => {
  it("only returns published profiles", async () => {
    await seedDirectory();
    const result = await searchProfiles(parseSearchParams({ perPage: 48 }));

    expect(result.items).toHaveLength(3);
    expect(result.items.map((item) => item.slug)).not.toContain("secret-lab");
  });

  it("filters by profile type", async () => {
    await seedDirectory();
    const result = await searchProfiles(parseSearchParams({ type: "MAKERSPACE" }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].slug).toBe("cedar-park-library");
  });

  it("filters by machine category", async () => {
    await seedDirectory();
    const result = await searchProfiles(parseSearchParams({ category: "LASER_CUTTER" }));
    expect(result.items.map((item) => item.slug)).toEqual(["cedar-park-library"]);
  });

  it("filters by material category", async () => {
    await seedDirectory();
    const result = await searchProfiles(parseSearchParams({ material: "SHEET_WOOD" }));
    expect(result.items.map((item) => item.slug)).toEqual(["cedar-park-library"]);
  });

  it("filters by shipping availability", async () => {
    await seedDirectory();
    const result = await searchProfiles(parseSearchParams({ shipping: "true" }));
    expect(result.items.map((item) => item.slug)).toEqual(["ada-prints"]);
  });

  it("filters to profiles accepting requests", async () => {
    await seedDirectory();
    const result = await searchProfiles(parseSearchParams({ acceptingOnly: "true", perPage: 48 }));
    expect(result.items.map((item) => item.slug)).not.toContain("paused-maker");
  });

  it("filters by city", async () => {
    await seedDirectory();
    const result = await searchProfiles(parseSearchParams({ city: "Cedar", perPage: 48 }));
    expect(result.items.map((item) => item.slug)).toEqual(["cedar-park-library"]);
  });

  it("searches display names, machines and materials", async () => {
    await seedDirectory();

    const byName = await searchProfiles(parseSearchParams({ q: "Ada" }));
    expect(byName.items.map((item) => item.slug)).toContain("ada-prints");

    const byMachine = await searchProfiles(parseSearchParams({ q: "Epilog", perPage: 48 }));
    expect(byMachine.items.map((item) => item.slug)).toContain("cedar-park-library");

    const byMaterial = await searchProfiles(parseSearchParams({ q: "plywood", perPage: 48 }));
    expect(byMaterial.items.map((item) => item.slug)).toContain("cedar-park-library");
  });

  it("treats SQL metacharacters as literal text", async () => {
    await seedDirectory();
    const result = await searchProfiles(parseSearchParams({ q: "' OR '1'='1" }));
    expect(result.items).toHaveLength(0);
    expect(await prisma.profile.count()).toBe(4);
  });

  it("paginates", async () => {
    await seedDirectory();
    const first = await searchProfiles(parseSearchParams({ perPage: "2", page: "1" }));
    const second = await searchProfiles(parseSearchParams({ perPage: "2", page: "2" }));

    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(1);
    expect(first.total).toBe(3);
    expect(first.pageCount).toBe(2);
  });

  it("returns an empty page beyond the end without error", async () => {
    await seedDirectory();
    const result = await searchProfiles(parseSearchParams({ page: "99" }));
    expect(result.items).toHaveLength(0);
  });
});

describe("directory aggregates", () => {
  it("counts only published inventory", async () => {
    await seedDirectory();
    const stats = await directoryStats();
    expect(stats.profiles).toBe(3);
    expect(stats.machines).toBeGreaterThanOrEqual(4);
    expect(stats.materials).toBeGreaterThanOrEqual(4);
  });

  it("lists popular cities", async () => {
    await seedDirectory();
    const cities = await popularCities();
    const austin = cities.find((entry) => entry.city === "Austin");
    expect(austin?.count).toBe(2);
  });
});
