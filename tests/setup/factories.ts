import { prisma } from "@/lib/db";
import type { ProfileType } from "@/lib/constants";

let counter = 0;
function next(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createUser(overrides: Partial<{ name: string; email: string }> = {}) {
  const handle = next("user");
  return prisma.user.create({
    data: {
      name: overrides.name ?? `Test ${handle}`,
      email: overrides.email ?? `${handle}@example.com`,
    },
  });
}

export async function createProfile(
  userId: string,
  overrides: Partial<{
    type: ProfileType;
    slug: string;
    displayName: string;
    city: string;
    published: boolean;
    acceptingRequests: boolean;
    offersShipping: boolean;
  }> = {},
) {
  return prisma.profile.create({
    data: {
      userId,
      type: overrides.type ?? "INDIVIDUAL",
      slug: overrides.slug ?? next("handle"),
      displayName: overrides.displayName ?? "Test Maker",
      city: overrides.city ?? "Austin",
      region: "TX",
      country: "US",
      published: overrides.published ?? true,
      acceptingRequests: overrides.acceptingRequests ?? true,
      offersShipping: overrides.offersShipping ?? false,
      offersLocalPickup: true,
    },
  });
}

/** Creates a published provider with one machine and one material. */
export async function createProviderWithInventory(
  overrides: Parameters<typeof createProfile>[1] = {},
) {
  const user = await createUser();
  const profile = await createProfile(user.id, overrides);
  const machine = await prisma.machine.create({
    data: {
      profileId: profile.id,
      category: "FDM_3D_PRINTER",
      make: "Bambu Lab",
      model: "X1 Carbon",
      buildVolume: "256 x 256 x 256 mm",
      quantity: 1,
    },
  });
  const material = await prisma.material.create({
    data: {
      profileId: profile.id,
      category: "FILAMENT",
      name: "PLA",
      unit: "KG",
      pricePerUnit: 24.5,
      inStock: true,
    },
  });
  return { user, profile, machine, material };
}

export function futureDate(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

export const validProfileInput = (overrides: Record<string, unknown> = {}) => ({
  type: "INDIVIDUAL",
  displayName: "Ada's Print Shop",
  slug: next("ada"),
  city: "Austin",
  region: "TX",
  country: "US",
  offersShipping: true,
  offersLocalPickup: true,
  canCustomOrderMaterials: false,
  acceptingRequests: true,
  published: true,
  ...overrides,
});

export const validMachineInput = (overrides: Record<string, unknown> = {}) => ({
  category: "FDM_3D_PRINTER",
  make: "Prusa Research",
  model: "MK4S",
  isCustom: false,
  quantity: 1,
  isOperational: true,
  ...overrides,
});

export const validMaterialInput = (overrides: Record<string, unknown> = {}) => ({
  category: "FILAMENT",
  name: "PETG",
  unit: "KG",
  pricePerUnit: 28,
  currency: "USD",
  inStock: true,
  canCustomOrder: false,
  ...overrides,
});
