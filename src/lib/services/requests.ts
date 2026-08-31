import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { FULFILLMENT_LABELS, LIMITS, type Fulfillment } from "@/lib/constants";
import {
  PROCESS_LABELS,
  fitsInBuildVolume,
  parseBuildVolume,
  type Process,
} from "@/lib/print-specs";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  detailedRequestSchema,
  messageBodySchema,
  parseStoredSpecs,
  requestDecisionSchema,
} from "@/lib/validation";
import { requireOwnedProfile, requireUserId } from "./authz";
import { assertMessageRateLimit } from "./messaging";
import { attachFilesToRequest } from "./uploads";

const REQUEST_INCLUDE = {
  files: { orderBy: { createdAt: "asc" } },
  machine: { select: { id: true, make: true, model: true, category: true, buildVolume: true } },
  material: { select: { id: true, name: true, unit: true, pricePerUnit: true, currency: true } },
  conversation: {
    select: {
      id: true,
      subject: true,
      requesterId: true,
      lastMessageAt: true,
      requester: { select: { id: true, name: true, image: true, email: true } },
      providerProfile: { select: { id: true, slug: true, displayName: true, userId: true } },
    },
  },
} satisfies Prisma.PrintRequestInclude;

export type DetailedRequest = Prisma.PrintRequestGetPayload<{
  include: typeof REQUEST_INCLUDE;
}>;

/** Human-readable summary posted as the opening chat message. */
function buildSummary(input: {
  description: string;
  process: Process;
  quantity: number;
  fulfillment: string;
  materialType?: string;
  materialColor?: string;
  deadline?: Date;
  budget?: number;
  fileUrl?: string;
  fileCount: number;
}) {
  const lines = [
    input.description,
    "",
    `Process: ${PROCESS_LABELS[input.process]}`,
    input.materialType
      ? `Material: ${input.materialType}${input.materialColor ? ` (${input.materialColor})` : ""}`
      : null,
    `Quantity: ${input.quantity}`,
    `Fulfilment: ${FULFILLMENT_LABELS[input.fulfillment as Fulfillment] ?? input.fulfillment}`,
    input.deadline ? `Needed by: ${input.deadline.toISOString().slice(0, 10)}` : null,
    input.budget !== undefined ? `Budget: $${input.budget.toFixed(2)}` : null,
    input.fileUrl ? `External files: ${input.fileUrl}` : null,
    input.fileCount > 0
      ? `Attached ${input.fileCount} file${input.fileCount === 1 ? "" : "s"}.`
      : null,
  ];

  return lines.filter((line) => line !== null).join("\n");
}

/**
 * Creates a fully specified fabrication request: a conversation, the opening
 * message, the structured spec sheet and any uploaded files.
 */
