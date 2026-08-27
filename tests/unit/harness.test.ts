import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { upsertOwnProfile, getPublicProfileBySlug } from "@/lib/services/profiles";
import { createUser, validProfileInput } from "../setup/factories";

describe("test harness", () => {
  it("has a migrated, empty database", async () => {
    expect(await prisma.user.count()).toBe(0);
  });

  it("can create and read a profile through the service layer", async () => {
    const user = await createUser();
    const input = validProfileInput({ slug: "harness-check" });
    await upsertOwnProfile(user.id, input);

    const found = await getPublicProfileBySlug("harness-check");
    expect(found?.displayName).toBe("Ada's Print Shop");
  });
});
