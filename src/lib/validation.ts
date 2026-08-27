import { z } from "zod";

import {
  ACCOUNT_TYPES,
  FULFILLMENT_OPTIONS,
  LIMITS,
  MACHINE_CATEGORIES,
  MATERIAL_CATEGORIES,
  MATERIAL_UNITS,
  PROFILE_TYPES,
  REQUEST_STATUSES,
  SLOT_STATUSES,
} from "@/lib/constants";

/** Collapses whitespace and strips control characters from user input. */
export function sanitizeText(value: string): string {
  return value
     
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
}

const trimmed = (max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(z.string().min(1, "This field is required.").max(max));

/** Normalises blank/absent values to `undefined` before validation. */
function blankToUndefined(value: unknown, lowercase = false): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = sanitizeText(value);
  if (cleaned.length === 0) return undefined;
  return lowercase ? cleaned.toLowerCase() : cleaned;
}

const optionalTrimmed = (max: number) =>
  z.preprocess((value) => blankToUndefined(value), z.string().max(max).optional());

/** Only http(s) URLs are accepted; javascript:/data: payloads are rejected. */
const safeUrl = z.preprocess(
  (value) => blankToUndefined(value),
  z
    .string()
    .max(2048)
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "Enter a valid http(s) URL." },
    )
    .optional(),
);

const optionalEmail = z.preprocess(
  (value) => blankToUndefined(value, true),
  z
    .string()
    .max(254)
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Enter a valid email address.",
    })
    .optional(),
);

const optionalPhone = z.preprocess(
  (value) => blankToUndefined(value),
  z
    .string()
    .refine((value) => /^[+()\-.\s\d]{7,25}$/.test(value), {
      message: "Enter a valid phone number.",
    })
    .optional(),
);

const money = z.coerce
  .number()
  .min(0, "Price cannot be negative.")
  .max(1_000_000, "That price looks unrealistic.")
  .refine((value) => Number.isFinite(value), { message: "Enter a valid number." });

const optionalMoney = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    return value;
  },
  z.coerce.number().min(0, "Price cannot be negative.").max(1_000_000).optional(),
);

const checkbox = z.preprocess(
  (value) => value === true || value === "true" || value === "on" || value === "1",
  z.boolean(),
);

export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "browse",
  "dashboard",
  "messages",
  "signin",
  "signout",
  "onboarding",
  "settings",
  "new",
  "p",
  "requests",
  "_next",
  "static",
  "public",
]);

export const slugSchema = z
  .string()
  .transform((value) => sanitizeText(value).toLowerCase())
  .pipe(
    z
      .string()
      .min(3, "Handles need at least 3 characters.")
      .max(LIMITS.slug)
      .regex(
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
        "Use lowercase letters, numbers and hyphens only.",
      ),
  )
  .refine((value) => !RESERVED_SLUGS.has(value), { message: "That handle is reserved." });

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export const profileTypeSchema = z.enum(PROFILE_TYPES);

export const onboardingSchema = z.object({
  accountType: accountTypeSchema,
});

const profileBaseShape = {
  displayName: trimmed(LIMITS.displayName),
  slug: slugSchema,
  headline: optionalTrimmed(LIMITS.headline),
  bio: optionalTrimmed(LIMITS.bio),
  city: trimmed(80),
  region: optionalTrimmed(80),
  country: z
    .string()
    .transform((value) => sanitizeText(value).toUpperCase())
    .pipe(z.string().length(2, "Use a 2-letter country code."))
    .default("US"),
  postalCode: optionalTrimmed(12),
  websiteUrl: safeUrl,
  contactEmail: optionalEmail,
  phone: optionalPhone,
  avatarUrl: safeUrl,
  acceptingRequests: checkbox,
  published: checkbox,
};

export const makerspaceProfileSchema = z.object({
  ...profileBaseShape,
  type: z.literal("MAKERSPACE"),
  requiresAppointment: checkbox,
  requiresMembership: checkbox,
  requiresLibraryCard: checkbox,
  membershipDetails: optionalTrimmed(LIMITS.notes),
  accessNotes: optionalTrimmed(LIMITS.notes),
});

