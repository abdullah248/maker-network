/**
 * Shared enums. Stored as plain strings in the database so the schema stays
 * portable between SQLite (dev/CI) and PostgreSQL (production).
 */

export const ACCOUNT_TYPES = ["CUSTOMER", "MAKERSPACE", "INDIVIDUAL"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const PROFILE_TYPES = ["MAKERSPACE", "INDIVIDUAL"] as const;
export type ProfileType = (typeof PROFILE_TYPES)[number];

export const PROFILE_TYPE_LABELS: Record<ProfileType, string> = {
  MAKERSPACE: "Makerspace / library",
  INDIVIDUAL: "Individual maker",
};

export const MACHINE_CATEGORIES = [
  "FDM_3D_PRINTER",
  "RESIN_3D_PRINTER",
  "LASER_CUTTER",
  "CNC_ROUTER",
  "VINYL_CUTTER",
  "EMBROIDERY_MACHINE",
  "SEWING_MACHINE",
  "UV_PRINTER",
  "OTHER",
] as const;
export type MachineCategory = (typeof MACHINE_CATEGORIES)[number];

export const MACHINE_CATEGORY_LABELS: Record<MachineCategory, string> = {
  FDM_3D_PRINTER: "FDM 3D printer",
  RESIN_3D_PRINTER: "Resin 3D printer",
  LASER_CUTTER: "Laser cutter / engraver",
  CNC_ROUTER: "CNC router / mill",
  VINYL_CUTTER: "Vinyl cutter",
  EMBROIDERY_MACHINE: "Embroidery machine",
  SEWING_MACHINE: "Sewing machine",
  UV_PRINTER: "UV / flatbed printer",
  OTHER: "Other equipment",
};

export const MATERIAL_CATEGORIES = [
  "FILAMENT",
  "RESIN",
  "SHEET_WOOD",
  "SHEET_ACRYLIC",
  "SHEET_METAL",
  "FABRIC",
  "VINYL",
  "PAPER_CARD",
  "OTHER",
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  FILAMENT: "Filament",
  RESIN: "Resin",
  SHEET_WOOD: "Wood sheet",
  SHEET_ACRYLIC: "Acrylic sheet",
  SHEET_METAL: "Metal sheet",
  FABRIC: "Fabric",
  VINYL: "Vinyl",
  PAPER_CARD: "Paper / card",
  OTHER: "Other material",
};

export const MATERIAL_UNITS = [
  "KG",
  "GRAM",
  "SPOOL",
  "LITER",
  "ML",
  "SHEET",
  "METER",
  "SQ_FOOT",
  "ITEM",
] as const;
export type MaterialUnit = (typeof MATERIAL_UNITS)[number];

export const MATERIAL_UNIT_LABELS: Record<MaterialUnit, string> = {
  KG: "per kg",
  GRAM: "per gram",
  SPOOL: "per spool",
  LITER: "per liter",
  ML: "per ml",
  SHEET: "per sheet",
  METER: "per meter",
  SQ_FOOT: "per sq ft",
  ITEM: "per item",
};

export const SLOT_STATUSES = ["OPEN", "BOOKED", "BLOCKED"] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

export const FULFILLMENT_OPTIONS = ["PICKUP", "SHIPPING", "EITHER"] as const;
export type Fulfillment = (typeof FULFILLMENT_OPTIONS)[number];

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  PICKUP: "Local pickup",
  SHIPPING: "Shipping",
  EITHER: "Pickup or shipping",
};

export const REQUEST_STATUSES = [
  "OPEN",
  "ACCEPTED",
  "DECLINED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Field length ceilings shared by validation and UI hints. */
export const LIMITS = {
  displayName: 80,
  headline: 140,
  bio: 4000,
  messageBody: 5000,
  notes: 2000,
  slug: 60,
  portfolioTitle: 120,
  portfolioDescription: 1000,
  reviewBody: 4000,
  /** Max gallery images a single profile may publish. */
  portfolioMax: 48,
  /** Max messages a single user may send in MESSAGE_RATE_WINDOW_MS. */
  messageRateMax: 20,
  messageRateWindowMs: 60_000,
} as const;

export const RATING_VALUES = [1, 2, 3, 4, 5] as const;
export type RatingValue = (typeof RATING_VALUES)[number];

export const RATING_LABELS: Record<RatingValue, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
};
