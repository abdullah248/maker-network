import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  availabilitySlotSchema,
  machineInputSchema,
  materialInputSchema,
  operatingHoursSchema,
} from "@/lib/validation";
import { requireOwnedProfile, requireUserId } from "./authz";

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

export async function listMachines(profileId: string) {
  return prisma.machine.findMany({
    where: { profileId },
    orderBy: [{ category: "asc" }, { make: "asc" }, { model: "asc" }],
  });
}

export async function createMachine(userId: string | null | undefined, input: unknown) {
  const profile = await requireOwnedProfile(userId);
  const parsed = machineInputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  return prisma.machine.create({
    data: {
      profileId: profile.id,
      category: parsed.data.category,
      make: parsed.data.make,
      model: parsed.data.model,
      isCustom: parsed.data.isCustom,
      nickname: parsed.data.nickname ?? null,
      buildVolume: parsed.data.buildVolume ?? null,
      quantity: parsed.data.quantity,
      hourlyRate: parsed.data.hourlyRate ?? null,
      perJobFee: parsed.data.perJobFee ?? null,
      notes: parsed.data.notes ?? null,
      isOperational: parsed.data.isOperational,
    },
  });
}

export async function updateMachine(
  userId: string | null | undefined,
  machineId: string,
  input: unknown,
) {
  const profile = await requireOwnedProfile(userId);
  const parsed = machineInputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const existing = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!existing) throw new NotFoundError("Machine not found.");
  if (existing.profileId !== profile.id) throw new ForbiddenError();

  return prisma.machine.update({
    where: { id: machineId },
    data: {
      category: parsed.data.category,
      make: parsed.data.make,
      model: parsed.data.model,
      isCustom: parsed.data.isCustom,
      nickname: parsed.data.nickname ?? null,
      buildVolume: parsed.data.buildVolume ?? null,
      quantity: parsed.data.quantity,
      hourlyRate: parsed.data.hourlyRate ?? null,
      perJobFee: parsed.data.perJobFee ?? null,
      notes: parsed.data.notes ?? null,
      isOperational: parsed.data.isOperational,
    },
  });
}

