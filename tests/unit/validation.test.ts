import { describe, expect, it } from "vitest";

import {
  availabilitySlotSchema,
  machineInputSchema,
  materialInputSchema,
  messageBodySchema,
  operatingHoursSchema,
  printRequestSchema,
  profileInputSchema,
  sanitizeText,
  searchParamsSchema,
  slugSchema,
} from "@/lib/validation";
import { validMachineInput, validMaterialInput, validProfileInput } from "../setup/factories";

describe("sanitizeText", () => {
  it("trims and strips control characters", () => {
    expect(sanitizeText("  hello\u0000 world  ")).toBe("hello world");
  });

  it("leaves normal punctuation intact", () => {
    expect(sanitizeText("Ada's Print Shop — #1")).toBe("Ada's Print Shop — #1");
  });
});

describe("slugSchema", () => {
  it.each(["ada-prints", "cedar-park-library", "abc", "a1-b2"])("accepts %s", (value) => {
    expect(slugSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ["too short", "ab"],
    ["leading hyphen", "-ada"],
    ["trailing hyphen", "ada-"],
    ["spaces", "ada prints"],
    ["path traversal", "../etc/passwd"],
    ["uppercase with symbols", "Ada!Prints"],
  ])("rejects %s", (_label, value) => {
    expect(slugSchema.safeParse(value).success).toBe(false);
  });

  it("lowercases input before validating", () => {
    expect(slugSchema.parse("ADA-Prints")).toBe("ada-prints");
  });

  it.each(["admin", "api", "dashboard", "messages", "signin", "browse"])(
    "rejects the reserved handle %s",
    (value) => {
      expect(slugSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("profileInputSchema", () => {
  it("accepts a minimal individual profile", () => {
    const result = profileInputSchema.safeParse(validProfileInput());
    expect(result.success).toBe(true);
  });

  it("accepts a makerspace profile with access rules", () => {
    const result = profileInputSchema.safeParse(
      validProfileInput({
        type: "MAKERSPACE",
        requiresLibraryCard: true,
        requiresAppointment: true,
        membershipDetails: "Free with a city library card.",
        offersShipping: undefined,
        offersLocalPickup: undefined,
        canCustomOrderMaterials: undefined,
      }),
    );
    expect(result.success).toBe(true);
  });

  it("requires an individual to offer shipping or pickup", () => {
    const result = profileInputSchema.safeParse(
      validProfileInput({ offersShipping: false, offersLocalPickup: false }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    const result = profileInputSchema.safeParse(
       
      validProfileInput({ websiteUrl: "javascript:alert(document.cookie)" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects data: URLs", () => {
    const result = profileInputSchema.safeParse(
      validProfileInput({ websiteUrl: "data:text/html;base64,PHNjcmlwdD4=" }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts https URLs", () => {
    const result = profileInputSchema.safeParse(
      validProfileInput({ websiteUrl: "https://example.com/shop" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an unknown profile type", () => {
    expect(profileInputSchema.safeParse(validProfileInput({ type: "ADMIN" })).success).toBe(false);
  });

  it("rejects an over-long display name", () => {
    const result = profileInputSchema.safeParse(
      validProfileInput({ displayName: "x".repeat(500) }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a malformed contact email", () => {
    expect(
      profileInputSchema.safeParse(validProfileInput({ contactEmail: "not-an-email" })).success,
    ).toBe(false);
  });

  it("normalises blank optional strings to undefined", () => {
    const result = profileInputSchema.parse(validProfileInput({ headline: "   ", bio: "" }));
    expect(result.headline).toBeUndefined();
    expect(result.bio).toBeUndefined();
  });
});

describe("machineInputSchema", () => {
  it("accepts a catalog machine", () => {
    expect(machineInputSchema.safeParse(validMachineInput()).success).toBe(true);
  });

  it("rejects an unknown category", () => {
    expect(
      machineInputSchema.safeParse(validMachineInput({ category: "TELEPORTER" })).success,
    ).toBe(false);
  });

  it("rejects a zero quantity", () => {
    expect(machineInputSchema.safeParse(validMachineInput({ quantity: 0 })).success).toBe(false);
  });

  it("rejects a negative hourly rate", () => {
    expect(
      machineInputSchema.safeParse(validMachineInput({ hourlyRate: -10 })).success,
    ).toBe(false);
  });

  it("rejects unknown extra keys (mass assignment)", () => {
    const result = machineInputSchema.safeParse(
      validMachineInput({ profileId: "someone-elses-profile" }),
    );
    expect(result.success).toBe(false);
  });

  it("coerces numeric strings from form posts", () => {
    const result = machineInputSchema.parse(validMachineInput({ quantity: "3", hourlyRate: "12.5" }));
    expect(result.quantity).toBe(3);
    expect(result.hourlyRate).toBe(12.5);
  });
});

describe("materialInputSchema", () => {
  it("accepts a valid material", () => {
    expect(materialInputSchema.safeParse(validMaterialInput()).success).toBe(true);
  });

  it("rejects a negative price", () => {
    expect(
      materialInputSchema.safeParse(validMaterialInput({ pricePerUnit: -1 })).success,
    ).toBe(false);
  });

  it("rejects an unknown unit", () => {
    expect(materialInputSchema.safeParse(validMaterialInput({ unit: "FURLONG" })).success).toBe(
      false,
    );
  });

  it("rejects NaN prices", () => {
    expect(
      materialInputSchema.safeParse(validMaterialInput({ pricePerUnit: "abc" })).success,
    ).toBe(false);
  });

  it("allows a zero price for free materials", () => {
    expect(materialInputSchema.safeParse(validMaterialInput({ pricePerUnit: 0 })).success).toBe(
      true,
    );
  });

  it("rejects unknown extra keys", () => {
    expect(
      materialInputSchema.safeParse(validMaterialInput({ profileId: "victim" })).success,
    ).toBe(false);
  });
});

describe("operatingHoursSchema", () => {
  it("accepts a normal week", () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      opensAt: 540,
      closesAt: 1020,
      isClosed: false,
    }));
    expect(operatingHoursSchema.safeParse(week).success).toBe(true);
  });

  it("rejects a closing time before the opening time", () => {
    const result = operatingHoursSchema.safeParse([
      { dayOfWeek: 1, opensAt: 1020, closesAt: 540, isClosed: false },
    ]);
    expect(result.success).toBe(false);
  });

  it("allows an inverted range when the day is marked closed", () => {
    const result = operatingHoursSchema.safeParse([
      { dayOfWeek: 1, opensAt: 0, closesAt: 0, isClosed: true },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects duplicate weekdays", () => {
    const result = operatingHoursSchema.safeParse([
      { dayOfWeek: 1, opensAt: 540, closesAt: 1020, isClosed: false },
      { dayOfWeek: 1, opensAt: 600, closesAt: 1080, isClosed: false },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range weekday", () => {
    const result = operatingHoursSchema.safeParse([
      { dayOfWeek: 9, opensAt: 540, closesAt: 1020, isClosed: false },
    ]);
    expect(result.success).toBe(false);
  });
});

describe("availabilitySlotSchema", () => {
  const start = new Date("2030-01-01T10:00:00.000Z");
  const end = new Date("2030-01-01T12:00:00.000Z");

  it("accepts a valid slot", () => {
    expect(availabilitySlotSchema.safeParse({ startsAt: start, endsAt: end }).success).toBe(true);
  });

  it("rejects an end before the start", () => {
    expect(availabilitySlotSchema.safeParse({ startsAt: end, endsAt: start }).success).toBe(false);
  });

  it("rejects a zero-length slot", () => {
    expect(availabilitySlotSchema.safeParse({ startsAt: start, endsAt: start }).success).toBe(
      false,
    );
  });

  it("rejects slots longer than 14 days", () => {
    const veryLate = new Date("2030-03-01T10:00:00.000Z");
    expect(
      availabilitySlotSchema.safeParse({ startsAt: start, endsAt: veryLate }).success,
    ).toBe(false);
  });

  it("rejects unparseable dates", () => {
    expect(
      availabilitySlotSchema.safeParse({ startsAt: "not-a-date", endsAt: end }).success,
    ).toBe(false);
  });
});

describe("messageBodySchema", () => {
  it("rejects an empty message", () => {
    expect(messageBodySchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a message over the limit", () => {
    expect(messageBodySchema.safeParse("x".repeat(5001)).success).toBe(false);
  });

  it("keeps script-like text as literal text rather than rejecting it", () => {
    const result = messageBodySchema.parse("<script>alert(1)</script>");
    expect(result).toBe("<script>alert(1)</script>");
  });
});

describe("printRequestSchema", () => {
  const base = {
    profileSlug: "ada-prints",
    title: "Replacement knob",
    description: "One knob, 24 mm diameter.",
  };

  it("accepts a minimal request", () => {
    expect(printRequestSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a quantity of zero", () => {
    expect(printRequestSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
  });

  it("rejects an absurd quantity", () => {
    expect(printRequestSchema.safeParse({ ...base, quantity: 99_999_999 }).success).toBe(false);
  });

  it("rejects an unknown fulfilment option", () => {
    expect(printRequestSchema.safeParse({ ...base, fulfillment: "TELEPORT" }).success).toBe(false);
  });

  it("rejects a javascript: file URL", () => {
     
    expect(printRequestSchema.safeParse({ ...base, fileUrl: "javascript:alert(1)" }).success).toBe(
      false,
    );
  });

  it("rejects unknown extra keys", () => {
    expect(printRequestSchema.safeParse({ ...base, status: "COMPLETED" }).success).toBe(false);
  });
});

describe("searchParamsSchema", () => {
  it("applies defaults", () => {
    const result = searchParamsSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(12);
  });

  it("caps perPage", () => {
    expect(searchParamsSchema.safeParse({ perPage: 5000 }).success).toBe(false);
  });

  it("rejects an unknown machine category", () => {
    expect(searchParamsSchema.safeParse({ category: "DROP_TABLE" }).success).toBe(false);
  });
});
