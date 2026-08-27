import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { FULFILLMENT_LABELS, LIMITS, type Fulfillment } from "@/lib/constants";
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";
import {
  messageBodySchema,
  printRequestSchema,
  requestStatusSchema,
  sendMessageSchema,
  startConversationSchema,
} from "@/lib/validation";
import { requireUserId } from "./authz";

export type ConversationSummary = {
  id: string;
  subject: string;
  lastMessageAt: Date;
  unreadCount: number;
  counterpartName: string;
  counterpartImage: string | null;
  profileSlug: string;
  role: "REQUESTER" | "PROVIDER";
  requestStatus: string | null;
  preview: string;
};

const THREAD_INCLUDE = {
  messages: { orderBy: { createdAt: "asc" } },
  requester: { select: { id: true, name: true, image: true } },
  providerProfile: {
    select: {
      id: true,
      slug: true,
      displayName: true,
      avatarUrl: true,
      userId: true,
      acceptingRequests: true,
    },
  },
  request: {
    include: {
      machine: { select: { id: true, make: true, model: true } },
      material: { select: { id: true, name: true, unit: true, pricePerUnit: true } },
    },
  },
} satisfies Prisma.ConversationInclude;

export type ConversationThread = Prisma.ConversationGetPayload<{
  include: typeof THREAD_INCLUDE;
}>;

/**
 * Loads a conversation only if the caller is one of its two participants.
 * Everything in this module funnels through here, so conversation ids are not
 * guessable access tokens.
 */
async function loadParticipantConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: THREAD_INCLUDE,
  });
  if (!conversation) throw new NotFoundError("Conversation not found.");

  const isRequester = conversation.requesterId === userId;
  const isProvider = conversation.providerProfile.userId === userId;
  if (!isRequester && !isProvider) {
    // Deliberately a 404 so probing cannot confirm that an id exists.
    throw new NotFoundError("Conversation not found.");
  }

  return { conversation, role: isRequester ? ("REQUESTER" as const) : ("PROVIDER" as const) };
}

/** Simple sliding-window rate limit backed by the messages table. */
async function assertMessageRateLimit(userId: string) {
  const since = new Date(Date.now() - LIMITS.messageRateWindowMs);
  const recent = await prisma.message.count({
    where: { senderId: userId, createdAt: { gte: since } },
  });
  if (recent >= LIMITS.messageRateMax) {
    throw new RateLimitError();
  }
}

export async function startConversation(userId: string | null | undefined, input: unknown) {
  const id = requireUserId(userId);
  const parsed = startConversationSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const profile = await prisma.profile.findFirst({
    where: { slug: parsed.data.profileSlug, published: true },
  });
  if (!profile) throw new NotFoundError("That maker profile could not be found.");
  if (profile.userId === id) {
    throw new ValidationError("You cannot message your own profile.");
  }
  if (!profile.acceptingRequests) {
    throw new ValidationError("This maker is not accepting new requests right now.");
  }

  await assertMessageRateLimit(id);

  const now = new Date();
  const conversation = await prisma.conversation.create({
    data: {
      requesterId: id,
      providerProfileId: profile.id,
      subject: parsed.data.subject,
      lastMessageAt: now,
      messages: { create: { senderId: id, body: parsed.data.message } },
    },
  });

  return conversation;
}

export async function sendMessage(userId: string | null | undefined, input: unknown) {
  const id = requireUserId(userId);
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const { conversation } = await loadParticipantConversation(parsed.data.conversationId, id);
  await assertMessageRateLimit(id);

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId: conversation.id, senderId: id, body: parsed.data.body },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        requesterArchived: false,
        providerArchived: false,
      },
    }),
  ]);

  return message;
}

export async function getConversation(userId: string | null | undefined, conversationId: string) {
  const id = requireUserId(userId);
  const { conversation, role } = await loadParticipantConversation(conversationId, id);
  return { conversation, role };
}