export async function deleteMachine(userId: string | null | undefined, machineId: string) {
  const profile = await requireOwnedProfile(userId);
  const existing = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!existing) throw new NotFoundError("Machine not found.");
  if (existing.profileId !== profile.id) throw new ForbiddenError();
  await prisma.machine.delete({ where: { id: machineId } });
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export async function listMaterials(profileId: string) {
  return prisma.material.findMany({
    where: { profileId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

function materialData(parsed: ReturnType<typeof materialInputSchema.parse>) {
  return {
    category: parsed.category,
    name: parsed.name,
    brand: parsed.brand ?? null,
    colors: parsed.colors ?? null,
    specs: parsed.specs ?? null,
    unit: parsed.unit,
    pricePerUnit: parsed.pricePerUnit,
    currency: parsed.currency,
    stockQuantity: parsed.stockQuantity ?? null,
    inStock: parsed.inStock,
    canCustomOrder: parsed.canCustomOrder,
    customOrderLeadDays: parsed.customOrderLeadDays ?? null,
    notes: parsed.notes ?? null,
  };
}

export async function createMaterial(userId: string | null | undefined, input: unknown) {
  const profile = await requireOwnedProfile(userId);
  const parsed = materialInputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  return prisma.material.create({
    data: { profileId: profile.id, ...materialData(parsed.data) },
  });
}

export async function updateMaterial(
  userId: string | null | undefined,
  materialId: string,
  input: unknown,
) {
  const profile = await requireOwnedProfile(userId);
  const parsed = materialInputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const existing = await prisma.material.findUnique({ where: { id: materialId } });
  if (!existing) throw new NotFoundError("Material not found.");
  if (existing.profileId !== profile.id) throw new ForbiddenError();

  return prisma.material.update({
    where: { id: materialId },
    data: materialData(parsed.data),
  });
}

export async function deleteMaterial(userId: string | null | undefined, materialId: string) {
  const profile = await requireOwnedProfile(userId);
  const existing = await prisma.material.findUnique({ where: { id: materialId } });
  if (!existing) throw new NotFoundError("Material not found.");
  if (existing.profileId !== profile.id) throw new ForbiddenError();
  await prisma.material.delete({ where: { id: materialId } });
}

// ---------------------------------------------------------------------------
// Operating hours
// ---------------------------------------------------------------------------

export async function listOperatingHours(profileId: string) {
  return prisma.operatingHours.findMany({
    where: { profileId },
    orderBy: { dayOfWeek: "asc" },
  });
}

/** Replaces the full weekly schedule in one transaction. */
export async function replaceOperatingHours(userId: string | null | undefined, input: unknown) {
  const profile = await requireOwnedProfile(userId);
  const parsed = operatingHoursSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  return prisma.$transaction(async (tx) => {
    await tx.operatingHours.deleteMany({ where: { profileId: profile.id } });
    if (parsed.data.length === 0) return [];
    await tx.operatingHours.createMany({
      data: parsed.data.map((entry) => ({
        profileId: profile.id,
        dayOfWeek: entry.dayOfWeek,
        opensAt: entry.opensAt,
        closesAt: entry.closesAt,
        isClosed: entry.isClosed,
        note: entry.note ?? null,
      })),
    });
    return tx.operatingHours.findMany({
      where: { profileId: profile.id },
      orderBy: { dayOfWeek: "asc" },
    });
  });
}

// ---------------------------------------------------------------------------
// Availability slots
// ---------------------------------------------------------------------------

export async function listAvailability(
  profileId: string,
  range?: { from?: Date; to?: Date },
) {
  return prisma.availabilitySlot.findMany({
    where: {
      profileId,
      ...(range?.from || range?.to
        ? {
            startsAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { startsAt: "asc" },
    include: { machine: { select: { id: true, make: true, model: true, nickname: true } } },
  });
}

export async function createAvailabilitySlot(
  userId: string | null | undefined,
  input: unknown,
) {
  const profile = await requireOwnedProfile(userId);
  const parsed = availabilitySlotSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  if (parsed.data.machineId) {
    const machine = await prisma.machine.findUnique({ where: { id: parsed.data.machineId } });
    if (!machine || machine.profileId !== profile.id) {
      throw new ValidationError("That machine does not belong to your profile.");
    }
  }

  const overlapping = await prisma.availabilitySlot.findFirst({
    where: {
      profileId: profile.id,
      machineId: parsed.data.machineId ?? null,
      startsAt: { lt: parsed.data.endsAt },
      endsAt: { gt: parsed.data.startsAt },
    },
  });
  if (overlapping) {
    throw new ValidationError("That time range overlaps an existing slot.");
  }

  return prisma.availabilitySlot.create({
    data: {
      profileId: profile.id,
      machineId: parsed.data.machineId ?? null,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      status: parsed.data.status,
      capacity: parsed.data.capacity,
      note: parsed.data.note ?? null,
    },
  });
}

export async function deleteAvailabilitySlot(
  userId: string | null | undefined,
  slotId: string,
) {
  const profile = await requireOwnedProfile(userId);
  const slot = await prisma.availabilitySlot.findUnique({ where: { id: slotId } });
  if (!slot) throw new NotFoundError("Slot not found.");
  if (slot.profileId !== profile.id) throw new ForbiddenError();
  await prisma.availabilitySlot.delete({ where: { id: slotId } });
}

/** Lets a signed-in customer reserve an open slot. */
export async function bookAvailabilitySlot(userId: string | null | undefined, slotId: string) {
  const id = requireUserId(userId);

  return prisma.$transaction(async (tx) => {
    const slot = await tx.availabilitySlot.findUnique({ where: { id: slotId } });
    if (!slot) throw new NotFoundError("Slot not found.");
    if (slot.status !== "OPEN") {
      throw new ValidationError("That slot is no longer available.");
    }
    if (slot.startsAt.getTime() < Date.now()) {
      throw new ValidationError("That slot is in the past.");
    }

    const profile = await tx.profile.findUnique({ where: { id: slot.profileId } });
    if (profile?.userId === id) {
      throw new ValidationError("You cannot book your own slot.");
    }

    return tx.availabilitySlot.update({
      where: { id: slotId },
      data: { status: "BOOKED", bookedByUserId: id, bookedAt: new Date() },
    });
  });
}

export async function releaseAvailabilitySlot(
  userId: string | null | undefined,
  slotId: string,
) {
  const id = requireUserId(userId);
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    include: { profile: { select: { userId: true } } },
  });
  if (!slot) throw new NotFoundError("Slot not found.");

  const isBooker = slot.bookedByUserId === id;
  const isOwner = slot.profile.userId === id;
  if (!isBooker && !isOwner) throw new ForbiddenError();

  return prisma.availabilitySlot.update({
    where: { id: slotId },
    data: { status: "OPEN", bookedByUserId: null, bookedAt: null },
  });
}