export async function createDetailedRequest(userId: string | null | undefined, input: unknown) {
  const requesterId = requireUserId(userId);
  const parsed = detailedRequestSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());
  const data = parsed.data;

  const profile = await prisma.profile.findFirst({
    where: { slug: data.profileSlug, published: true },
    include: {
      machines: { select: { id: true, buildVolume: true, category: true } },
      materials: { select: { id: true, name: true } },
    },
  });
  if (!profile) throw new NotFoundError("That maker profile could not be found.");
  if (profile.userId === requesterId) {
    throw new ValidationError("You cannot send a request to your own profile.");
  }
  if (!profile.acceptingRequests) {
    throw new ValidationError("This maker is not accepting new requests right now.");
  }

  const machine = data.machineId
    ? profile.machines.find((entry) => entry.id === data.machineId)
    : undefined;
  if (data.machineId && !machine) {
    throw new ValidationError("The selected machine is not offered by this maker.");
  }
  if (data.materialId && !profile.materials.some((entry) => entry.id === data.materialId)) {
    throw new ValidationError("The selected material is not offered by this maker.");
  }
  if (data.fulfillment === "SHIPPING" && !profile.offersShipping) {
    throw new ValidationError("This maker does not offer shipping.");
  }
  if (data.deadline && data.deadline.getTime() < Date.now()) {
    throw new ValidationError("Pick a deadline in the future.");
  }

  // Reject work that physically cannot fit the chosen machine.
  if (machine && data.dimensionsX && data.dimensionsY) {
    const volume = parseBuildVolume(machine.buildVolume);
    const part = {
      x: data.dimensionsX,
      y: data.dimensionsY,
      z: data.dimensionsZ ?? 0,
    };
    if (volume && !fitsInBuildVolume(part, volume)) {
      throw new ValidationError(
        `Those dimensions don't fit that machine's build volume (${machine.buildVolume}). Split the model or pick another machine.`,
      );
    }
  }

  // Requests create a message, so they draw on the same anti-spam budget.
  await assertMessageRateLimit(requesterId);

  const now = new Date();
  const summary = buildSummary({
    description: data.description,
    process: data.process,
    quantity: data.quantity,
    fulfillment: data.fulfillment,
    materialType: data.materialType,
    materialColor: data.materialColor,
    deadline: data.deadline,
    budget: data.budget,
    fileUrl: data.fileUrl,
    fileCount: data.fileIds.length,
  });
  const body = messageBodySchema.parse(summary.slice(0, LIMITS.messageBody));

  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        requesterId,
        providerProfileId: profile.id,
        subject: data.title,
        lastMessageAt: now,
        messages: { create: { senderId: requesterId, body } },
        request: {
          create: {
            title: data.title,
            description: data.description,
            process: data.process,
            machineId: data.machineId ?? null,
            materialId: data.materialId ?? null,
            materialType: data.materialType ?? null,
            materialColor: data.materialColor ?? null,
            quantity: data.quantity,
            fulfillment: data.fulfillment,
            budgetCents: data.budget === undefined ? null : Math.round(data.budget * 100),
            deadline: data.deadline ?? null,
            fileUrl: data.fileUrl ?? null,
            dimensionsX: data.dimensionsX ?? null,
            dimensionsY: data.dimensionsY ?? null,
            dimensionsZ: data.dimensionsZ ?? null,
            specs: data.specs ? JSON.stringify(data.specs) : null,
          },
        },
      },
      include: { request: true },
    });

    if (conversation.request && data.fileIds.length > 0) {
      await attachFilesToRequest(tx, requesterId, conversation.request.id, data.fileIds);
    }

    return conversation;
  });
}