/** Marks every message the caller did not send as read. */
export async function markConversationRead(
  userId: string | null | undefined,
  conversationId: string,
) {
  const id = requireUserId(userId);
  const { conversation } = await loadParticipantConversation(conversationId, id);
  const result = await prisma.message.updateMany({
    where: { conversationId: conversation.id, senderId: { not: id }, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function listConversations(
  userId: string | null | undefined,
): Promise<ConversationSummary[]> {
  const id = requireUserId(userId);

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ requesterId: id }, { providerProfile: { userId: id } }],
    },
    orderBy: { lastMessageAt: "desc" },
    include: {
      requester: { select: { id: true, name: true, image: true } },
      providerProfile: {
        select: { id: true, slug: true, displayName: true, avatarUrl: true, userId: true },
      },
      request: { select: { status: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: {
        select: {
          messages: { where: { senderId: { not: id }, readAt: null } },
        },
      },
    },
    take: 200,
  });

  return conversations.map((conversation) => {
    const isRequester = conversation.requesterId === id;
    return {
      id: conversation.id,
      subject: conversation.subject,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: conversation._count.messages,
      counterpartName: isRequester
        ? conversation.providerProfile.displayName
        : conversation.requester.name ?? "Customer",
      counterpartImage: isRequester
        ? conversation.providerProfile.avatarUrl
        : conversation.requester.image,
      profileSlug: conversation.providerProfile.slug,
      role: isRequester ? "REQUESTER" : "PROVIDER",
      requestStatus: conversation.request?.status ?? null,
      preview: conversation.messages[0]?.body.slice(0, 140) ?? "",
    };
  });
}

export async function unreadMessageCount(userId: string | null | undefined) {
  if (!userId) return 0;
  return prisma.message.count({
    where: {
      senderId: { not: userId },
      readAt: null,
      conversation: {
        OR: [{ requesterId: userId }, { providerProfile: { userId } }],
      },
    },
  });
}

/**
 * Creates a conversation plus an attached structured print request. Machine and
 * material ids are validated against the target profile so a request cannot
 * reference another maker's inventory.
 */
export async function createPrintRequest(userId: string | null | undefined, input: unknown) {
  const id = requireUserId(userId);
  const parsed = printRequestSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const profile = await prisma.profile.findFirst({
    where: { slug: parsed.data.profileSlug, published: true },
    include: { machines: { select: { id: true } }, materials: { select: { id: true } } },
  });
  if (!profile) throw new NotFoundError("That maker profile could not be found.");
  if (profile.userId === id) {
    throw new ValidationError("You cannot send a request to your own profile.");
  }
  if (!profile.acceptingRequests) {
    throw new ValidationError("This maker is not accepting new requests right now.");
  }

  if (parsed.data.machineId && !profile.machines.some((m) => m.id === parsed.data.machineId)) {
    throw new ValidationError("The selected machine is not offered by this maker.");
  }
  if (parsed.data.materialId && !profile.materials.some((m) => m.id === parsed.data.materialId)) {
    throw new ValidationError("The selected material is not offered by this maker.");
  }
  if (parsed.data.fulfillment === "SHIPPING" && !profile.offersShipping) {
    throw new ValidationError("This maker does not offer shipping.");
  }
  if (parsed.data.deadline && parsed.data.deadline.getTime() < Date.now()) {
    throw new ValidationError("Pick a deadline in the future.");
  }

  await assertMessageRateLimit(id);

  const summary = [
    parsed.data.description,
    "",
    `Quantity: ${parsed.data.quantity}`,
    `Fulfilment: ${FULFILLMENT_LABELS[parsed.data.fulfillment as Fulfillment]}`,
    parsed.data.deadline ? `Needed by: ${parsed.data.deadline.toISOString().slice(0, 10)}` : null,
    parsed.data.budget !== undefined ? `Budget: $${parsed.data.budget.toFixed(2)}` : null,
    parsed.data.fileUrl ? `Files: ${parsed.data.fileUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const body = messageBodySchema.parse(summary.slice(0, LIMITS.messageBody));
  const now = new Date();

  return prisma.conversation.create({
    data: {
      requesterId: id,
      providerProfileId: profile.id,
      subject: parsed.data.title,
      lastMessageAt: now,
      messages: { create: { senderId: id, body } },
      request: {
        create: {
          title: parsed.data.title,
          description: parsed.data.description,
          machineId: parsed.data.machineId ?? null,
          materialId: parsed.data.materialId ?? null,
          quantity: parsed.data.quantity,
          fulfillment: parsed.data.fulfillment,
          budgetCents:
            parsed.data.budget === undefined ? null : Math.round(parsed.data.budget * 100),
          deadline: parsed.data.deadline ?? null,
          fileUrl: parsed.data.fileUrl ?? null,
        },
      },
    },
    include: { request: true },
  });
}

const REQUESTER_ALLOWED = new Set(["CANCELLED"]);
const PROVIDER_ALLOWED = new Set(["ACCEPTED", "DECLINED", "COMPLETED"]);

/** Providers accept/decline/complete; requesters may only cancel. */
export async function updateRequestStatus(userId: string | null | undefined, input: unknown) {
  const id = requireUserId(userId);
  const parsed = requestStatusSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());

  const request = await prisma.printRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: {
      conversation: {
        select: { requesterId: true, providerProfile: { select: { userId: true } } },
      },
    },
  });
  if (!request) throw new NotFoundError("Request not found.");

  const isRequester = request.conversation.requesterId === id;
  const isProvider = request.conversation.providerProfile.userId === id;
  if (!isRequester && !isProvider) throw new NotFoundError("Request not found.");

  const allowed = isProvider ? PROVIDER_ALLOWED : REQUESTER_ALLOWED;
  if (!allowed.has(parsed.data.status)) {
    throw new ForbiddenError("You cannot set that status on this request.");
  }
  if (["COMPLETED", "CANCELLED", "DECLINED"].includes(request.status)) {
    throw new ValidationError("This request is already closed.");
  }

  return prisma.printRequest.update({
    where: { id: request.id },
    data: { status: parsed.data.status },
  });
}

export async function archiveConversation(
  userId: string | null | undefined,
  conversationId: string,
  archived = true,
) {
  const id = requireUserId(userId);
  const { conversation, role } = await loadParticipantConversation(conversationId, id);
  return prisma.conversation.update({
    where: { id: conversation.id },
    data:
      role === "REQUESTER" ? { requesterArchived: archived } : { providerArchived: archived },
  });
}
