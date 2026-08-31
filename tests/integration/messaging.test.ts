import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/constants";
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import {
  archiveConversation,
  createPrintRequest,
  getConversation,
  listConversations,
  markConversationRead,
  sendMessage,
  startConversation,
  unreadMessageCount,
  updateRequestStatus,
} from "@/lib/services/messaging";
import { createProviderWithInventory, createUser, futureDate } from "../setup/factories";

async function seedConversation() {
  const provider = await createProviderWithInventory({ slug: "ada-prints" });
  const customer = await createUser();
  const conversation = await startConversation(customer.id, {
    profileSlug: "ada-prints",
    subject: "Replacement knob",
    message: "Can you print a 24 mm knob?",
  });
  return { provider, customer, conversation };
}

describe("startConversation", () => {
  it("creates a thread with the opening message", async () => {
    const { conversation, customer, provider } = await seedConversation();

    expect(conversation.requesterId).toBe(customer.id);
    expect(conversation.providerProfileId).toBe(provider.profile.id);

    const messages = await prisma.message.findMany({ where: { conversationId: conversation.id } });
    expect(messages).toHaveLength(1);
    expect(messages[0].senderId).toBe(customer.id);
  });

  it("rejects messaging an unpublished profile", async () => {
    const provider = await createProviderWithInventory({ slug: "hidden-shop", published: false });
    const customer = await createUser();
    expect(provider.profile.published).toBe(false);

    await expect(
      startConversation(customer.id, {
        profileSlug: "hidden-shop",
        subject: "Hi",
        message: "Hello",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects messaging yourself", async () => {
    const provider = await createProviderWithInventory({ slug: "self-shop" });
    await expect(
      startConversation(provider.user.id, {
        profileSlug: "self-shop",
        subject: "Hi",
        message: "Hello",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a provider that has paused requests", async () => {
    await createProviderWithInventory({ slug: "paused-shop", acceptingRequests: false });
    const customer = await createUser();

    await expect(
      startConversation(customer.id, {
        profileSlug: "paused-shop",
        subject: "Hi",
        message: "Hello",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("requires authentication", async () => {
    await createProviderWithInventory({ slug: "open-shop" });
    await expect(
      startConversation(null, { profileSlug: "open-shop", subject: "Hi", message: "Hello" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects an empty message", async () => {
    await createProviderWithInventory({ slug: "empty-msg" });
    const customer = await createUser();
    await expect(
      startConversation(customer.id, { profileSlug: "empty-msg", subject: "Hi", message: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("conversation access control", () => {
  it("lets both participants read the thread", async () => {
    const { conversation, customer, provider } = await seedConversation();

    const asCustomer = await getConversation(customer.id, conversation.id);
    expect(asCustomer.role).toBe("REQUESTER");

    const asProvider = await getConversation(provider.user.id, conversation.id);
    expect(asProvider.role).toBe("PROVIDER");
  });

  it("hides the thread from an unrelated user as a 404, not a 403", async () => {
    const { conversation } = await seedConversation();
    const stranger = await createUser();

    await expect(getConversation(stranger.id, conversation.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("refuses anonymous access", async () => {
    const { conversation } = await seedConversation();
    await expect(getConversation(null, conversation.id)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("blocks a stranger from posting into the thread", async () => {
    const { conversation } = await seedConversation();
    const stranger = await createUser();

    await expect(
      sendMessage(stranger.id, { conversationId: conversation.id, body: "let me in" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(1);
  });

  it("blocks a stranger from archiving the thread", async () => {
    const { conversation } = await seedConversation();
    const stranger = await createUser();
    await expect(archiveConversation(stranger.id, conversation.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("blocks a stranger from marking it read", async () => {
    const { conversation } = await seedConversation();
    const stranger = await createUser();
    await expect(markConversationRead(stranger.id, conversation.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("sendMessage", () => {
  it("appends a reply and bumps lastMessageAt", async () => {
    const { conversation, provider } = await seedConversation();
    const before = await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } });

    await new Promise((resolve) => setTimeout(resolve, 5));
    await sendMessage(provider.user.id, {
      conversationId: conversation.id,
      body: "Sure, send me the dimensions.",
    });

    const after = await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } });
    expect(after.lastMessageAt.getTime()).toBeGreaterThanOrEqual(before.lastMessageAt.getTime());
    expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(2);
  });

  it("rejects a message over the length limit", async () => {
    const { conversation, provider } = await seedConversation();
    await expect(
      sendMessage(provider.user.id, {
        conversationId: conversation.id,
        body: "x".repeat(LIMITS.messageBody + 1),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects unknown extra fields", async () => {
    const { conversation, provider } = await seedConversation();
    await expect(
      sendMessage(provider.user.id, {
        conversationId: conversation.id,
        body: "hi",
        senderId: "someone-else",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("stores script-like text verbatim for React to escape", async () => {
    const { conversation, provider } = await seedConversation();
    const payload = '<img src=x onerror="alert(1)">';
    const message = await sendMessage(provider.user.id, {
      conversationId: conversation.id,
      body: payload,
    });
    expect(message.body).toBe(payload);
  });

  it("rate limits a flood of messages", async () => {
    const { conversation, provider } = await seedConversation();

    for (let i = 0; i < LIMITS.messageRateMax; i += 1) {
      await sendMessage(provider.user.id, {
        conversationId: conversation.id,
        body: `message ${i}`,
      });
    }

    await expect(
      sendMessage(provider.user.id, { conversationId: conversation.id, body: "one too many" }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("read state", () => {
  it("counts unread messages per user", async () => {
    const { conversation, customer, provider } = await seedConversation();

    expect(await unreadMessageCount(provider.user.id)).toBe(1);
    expect(await unreadMessageCount(customer.id)).toBe(0);

    await markConversationRead(provider.user.id, conversation.id);
    expect(await unreadMessageCount(provider.user.id)).toBe(0);
  });

  it("returns zero for anonymous callers", async () => {
    expect(await unreadMessageCount(null)).toBe(0);
  });

  it("does not mark your own messages as read", async () => {
    const { conversation, customer } = await seedConversation();
    const marked = await markConversationRead(customer.id, conversation.id);
    expect(marked).toBe(0);
  });
});

describe("listConversations", () => {
  it("shows the thread to both sides with the right role", async () => {
    const { customer, provider } = await seedConversation();

    const forCustomer = await listConversations(customer.id);
    expect(forCustomer).toHaveLength(1);
    expect(forCustomer[0].role).toBe("REQUESTER");
    expect(forCustomer[0].counterpartName).toBe("Test Maker");

    const forProvider = await listConversations(provider.user.id);
    expect(forProvider[0].role).toBe("PROVIDER");
    expect(forProvider[0].unreadCount).toBe(1);
  });

  it("does not leak other people's conversations", async () => {
    await seedConversation();
    const stranger = await createUser();
    expect(await listConversations(stranger.id)).toHaveLength(0);
  });
});

describe("createPrintRequest", () => {
  it("creates a conversation with a structured request", async () => {
    const provider = await createProviderWithInventory({ slug: "req-shop", offersShipping: true });
    const customer = await createUser();

    const conversation = await createPrintRequest(customer.id, {
      profileSlug: "req-shop",
      title: "Cosplay pauldron",
      description: "Two halves, PLA, sanded finish.",
      machineId: provider.machine.id,
      materialId: provider.material.id,
      quantity: 2,
      fulfillment: "SHIPPING",
      budget: 60,
      deadline: futureDate(21),
    });

    expect(conversation.request?.title).toBe("Cosplay pauldron");
    expect(conversation.request?.budgetCents).toBe(6000);
    expect(conversation.request?.status).toBe("OPEN");
    expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(1);
  });

  it("rejects a machine from a different provider", async () => {
    await createProviderWithInventory({ slug: "target-shop" });
    const other = await createProviderWithInventory({ slug: "other-shop" });
    const customer = await createUser();

    await expect(
      createPrintRequest(customer.id, {
        profileSlug: "target-shop",
        title: "Thing",
        description: "A thing",
        machineId: other.machine.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a material from a different provider", async () => {
    await createProviderWithInventory({ slug: "target-two" });
    const other = await createProviderWithInventory({ slug: "other-two" });
    const customer = await createUser();

    await expect(
      createPrintRequest(customer.id, {
        profileSlug: "target-two",
        title: "Thing",
        description: "A thing",
        materialId: other.material.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects shipping when the provider does not ship", async () => {
    await createProviderWithInventory({ slug: "pickup-only", offersShipping: false });
    const customer = await createUser();

    await expect(
      createPrintRequest(customer.id, {
        profileSlug: "pickup-only",
        title: "Thing",
        description: "A thing",
        fulfillment: "SHIPPING",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a deadline in the past", async () => {
    await createProviderWithInventory({ slug: "deadline-shop" });
    const customer = await createUser();

    await expect(
      createPrintRequest(customer.id, {
        profileSlug: "deadline-shop",
        title: "Thing",
        description: "A thing",
        deadline: futureDate(-5),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects sending a request to your own profile", async () => {
    const provider = await createProviderWithInventory({ slug: "mine-shop" });
    await expect(
      createPrintRequest(provider.user.id, {
        profileSlug: "mine-shop",
        title: "Thing",
        description: "A thing",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("updateRequestStatus", () => {
  async function seedRequest() {
    const provider = await createProviderWithInventory({ slug: "status-shop" });
    const customer = await createUser();
    const conversation = await createPrintRequest(customer.id, {
      profileSlug: "status-shop",
      title: "Bracket",
      description: "A small bracket",
    });
    return { provider, customer, request: conversation.request! };
  }

  it("lets the provider accept", async () => {
    const { provider, request } = await seedRequest();
    const updated = await updateRequestStatus(provider.user.id, {
      requestId: request.id,
      status: "ACCEPTED",
    });
    expect(updated.status).toBe("ACCEPTED");
  });

  it("lets the requester cancel", async () => {
    const { customer, request } = await seedRequest();
    const updated = await updateRequestStatus(customer.id, {
      requestId: request.id,
      status: "CANCELLED",
    });
    expect(updated.status).toBe("CANCELLED");
  });

  it("stops the requester from accepting their own request", async () => {
    const { customer, request } = await seedRequest();
    await expect(
      updateRequestStatus(customer.id, { requestId: request.id, status: "ACCEPTED" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("stops the provider from cancelling on the requester's behalf", async () => {
    const { provider, request } = await seedRequest();
    await expect(
      updateRequestStatus(provider.user.id, { requestId: request.id, status: "CANCELLED" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("hides the request from unrelated users", async () => {
    const { request } = await seedRequest();
    const stranger = await createUser();
    await expect(
      updateRequestStatus(stranger.id, { requestId: request.id, status: "ACCEPTED" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses to reopen a closed request", async () => {
    const { provider, request } = await seedRequest();
    await updateRequestStatus(provider.user.id, { requestId: request.id, status: "COMPLETED" });

    await expect(
      updateRequestStatus(provider.user.id, { requestId: request.id, status: "ACCEPTED" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an invalid status value", async () => {
    const { provider, request } = await seedRequest();
    await expect(
      updateRequestStatus(provider.user.id, { requestId: request.id, status: "REFUNDED" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