/** The maker's incoming queue for their own profile. */
export async function listIncomingRequests(
  userId: string | null | undefined,
  status?: string,
): Promise<DetailedRequest[]> {
  const profile = await requireOwnedProfile(userId);

  return prisma.printRequest.findMany({
    where: {
      conversation: { providerProfileId: profile.id },
      ...(status && status !== "ALL" ? { status } : {}),
    },
    include: REQUEST_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
}

export async function countPendingRequests(userId: string | null | undefined) {
  if (!userId) return 0;
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return 0;

  return prisma.printRequest.count({
    where: { status: "OPEN", conversation: { providerProfileId: profile.id } },
  });
}

/** Loads one request if the caller is the maker or the customer who sent it. */
export async function getRequestForViewer(
  userId: string | null | undefined,
  requestId: string,
): Promise<{ request: DetailedRequest; role: "REQUESTER" | "PROVIDER" }> {
  const viewerId = requireUserId(userId);

  const request = await prisma.printRequest.findUnique({
    where: { id: requestId },
    include: REQUEST_INCLUDE,
  });
  if (!request) throw new NotFoundError("Request not found.");

  const isRequester = request.conversation.requesterId === viewerId;
  const isProvider = request.conversation.providerProfile.userId === viewerId;
  if (!isRequester && !isProvider) throw new NotFoundError("Request not found.");

  return { request, role: isRequester ? "REQUESTER" : "PROVIDER" };
}

const PROVIDER_DECISIONS = new Set(["ACCEPTED", "DECLINED", "COMPLETED"]);
const REQUESTER_DECISIONS = new Set(["CANCELLED"]);
const CLOSED_STATUSES = new Set(["COMPLETED", "CANCELLED", "DECLINED"]);

/**
 * Accept, decline, complete or cancel a request. Every decision also posts a
 * message into the conversation so the thread stays a complete record.
 */
export async function decideOnRequest(userId: string | null | undefined, input: unknown) {
  const actorId = requireUserId(userId);
  const parsed = requestDecisionSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());
  const data = parsed.data;

  const { request, role } = await getRequestForViewer(actorId, data.requestId);

  const allowed = role === "PROVIDER" ? PROVIDER_DECISIONS : REQUESTER_DECISIONS;
  if (!allowed.has(data.decision)) {
    throw new ForbiddenError("You cannot set that status on this request.");
  }
  if (CLOSED_STATUSES.has(request.status)) {
    throw new ValidationError("This request is already closed.");
  }
  if (data.decision === "COMPLETED" && request.status !== "ACCEPTED") {
    throw new ValidationError("Accept the request before marking it complete.");
  }
  if (data.decision === "DECLINED" && !data.declineReason) {
    throw new ValidationError("Let the customer know why you're declining.");
  }

  const noteLines: string[] = [];
  if (data.decision === "ACCEPTED") {
    noteLines.push("Request accepted.");
    if (data.quotedPrice !== undefined) noteLines.push(`Quoted price: $${data.quotedPrice.toFixed(2)}`);
    if (data.quotedLeadDays !== undefined) {
      noteLines.push(`Estimated turnaround: ${data.quotedLeadDays} day${data.quotedLeadDays === 1 ? "" : "s"}`);
    }
  } else if (data.decision === "DECLINED") {
    noteLines.push("Request declined.");
    if (data.declineReason) noteLines.push(`Reason: ${data.declineReason}`);
  } else if (data.decision === "COMPLETED") {
    noteLines.push("Request marked complete.");
  } else {
    noteLines.push("Request cancelled by the customer.");
  }
  if (data.message) noteLines.push("", data.message);

  const body = messageBodySchema.parse(noteLines.join("\n").slice(0, LIMITS.messageBody));

  return prisma.$transaction(async (tx) => {
    const updated = await tx.printRequest.update({
      where: { id: request.id },
      data: {
        status: data.decision,
        respondedAt: new Date(),
        declineReason: data.decision === "DECLINED" ? data.declineReason ?? null : null,
        quotedPriceCents:
          data.decision === "ACCEPTED" && data.quotedPrice !== undefined
            ? Math.round(data.quotedPrice * 100)
            : request.quotedPriceCents,
        quotedLeadDays:
          data.decision === "ACCEPTED" && data.quotedLeadDays !== undefined
            ? data.quotedLeadDays
            : request.quotedLeadDays,
      },
    });

    await tx.message.create({
      data: { conversationId: request.conversationId, senderId: actorId, body },
    });
    await tx.conversation.update({
      where: { id: request.conversationId },
      data: { lastMessageAt: new Date(), requesterArchived: false, providerArchived: false },
    });

    return updated;
  });
}

/** Groups a maker's requests by status for the queue tabs. */
export async function requestCountsByStatus(userId: string | null | undefined) {
  const profile = await requireOwnedProfile(userId);

  const rows = await prisma.printRequest.groupBy({
    by: ["status"],
    where: { conversation: { providerProfileId: profile.id } },
    _count: { status: true },
  });

  const counts: Record<string, number> = {
    ALL: 0,
    OPEN: 0,
    ACCEPTED: 0,
    DECLINED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const row of rows) {
    counts[row.status] = row._count.status;
    counts.ALL += row._count.status;
  }
  return counts;
}

export { parseStoredSpecs };
