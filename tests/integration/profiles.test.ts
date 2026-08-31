import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import {
  completeOnboarding,
  getOwnProfile,
  getProfileBySlugForViewer,
  getPublicProfileBySlug,
  isSlugAvailable,
  setPublished,
  suggestSlug,
  upsertOwnProfile,
} from "@/lib/services/profiles";
import { createUser, validProfileInput } from "../setup/factories";

describe("completeOnboarding", () => {
  it("records the chosen account type", async () => {
    const user = await createUser();
    const result = await completeOnboarding(user.id, { accountType: "MAKERSPACE" });
    expect(result.accountType).toBe("MAKERSPACE");
    expect(result.onboardedAt).toBeInstanceOf(Date);
  });

  it("rejects an unknown account type", async () => {
    const user = await createUser();
    await expect(completeOnboarding(user.id, { accountType: "SUPERADMIN" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("requires a signed-in user", async () => {
    await expect(completeOnboarding(null, { accountType: "CUSTOMER" })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe("upsertOwnProfile", () => {
  it("creates an individual maker profile", async () => {
    const user = await createUser();
    const profile = await upsertOwnProfile(
      user.id,
      validProfileInput({ slug: "ada-prints", displayName: "Ada's Print Bench" }),
    );

    expect(profile.userId).toBe(user.id);
    expect(profile.type).toBe("INDIVIDUAL");
    expect(profile.slug).toBe("ada-prints");
    expect(profile.offersShipping).toBe(true);
  });

  it("promotes the user's account type on save", async () => {
    const user = await createUser();
    await upsertOwnProfile(user.id, validProfileInput({ type: "MAKERSPACE", slug: "the-forge" }));
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.accountType).toBe("MAKERSPACE");
  });

  it("updates rather than duplicating on a second save", async () => {
    const user = await createUser();
    await upsertOwnProfile(user.id, validProfileInput({ slug: "first-handle" }));
    await upsertOwnProfile(
      user.id,
      validProfileInput({ slug: "second-handle", displayName: "Renamed" }),
    );

    expect(await prisma.profile.count({ where: { userId: user.id } })).toBe(1);
    const profile = await getOwnProfile(user.id);
    expect(profile?.slug).toBe("second-handle");
    expect(profile?.displayName).toBe("Renamed");
  });

  it("clears makerspace-only fields on an individual profile", async () => {
    const user = await createUser();
    const profile = await upsertOwnProfile(
      user.id,
      validProfileInput({ slug: "solo-maker", requiresLibraryCard: true }),
    );
    expect(profile.requiresLibraryCard).toBe(false);
  });

  it("clears fulfilment fields on a makerspace profile", async () => {
    const user = await createUser();
    const profile = await upsertOwnProfile(
      user.id,
      validProfileInput({ type: "MAKERSPACE", slug: "space-one", offersShipping: true }),
    );
    expect(profile.offersShipping).toBe(false);
  });

  it("rejects a handle already taken by another user", async () => {
    const first = await createUser();
    const second = await createUser();
    await upsertOwnProfile(first.id, validProfileInput({ slug: "shared-handle" }));

    await expect(
      upsertOwnProfile(second.id, validProfileInput({ slug: "shared-handle" })),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("ignores a client-supplied userId (mass assignment)", async () => {
    const victim = await createUser();
    const attacker = await createUser();

    const profile = await upsertOwnProfile(attacker.id, {
      ...validProfileInput({ slug: "attacker-handle" }),
      userId: victim.id,
      id: "forged-id",
    });

    expect(profile.userId).toBe(attacker.id);
    expect(profile.id).not.toBe("forged-id");
    expect(await prisma.profile.count({ where: { userId: victim.id } })).toBe(0);
  });

  it("rejects an anonymous caller", async () => {
    await expect(upsertOwnProfile(null, validProfileInput())).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("rejects a reserved handle", async () => {
    const user = await createUser();
    await expect(
      upsertOwnProfile(user.id, validProfileInput({ slug: "dashboard" })),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("profile visibility", () => {
  it("hides unpublished profiles from the public lookup", async () => {
    const user = await createUser();
    await upsertOwnProfile(user.id, validProfileInput({ slug: "draft-shop", published: false }));
    expect(await getPublicProfileBySlug("draft-shop")).toBeNull();
  });

  it("lets the owner preview their own draft", async () => {
    const user = await createUser();
    await upsertOwnProfile(user.id, validProfileInput({ slug: "draft-shop", published: false }));

    expect(await getProfileBySlugForViewer("draft-shop", user.id)).not.toBeNull();
    expect(await getProfileBySlugForViewer("draft-shop", "another-user")).toBeNull();
    expect(await getProfileBySlugForViewer("draft-shop", null)).toBeNull();
  });

  it("returns null rather than throwing for a malformed slug", async () => {
    expect(await getPublicProfileBySlug("../../etc/passwd")).toBeNull();
    expect(await getProfileBySlugForViewer("' OR 1=1 --", null)).toBeNull();
  });

  it("toggles published state for the owner only", async () => {
    const user = await createUser();
    await upsertOwnProfile(user.id, validProfileInput({ slug: "toggle-me", published: false }));

    const published = await setPublished(user.id, true);
    expect(published.published).toBe(true);

    const stranger = await createUser();
    await expect(setPublished(stranger.id, true)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("slug helpers", () => {
  it("reports availability correctly", async () => {
    const user = await createUser();
    await upsertOwnProfile(user.id, validProfileInput({ slug: "taken-handle" }));

    expect(await isSlugAvailable("taken-handle")).toBe(false);
    expect(await isSlugAvailable("taken-handle", user.id)).toBe(true);
    expect(await isSlugAvailable("free-handle")).toBe(true);
    expect(await isSlugAvailable("no")).toBe(false);
  });

  it("suggests a unique handle from a display name", async () => {
    const user = await createUser();
    await upsertOwnProfile(user.id, validProfileInput({ slug: "cedar-park-library" }));

    const suggestion = await suggestSlug("Cedar Park Library");
    expect(suggestion).not.toBe("cedar-park-library");
    expect(await isSlugAvailable(suggestion)).toBe(true);
  });

  it("produces a valid handle from awkward names", async () => {
    const suggestion = await suggestSlug("!!! ??? ***");
    expect(await isSlugAvailable(suggestion)).toBe(true);
  });
});
