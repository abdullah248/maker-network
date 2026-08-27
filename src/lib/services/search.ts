import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { searchParamsSchema, type SearchParams } from "@/lib/validation";

export type DirectoryCard = Prisma.ProfileGetPayload<{
  select: {
    id: true;
    slug: true;
    type: true;
    displayName: true;
    headline: true;
    city: true;
    region: true;
    country: true;
    avatarUrl: true;
    offersShipping: true;
    offersLocalPickup: true;
    canCustomOrderMaterials: true;
    requiresAppointment: true;
    requiresMembership: true;
    requiresLibraryCard: true;
    acceptingRequests: true;
    machines: { select: { id: true; category: true; make: true; model: true } };
    materials: { select: { id: true; category: true; name: true; pricePerUnit: true; unit: true } };
  };
}>;

export type DirectoryResult = {
  items: DirectoryCard[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

const CARD_SELECT = {
  id: true,
  slug: true,
  type: true,
  displayName: true,
  headline: true,
  city: true,
  region: true,
  country: true,
  avatarUrl: true,
  offersShipping: true,
  offersLocalPickup: true,
  canCustomOrderMaterials: true,
  requiresAppointment: true,
  requiresMembership: true,
  requiresLibraryCard: true,
  acceptingRequests: true,
  machines: { select: { id: true, category: true, make: true, model: true } },
  materials: {
    select: { id: true, category: true, name: true, pricePerUnit: true, unit: true },
  },
} satisfies Prisma.ProfileSelect;

/**
 * Parses raw query-string values into a validated {@link SearchParams}.
 * Invalid values fall back to defaults rather than throwing, so a hand-crafted
 * URL can never 500 the directory.
 */
export function parseSearchParams(raw: Record<string, unknown>): SearchParams {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null || value === "") continue;
    cleaned[key] = Array.isArray(value) ? value[0] : value;
  }

  const parsed = searchParamsSchema.safeParse(cleaned);
  if (parsed.success) return parsed.data;

  // Retry field-by-field so one bad filter doesn't discard the rest.
  const salvaged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cleaned)) {
    const attempt = searchParamsSchema.safeParse({ ...salvaged, [key]: value });
    if (attempt.success) salvaged[key] = value;
  }
  const fallback = searchParamsSchema.safeParse(salvaged);
  return fallback.success ? fallback.data : searchParamsSchema.parse({});
}

export async function searchProfiles(params: SearchParams): Promise<DirectoryResult> {
  const where: Prisma.ProfileWhereInput = { published: true };
  const and: Prisma.ProfileWhereInput[] = [];

  if (params.type) and.push({ type: params.type });
  if (params.city) and.push({ city: { contains: params.city } });
  if (params.shipping) and.push({ offersShipping: true });
  if (params.acceptingOnly) and.push({ acceptingRequests: true });
  if (params.category) and.push({ machines: { some: { category: params.category } } });
  if (params.material) and.push({ materials: { some: { category: params.material } } });

  if (params.q) {
    const q = params.q;
    and.push({
      OR: [
        { displayName: { contains: q } },
        { headline: { contains: q } },
        { bio: { contains: q } },
        { city: { contains: q } },
        { machines: { some: { OR: [{ make: { contains: q } }, { model: { contains: q } }] } } },
        { materials: { some: { OR: [{ name: { contains: q } }, { brand: { contains: q } }] } } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;

  const [total, items] = await Promise.all([
    prisma.profile.count({ where }),
    prisma.profile.findMany({
      where,
      select: CARD_SELECT,
      orderBy: [{ acceptingRequests: "desc" }, { updatedAt: "desc" }],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
    }),
  ]);

  return {
    items,
    total,
    page: params.page,
    perPage: params.perPage,
    pageCount: Math.max(1, Math.ceil(total / params.perPage)),
  };
}

/** Distinct cities with at least one published profile, for filter chips. */
export async function popularCities(limit = 12) {
  const rows = await prisma.profile.groupBy({
    by: ["city"],
    where: { published: true },
    _count: { city: true },
    orderBy: { _count: { city: "desc" } },
    take: limit,
  });
  return rows.map((row) => ({ city: row.city, count: row._count.city }));
}

export async function directoryStats() {
  const [profiles, machines, materials] = await Promise.all([
    prisma.profile.count({ where: { published: true } }),
    prisma.machine.count({ where: { profile: { published: true } } }),
    prisma.material.count({ where: { profile: { published: true }, inStock: true } }),
  ]);
  return { profiles, machines, materials };
}
