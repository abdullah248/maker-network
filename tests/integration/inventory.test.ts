import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  bookAvailabilitySlot,
  createAvailabilitySlot,
  createMachine,
  createMaterial,
  deleteAvailabilitySlot,
  deleteMachine,
  deleteMaterial,
  listAvailability,
  listMachines,
  listMaterials,
  listOperatingHours,
  releaseAvailabilitySlot,
  replaceOperatingHours,
  updateMachine,
  updateMaterial,
} from "@/lib/services/inventory";
import {
  createProviderWithInventory,
  createUser,
  futureDate,
  validMachineInput,
  validMaterialInput,
} from "../setup/factories";

describe("machines", () => {
  it("creates a machine on the caller's own profile", async () => {
    const { user, profile } = await createProviderWithInventory();
    const machine = await createMachine(user.id, validMachineInput());

    expect(machine.profileId).toBe(profile.id);
    expect(machine.make).toBe("Prusa Research");
  });

  it("supports custom machines outside the catalog", async () => {
    const { user } = await createProviderWithInventory();
    const machine = await createMachine(
      user.id,
      validMachineInput({
        isCustom: true,
        make: "Homebrew",
        model: "CoreXY v3",
        category: "OTHER",
      }),
    );
    expect(machine.isCustom).toBe(true);
    expect(machine.model).toBe("CoreXY v3");
  });

  it("refuses to create a machine for a user without a profile", async () => {
    const user = await createUser();
    await expect(createMachine(user.id, validMachineInput())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("blocks updating another provider's machine", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();

    await expect(
      updateMachine(attacker.user.id, victim.machine.id, validMachineInput()),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const untouched = await prisma.machine.findUnique({ where: { id: victim.machine.id } });
    expect(untouched?.make).toBe("Bambu Lab");
  });

  it("blocks deleting another provider's machine", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();

    await expect(
      deleteMachine(attacker.user.id, victim.machine.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.machine.count({ where: { id: victim.machine.id } })).toBe(1);
  });

  it("deletes the caller's own machine", async () => {
    const { user, machine } = await createProviderWithInventory();
    await deleteMachine(user.id, machine.id);
    expect(await prisma.machine.count({ where: { id: machine.id } })).toBe(0);
  });

  it("404s on a machine that does not exist", async () => {
    const { user } = await createProviderWithInventory();
    await expect(deleteMachine(user.id, "does-not-exist")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists machines for a profile", async () => {
    const { user, profile } = await createProviderWithInventory();
    await createMachine(user.id, validMachineInput());
    expect(await listMachines(profile.id)).toHaveLength(2);
  });
});

describe("materials", () => {
  it("creates a priced material", async () => {
    const { user, profile } = await createProviderWithInventory();
    const material = await createMaterial(user.id, validMaterialInput({ pricePerUnit: 28.5 }));

    expect(material.profileId).toBe(profile.id);
    expect(material.pricePerUnit).toBe(28.5);
  });

  it("rejects a negative price", async () => {
    const { user } = await createProviderWithInventory();
    await expect(
      createMaterial(user.id, validMaterialInput({ pricePerUnit: -5 })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("supports custom-order materials with a lead time", async () => {
    const { user } = await createProviderWithInventory();
    const material = await createMaterial(
      user.id,
      validMaterialInput({ inStock: false, canCustomOrder: true, customOrderLeadDays: 5 }),
    );
    expect(material.canCustomOrder).toBe(true);
    expect(material.customOrderLeadDays).toBe(5);
  });

  it("blocks editing another provider's material", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();

    await expect(
      updateMaterial(attacker.user.id, victim.material.id, validMaterialInput()),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks deleting another provider's material", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();

    await expect(
      deleteMaterial(attacker.user.id, victim.material.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lists materials for a profile", async () => {
    const { user, profile } = await createProviderWithInventory();
    await createMaterial(user.id, validMaterialInput());
    expect(await listMaterials(profile.id)).toHaveLength(2);
  });
});

describe("operating hours", () => {
  const week = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    opensAt: 600,
    closesAt: 1140,
    isClosed: dayOfWeek === 0,
  }));

  it("replaces the full week", async () => {
    const { user, profile } = await createProviderWithInventory();
    await replaceOperatingHours(user.id, week);

    const saved = await listOperatingHours(profile.id);
    expect(saved).toHaveLength(7);
    expect(saved[0].isClosed).toBe(true);
    expect(saved[1].opensAt).toBe(600);
  });

  it("is idempotent and does not duplicate rows", async () => {
    const { user, profile } = await createProviderWithInventory();
    await replaceOperatingHours(user.id, week);
    await replaceOperatingHours(user.id, week);
    expect(await listOperatingHours(profile.id)).toHaveLength(7);
  });

  it("supports clearing the schedule", async () => {
    const { user, profile } = await createProviderWithInventory();
    await replaceOperatingHours(user.id, week);
    await replaceOperatingHours(user.id, []);
    expect(await listOperatingHours(profile.id)).toHaveLength(0);
  });

  it("rejects an invalid week without partially writing", async () => {
    const { user, profile } = await createProviderWithInventory();
    await replaceOperatingHours(user.id, week);

    await expect(
      replaceOperatingHours(user.id, [
        { dayOfWeek: 1, opensAt: 1200, closesAt: 600, isClosed: false },
      ]),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(await listOperatingHours(profile.id)).toHaveLength(7);
  });
});

describe("availability slots", () => {
  it("creates a slot", async () => {
    const { user, profile } = await createProviderWithInventory();
    const slot = await createAvailabilitySlot(user.id, {
      startsAt: futureDate(2),
      endsAt: futureDate(2.1),
    });
    expect(slot.profileId).toBe(profile.id);
    expect(slot.status).toBe("OPEN");
  });

  it("rejects an overlapping slot on the same machine", async () => {
    const { user, machine } = await createProviderWithInventory();
    await createAvailabilitySlot(user.id, {
      machineId: machine.id,
      startsAt: futureDate(3),
      endsAt: futureDate(3.2),
    });

    await expect(
      createAvailabilitySlot(user.id, {
        machineId: machine.id,
        startsAt: futureDate(3.1),
        endsAt: futureDate(3.3),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows back-to-back slots that only touch at the boundary", async () => {
    const { user } = await createProviderWithInventory();
    await createAvailabilitySlot(user.id, { startsAt: futureDate(4), endsAt: futureDate(4.2) });
    const second = await createAvailabilitySlot(user.id, {
      startsAt: futureDate(4.2),
      endsAt: futureDate(4.4),
    });
    expect(second.id).toBeTruthy();
  });

  it("rejects a machine belonging to another provider", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();

    await expect(
      createAvailabilitySlot(attacker.user.id, {
        machineId: victim.machine.id,
        startsAt: futureDate(5),
        endsAt: futureDate(5.2),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("blocks deleting another provider's slot", async () => {
    const victim = await createProviderWithInventory();
    const attacker = await createProviderWithInventory();
    const slot = await createAvailabilitySlot(victim.user.id, {
      startsAt: futureDate(6),
      endsAt: futureDate(6.2),
    });

    await expect(deleteAvailabilitySlot(attacker.user.id, slot.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("filters listings by date range", async () => {
    const { user, profile } = await createProviderWithInventory();
    await createAvailabilitySlot(user.id, { startsAt: futureDate(1), endsAt: futureDate(1.2) });
    await createAvailabilitySlot(user.id, { startsAt: futureDate(40), endsAt: futureDate(40.2) });

    const soon = await listAvailability(profile.id, { from: new Date(), to: futureDate(10) });
    expect(soon).toHaveLength(1);
  });
});

describe("booking slots", () => {
  it("lets a customer book an open slot", async () => {
    const provider = await createProviderWithInventory();
    const customer = await createUser();
    const slot = await createAvailabilitySlot(provider.user.id, {
      startsAt: futureDate(7),
      endsAt: futureDate(7.2),
    });

    const booked = await bookAvailabilitySlot(customer.id, slot.id);
    expect(booked.status).toBe("BOOKED");
    expect(booked.bookedByUserId).toBe(customer.id);
  });

  it("refuses to double-book", async () => {
    const provider = await createProviderWithInventory();
    const first = await createUser();
    const second = await createUser();
    const slot = await createAvailabilitySlot(provider.user.id, {
      startsAt: futureDate(8),
      endsAt: futureDate(8.2),
    });

    await bookAvailabilitySlot(first.id, slot.id);
    await expect(bookAvailabilitySlot(second.id, slot.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to book a past slot", async () => {
    const provider = await createProviderWithInventory();
    const customer = await createUser();
    const slot = await prisma.availabilitySlot.create({
      data: {
        profileId: provider.profile.id,
        startsAt: futureDate(-3),
        endsAt: futureDate(-2.9),
        status: "OPEN",
      },
    });

    await expect(bookAvailabilitySlot(customer.id, slot.id)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("refuses to let a provider book their own slot", async () => {
    const provider = await createProviderWithInventory();
    const slot = await createAvailabilitySlot(provider.user.id, {
      startsAt: futureDate(9),
      endsAt: futureDate(9.2),
    });

    await expect(bookAvailabilitySlot(provider.user.id, slot.id)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("lets the booker or the owner release a booking, but not a stranger", async () => {
    const provider = await createProviderWithInventory();
    const customer = await createUser();
    const stranger = await createUser();
    const slot = await createAvailabilitySlot(provider.user.id, {
      startsAt: futureDate(10),
      endsAt: futureDate(10.2),
    });
    await bookAvailabilitySlot(customer.id, slot.id);

    await expect(releaseAvailabilitySlot(stranger.id, slot.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const released = await releaseAvailabilitySlot(customer.id, slot.id);
    expect(released.status).toBe("OPEN");
    expect(released.bookedByUserId).toBeNull();
  });
});
