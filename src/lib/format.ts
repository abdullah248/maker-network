import {
  DAY_LABELS,
  MATERIAL_UNIT_LABELS,
  type MaterialUnit,
} from "@/lib/constants";

export function formatMoney(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatPrice(amount: number, unit: string, currency = "USD") {
  const unitLabel = MATERIAL_UNIT_LABELS[unit as MaterialUnit] ?? "";
  if (amount <= 0) return "Free / included";
  return `${formatMoney(amount, currency)} ${unitLabel}`.trim();
}

/** Converts minutes-since-midnight into a 12-hour clock label. */
export function formatMinutes(minutes: number) {
  const clamped = Math.max(0, Math.min(1440, Math.round(minutes)));
  const hour24 = Math.floor(clamped / 60) % 24;
  const minute = clamped % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

export function minutesToTimeInput(minutes: number) {
  const clamped = Math.max(0, Math.min(1439, Math.round(minutes)));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function timeInputToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return Math.max(0, Math.min(1440, hours * 60 + minutes));
}

export function dayLabel(dayOfWeek: number) {
  return DAY_LABELS[dayOfWeek] ?? "Unknown";
}

export function formatLocation(profile: {
  city: string;
  region?: string | null;
  country?: string | null;
}) {
  return [profile.city, profile.region, profile.country && profile.country !== "US" ? profile.country : null]
    .filter(Boolean)
    .join(", ");
}

export function formatDate(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value);
}

export function formatDateTime(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatRelative(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "";
  const diffMs = value.getTime() - Date.now();
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) {
      return formatter.format(Math.round(diffMs / ms), unit);
    }
  }
  return "just now";
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function parseColorList(colors?: string | null): string[] {
  if (!colors) return [];
  return colors
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean)
    .slice(0, 30);
}

/** Human-readable file size. Lives here so client components can use it
 *  without pulling in the Node-only upload service. */
export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