export const individualProfileSchema = z.object({
  ...profileBaseShape,
  type: z.literal("INDIVIDUAL"),
  offersShipping: checkbox,
  offersLocalPickup: checkbox,
  canCustomOrderMaterials: checkbox,
  customOrderNotes: optionalTrimmed(LIMITS.notes),
});

export const profileInputSchema = z
  .discriminatedUnion("type", [makerspaceProfileSchema, individualProfileSchema])
  .refine(
    (data) => data.type !== "INDIVIDUAL" || data.offersShipping || data.offersLocalPickup,
    {
      message: "Choose at least one fulfilment option (shipping or local pickup).",
      path: ["offersLocalPickup"],
    },
  );

export type ProfileInput = z.infer<typeof profileInputSchema>;

export const machineInputSchema = z
  .object({
    category: z.enum(MACHINE_CATEGORIES),
    make: trimmed(60),
    model: trimmed(80),
    isCustom: checkbox,
    nickname: optionalTrimmed(60),
    buildVolume: optionalTrimmed(80),
    quantity: z.coerce.number().int().min(1, "At least one machine.").max(500),
    hourlyRate: optionalMoney,
    perJobFee: optionalMoney,
    notes: optionalTrimmed(LIMITS.notes),
    isOperational: checkbox,
  })
  .strict();

export type MachineInput = z.infer<typeof machineInputSchema>;

export const materialInputSchema = z
  .object({
    category: z.enum(MATERIAL_CATEGORIES),
    name: trimmed(80),
    brand: optionalTrimmed(60),
    colors: optionalTrimmed(200),
    specs: optionalTrimmed(500),
    unit: z.enum(MATERIAL_UNITS),
    pricePerUnit: money,
    currency: z
      .string()
      .transform((value) => sanitizeText(value).toUpperCase())
      .pipe(z.string().length(3))
      .default("USD"),
    stockQuantity: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.number().int().min(0).max(1_000_000).optional(),
    ),
    inStock: checkbox,
    canCustomOrder: checkbox,
    customOrderLeadDays: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.number().int().min(0).max(365).optional(),
    ),
    notes: optionalTrimmed(LIMITS.notes),
  })
  .strict();

export type MaterialInput = z.infer<typeof materialInputSchema>;

export const operatingHoursEntrySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    opensAt: z.coerce.number().int().min(0).max(1440),
    closesAt: z.coerce.number().int().min(0).max(1440),
    isClosed: checkbox,
    note: optionalTrimmed(200),
  })
  .refine((data) => data.isClosed || data.closesAt > data.opensAt, {
    message: "Closing time must be after opening time.",
    path: ["closesAt"],
  });

export const operatingHoursSchema = z
  .array(operatingHoursEntrySchema)
  .max(7)
  .refine(
    (entries) => new Set(entries.map((entry) => entry.dayOfWeek)).size === entries.length,
    { message: "Each weekday can only appear once." },
  );

export type OperatingHoursInput = z.infer<typeof operatingHoursSchema>;

const isoDate = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(sanitizeText(value))))
  .refine((value) => !Number.isNaN(value.getTime()), { message: "Enter a valid date and time." });

export const availabilitySlotSchema = z
  .object({
    machineId: optionalTrimmed(40),
    startsAt: isoDate,
    endsAt: isoDate,
    status: z.enum(SLOT_STATUSES).default("OPEN"),
    capacity: z.coerce.number().int().min(1).max(100).default(1),
    note: optionalTrimmed(200),
  })
  .strict()
  .refine((data) => data.endsAt.getTime() > data.startsAt.getTime(), {
    message: "The slot must end after it starts.",
    path: ["endsAt"],
  })
  .refine(
    (data) => data.endsAt.getTime() - data.startsAt.getTime() <= 1000 * 60 * 60 * 24 * 14,
    { message: "Slots cannot be longer than 14 days.", path: ["endsAt"] },
  );

export type AvailabilitySlotInput = z.infer<typeof availabilitySlotSchema>;

export const messageBodySchema = z
  .string()
  .transform(sanitizeText)
  .pipe(
    z
      .string()
      .min(1, "Write a message before sending.")
      .max(LIMITS.messageBody, `Messages are limited to ${LIMITS.messageBody} characters.`),
  );

export const startConversationSchema = z
  .object({
    profileSlug: z
      .string()
      .transform((value) => sanitizeText(value).toLowerCase())
      .pipe(z.string().min(1).max(LIMITS.slug)),
    subject: trimmed(120),
    message: messageBodySchema,
  })
  .strict();

export const sendMessageSchema = z
  .object({
    conversationId: trimmed(40),
    body: messageBodySchema,
  })
  .strict();

export const printRequestSchema = z
  .object({
    profileSlug: z
      .string()
      .transform((value) => sanitizeText(value).toLowerCase())
      .pipe(z.string().min(1).max(LIMITS.slug)),
    title: trimmed(120),
    description: trimmed(4000),
    machineId: optionalTrimmed(40),
    materialId: optionalTrimmed(40),
    quantity: z.coerce.number().int().min(1).max(10_000).default(1),
    fulfillment: z.enum(FULFILLMENT_OPTIONS).default("PICKUP"),
    budget: optionalMoney,
    deadline: z.preprocess((value) => {
      if (value === null || value === undefined || value === "") return undefined;
      const parsed = value instanceof Date ? value : new Date(sanitizeText(String(value)));
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }, z.date().optional()),
    fileUrl: safeUrl,
  })
  .strict();

export type PrintRequestInput = z.infer<typeof printRequestSchema>;

export const requestStatusSchema = z.object({
  requestId: trimmed(40),
  status: z.enum(REQUEST_STATUSES),
});

export const searchParamsSchema = z.object({
  q: optionalTrimmed(120),
  type: z.enum(PROFILE_TYPES).optional(),
  category: z.enum(MACHINE_CATEGORIES).optional(),
  material: z.enum(MATERIAL_CATEGORIES).optional(),
  city: optionalTrimmed(80),
  shipping: z.coerce.boolean().optional(),
  acceptingOnly: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  sort: z.enum(["recent", "rating"]).default("recent"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(1).max(48).default(12),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

// ---------------------------------------------------------------------------
// Project gallery
// ---------------------------------------------------------------------------

/**
 * Images are referenced by URL rather than uploaded, so the URL is validated
 * as strictly as any other user-supplied link: http(s) only, no javascript:
 * or data: payloads.
 */
export const portfolioItemSchema = z
  .object({
    title: trimmed(LIMITS.portfolioTitle),
    description: optionalTrimmed(LIMITS.portfolioDescription),
    imageUrl: z.preprocess(
      (value) => blankToUndefined(value),
      z
        .string()
        .max(2048)
        .refine(
          (value) => {
            try {
              const parsed = new URL(value);
              return parsed.protocol === "http:" || parsed.protocol === "https:";
            } catch {
              return false;
            }
          },
          { message: "Enter a valid http(s) image URL." },
        ),
    ),
    altText: optionalTrimmed(200),
    machineId: optionalTrimmed(40),
    materialUsed: optionalTrimmed(120),
    featured: checkbox,
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .strict();

export type PortfolioItemInput = z.infer<typeof portfolioItemSchema>;

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export const reviewSchema = z
  .object({
    profileSlug: z
      .string()
      .transform((value) => sanitizeText(value).toLowerCase())
      .pipe(z.string().min(1).max(LIMITS.slug)),
    rating: z.coerce
      .number()
      .int("Ratings are whole stars from 1 to 5.")
      .min(1, "Choose at least one star.")
      .max(5, "Ratings go up to five stars."),
    title: optionalTrimmed(120),
    body: z
      .string()
      .transform(sanitizeText)
      .pipe(
        z
          .string()
          .min(10, "Tell people a little more — at least 10 characters.")
          .max(LIMITS.reviewBody),
      ),
  })
  .strict();

export type ReviewInput = z.infer<typeof reviewSchema>;

export const reviewUpdateSchema = reviewSchema.omit({ profileSlug: true });

export const reviewResponseSchema = z
  .object({
    body: z
      .string()
      .transform(sanitizeText)
      .pipe(z.string().min(1, "Write a reply before posting.").max(LIMITS.reviewBody)),
  })
  .strict();
