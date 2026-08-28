import { rm } from "node:fs/promises";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import {
  countPendingRequests,
  createDetailedRequest,
  decideOnRequest,
  getRequestForViewer,
  listIncomingRequests,
  requestCountsByStatus,
} from "@/lib/services/requests";
import {
  UPLOAD_ROOT,
  deleteUpload,
  getAccessibleFile,
  listPendingUploads,
  storeUpload,
} from "@/lib/services/uploads";
import { parseStoredSpecs } from "@/lib/validation";
import { createProviderWithInventory, createUser, futureDate } from "../setup/factories";

afterAll(async () => {
  await rm(path.join(UPLOAD_ROOT), { recursive: true, force: true });
});

const bytes = (content = "solid model\n") => Buffer.from(content, "utf8");

const baseRequest = (overrides: Record<string, unknown> = {}) => ({
  profileSlug: "spec-shop",
  title: "Drone frame",
  description: "A 5-inch quad frame, printed in one piece.",
  process: "FDM",
  quantity: 1,
  fulfillment: "PICKUP",
  ...overrides,
});

const fdmSpecs = (overrides: Record<string, unknown> = {}) => ({
  process: "FDM",
  layerHeightMm: 0.2,
  nozzleMm: 0.4,
  infillPercent: 40,
  infillPattern: "GYROID",
  wallCount: 4,
  topBottomLayers: 5,
  supportType: "TREE",
  bedAdhesion: "BRIM",
  ...overrides,
});

describe("createDetailedRequest", () => {
  it("stores the full specification", async () => {
    const provider = await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();

    const conversation = await createDetailedRequest(
      customer.id,
      baseRequest({
        machineId: provider.machine.id,
        materialId: provider.material.id,
        materialType: "PETG",
        materialColor: "Black",
        specs: fdmSpecs(),
        dimensionsX: 120,
        dimensionsY: 100,
        dimensionsZ: 30,
      }),
    );

    const request = conversation.request!;
    expect(request.process).toBe("FDM");
    expect(request.materialType).toBe("PETG");
    expect(request.dimensionsX).toBe(120);

    const specs = parseStoredSpecs(request.specs);
    expect(specs).toMatchObject({
      process: "FDM",
      layerHeightMm: 0.2,
      infillPercent: 40,
      supportType: "TREE",
    });
  });

  it("puts the process and material into the opening message", async () => {
    await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();

    const conversation = await createDetailedRequest(
      customer.id,
      baseRequest({ materialType: "PLA", materialColor: "Red" }),
    );

    const message = await prisma.message.findFirstOrThrow({
      where: { conversationId: conversation.id },
    });
    expect(message.body).toContain("FDM 3D printing");
    expect(message.body).toContain("PLA (Red)");
  });

  it("rejects a spec block that disagrees with the process", async () => {
    await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();

    await expect(
      createDetailedRequest(
        customer.id,
        baseRequest({ process: "LASER_CUT", specs: fdmSpecs() }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a layer height the nozzle cannot produce", async () => {
    await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();

    await expect(
      createDetailedRequest(
        customer.id,
        baseRequest({ specs: fdmSpecs({ layerHeightMm: 0.4, nozzleMm: 0.4 }) }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a part that cannot fit the chosen machine", async () => {
    const provider = await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();

    // The seeded machine is a Bambu X1C at 256 x 256 x 256 mm.
    await expect(
      createDetailedRequest(
        customer.id,
        baseRequest({
          machineId: provider.machine.id,
          dimensionsX: 400,
          dimensionsY: 100,
          dimensionsZ: 50,
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts a part that fits once rotated", async () => {
    const provider = await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();

    const conversation = await createDetailedRequest(
      customer.id,
      baseRequest({
        machineId: provider.machine.id,
        dimensionsX: 200,
        dimensionsY: 250,
        dimensionsZ: 50,
      }),
    );
    expect(conversation.request?.id).toBeTruthy();
  });

  it("attaches the customer's own uploaded files", async () => {
    await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();

    const file = await storeUpload(customer.id, { filename: "frame.stl", bytes: bytes() });
    const conversation = await createDetailedRequest(
      customer.id,
      baseRequest({ fileIds: [file.id] }),
    );

    const attached = await prisma.requestFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(attached.requestId).toBe(conversation.request!.id);
  });

  it("silently ignores file ids belonging to someone else", async () => {
    await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();
    const stranger = await createUser();

    const foreign = await storeUpload(stranger.id, { filename: "secret.stl", bytes: bytes() });
    await createDetailedRequest(customer.id, baseRequest({ fileIds: [foreign.id] }));

    const untouched = await prisma.requestFile.findUniqueOrThrow({ where: { id: foreign.id } });
    expect(untouched.requestId).toBeNull();
  });

  it("still supports the lightweight request without a process", async () => {
    await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();

    const conversation = await createDetailedRequest(customer.id, {
      profileSlug: "spec-shop",
      title: "Quick ask",
      description: "Can you print this small bracket?",
    });
    expect(conversation.request?.process).toBe("OTHER");
  });

  it("requires authentication", async () => {
    await createProviderWithInventory({ slug: "spec-shop" });
    await expect(createDetailedRequest(null, baseRequest())).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe("maker request queue", () => {
  async function seedQueue() {
    const provider = await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();
    const conversation = await createDetailedRequest(
      customer.id,
      baseRequest({ specs: fdmSpecs() }),
    );
    return { provider, customer, request: conversation.request! };
  }

  it("lists incoming requests for the maker", async () => {
    const { provider } = await seedQueue();
    const queue = await listIncomingRequests(provider.user.id);

    expect(queue).toHaveLength(1);
    expect(queue[0].conversation.requester.name).toBeTruthy();
    expect(queue[0].files).toEqual([]);
  });

  it("filters by status", async () => {
    const { provider } = await seedQueue();
    expect(await listIncomingRequests(provider.user.id, "OPEN")).toHaveLength(1);
    expect(await listIncomingRequests(provider.user.id, "COMPLETED")).toHaveLength(0);
  });

  it("does not leak another maker's queue", async () => {
    await seedQueue();
    const other = await createProviderWithInventory({ slug: "other-shop" });
    expect(await listIncomingRequests(other.user.id)).toHaveLength(0);
  });

  it("counts pending requests", async () => {
    const { provider, customer } = await seedQueue();
    expect(await countPendingRequests(provider.user.id)).toBe(1);
    expect(await countPendingRequests(customer.id)).toBe(0);
    expect(await countPendingRequests(null)).toBe(0);
  });

  it("groups counts by status", async () => {
    const { provider, request } = await seedQueue();
    await decideOnRequest(provider.user.id, { requestId: request.id, decision: "ACCEPTED" });

    const counts = await requestCountsByStatus(provider.user.id);
    expect(counts.ALL).toBe(1);
    expect(counts.ACCEPTED).toBe(1);
    expect(counts.OPEN).toBe(0);
  });

  it("shows the request to both parties but nobody else", async () => {
    const { provider, customer, request } = await seedQueue();

    expect((await getRequestForViewer(provider.user.id, request.id)).role).toBe("PROVIDER");
    expect((await getRequestForViewer(customer.id, request.id)).role).toBe("REQUESTER");

    const stranger = await createUser();
    await expect(getRequestForViewer(stranger.id, request.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("decideOnRequest", () => {
  async function seedRequest() {
    const provider = await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();
    const conversation = await createDetailedRequest(customer.id, baseRequest());
    return { provider, customer, request: conversation.request!, conversationId: conversation.id };
  }

  it("accepts with a quote and posts it into the chat", async () => {
    const { provider, request, conversationId } = await seedRequest();

    const updated = await decideOnRequest(provider.user.id, {
      requestId: request.id,
      decision: "ACCEPTED",
      quotedPrice: 42.5,
      quotedLeadDays: 3,
      message: "I can start on Thursday.",
    });

    expect(updated.status).toBe("ACCEPTED");
    expect(updated.quotedPriceCents).toBe(4250);
    expect(updated.quotedLeadDays).toBe(3);

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    const last = messages[messages.length - 1];
    expect(last.body).toContain("Request accepted");
    expect(last.body).toContain("$42.50");
    expect(last.body).toContain("I can start on Thursday.");
  });

  it("requires a reason when declining", async () => {
    const { provider, request } = await seedRequest();
    await expect(
      decideOnRequest(provider.user.id, { requestId: request.id, decision: "DECLINED" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("records the decline reason and shares it", async () => {
    const { provider, request, conversationId } = await seedRequest();

    const updated = await decideOnRequest(provider.user.id, {
      requestId: request.id,
      decision: "DECLINED",
      declineReason: "My printer is down for maintenance this month.",
    });

    expect(updated.status).toBe("DECLINED");
    expect(updated.declineReason).toContain("maintenance");

    const last = await prisma.message.findFirstOrThrow({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
    });
    expect(last.body).toContain("maintenance");
  });

  it("will not complete a request that was never accepted", async () => {
    const { provider, request } = await seedRequest();
    await expect(
      decideOnRequest(provider.user.id, { requestId: request.id, decision: "COMPLETED" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("completes an accepted request", async () => {
    const { provider, request } = await seedRequest();
    await decideOnRequest(provider.user.id, { requestId: request.id, decision: "ACCEPTED" });

    const completed = await decideOnRequest(provider.user.id, {
      requestId: request.id,
      decision: "COMPLETED",
    });
    expect(completed.status).toBe("COMPLETED");
  });

  it("lets the customer cancel but not accept", async () => {
    const { customer, request } = await seedRequest();

    await expect(
      decideOnRequest(customer.id, { requestId: request.id, decision: "ACCEPTED" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const cancelled = await decideOnRequest(customer.id, {
      requestId: request.id,
      decision: "CANCELLED",
    });
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("stops the maker cancelling on the customer's behalf", async () => {
    const { provider, request } = await seedRequest();
    await expect(
      decideOnRequest(provider.user.id, { requestId: request.id, decision: "CANCELLED" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses to reopen a closed request", async () => {
    const { provider, customer, request } = await seedRequest();
    await decideOnRequest(customer.id, { requestId: request.id, decision: "CANCELLED" });

    await expect(
      decideOnRequest(provider.user.id, { requestId: request.id, decision: "ACCEPTED" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("hides the request from unrelated users", async () => {
    const { request } = await seedRequest();
    const stranger = await createUser();

    await expect(
      decideOnRequest(stranger.id, { requestId: request.id, decision: "ACCEPTED" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("uploads", () => {
  it("stores a design file for the caller", async () => {
    const user = await createUser();
    const file = await storeUpload(user.id, { filename: "part.stl", bytes: bytes() });

    expect(file.uploaderId).toBe(user.id);
    expect(file.requestId).toBeNull();
    expect(file.filename).toBe("part.stl");
    expect(file.storageKey).toContain(user.id);
    expect(file.sizeBytes).toBeGreaterThan(0);
  });

  it("rejects an unsupported extension", async () => {
    const user = await createUser();
    await expect(
      storeUpload(user.id, { filename: "payload.exe", bytes: bytes() }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a file with no extension", async () => {
    const user = await createUser();
    await expect(
      storeUpload(user.id, { filename: "noextension", bytes: bytes() }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an empty file", async () => {
    const user = await createUser();
    await expect(
      storeUpload(user.id, { filename: "empty.stl", bytes: Buffer.alloc(0) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a file over the size cap", async () => {
    const user = await createUser();
    await expect(
      storeUpload(user.id, { filename: "huge.stl", bytes: Buffer.alloc(51 * 1024 * 1024) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("caps how many files can be staged at once", async () => {
    const user = await createUser();
    for (let index = 0; index < 10; index += 1) {
      await storeUpload(user.id, { filename: `part-${index}.stl`, bytes: bytes() });
    }
    await expect(
      storeUpload(user.id, { filename: "one-too-many.stl", bytes: bytes() }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lists only the caller's staged files", async () => {
    const user = await createUser();
    const other = await createUser();
    await storeUpload(user.id, { filename: "mine.stl", bytes: bytes() });
    await storeUpload(other.id, { filename: "theirs.stl", bytes: bytes() });

    const mine = await listPendingUploads(user.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].filename).toBe("mine.stl");
  });

  it("lets the uploader download their own file", async () => {
    const user = await createUser();
    const file = await storeUpload(user.id, { filename: "part.stl", bytes: bytes() });
    await expect(getAccessibleFile(user.id, file.id)).resolves.toMatchObject({ id: file.id });
  });

  it("hides an unattached file from everyone else", async () => {
    const user = await createUser();
    const stranger = await createUser();
    const file = await storeUpload(user.id, { filename: "part.stl", bytes: bytes() });

    await expect(getAccessibleFile(stranger.id, file.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lets the maker download a file once it is attached to their request", async () => {
    const provider = await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();
    const file = await storeUpload(customer.id, { filename: "part.stl", bytes: bytes() });

    await createDetailedRequest(customer.id, baseRequest({ fileIds: [file.id] }));

    await expect(getAccessibleFile(provider.user.id, file.id)).resolves.toMatchObject({
      id: file.id,
    });

    const stranger = await createUser();
    await expect(getAccessibleFile(stranger.id, file.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lets the uploader delete a staged file", async () => {
    const user = await createUser();
    const file = await storeUpload(user.id, { filename: "part.stl", bytes: bytes() });

    await deleteUpload(user.id, file.id);
    expect(await prisma.requestFile.count({ where: { id: file.id } })).toBe(0);
  });

  it("stops someone else deleting a staged file", async () => {
    const user = await createUser();
    const stranger = await createUser();
    const file = await storeUpload(user.id, { filename: "part.stl", bytes: bytes() });

    await expect(deleteUpload(stranger.id, file.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.requestFile.count({ where: { id: file.id } })).toBe(1);
  });

  it("refuses to delete a file already attached to a request", async () => {
    await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();
    const file = await storeUpload(customer.id, { filename: "part.stl", bytes: bytes() });
    await createDetailedRequest(customer.id, baseRequest({ fileIds: [file.id] }));

    await expect(deleteUpload(customer.id, file.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("removes files when the request is deleted", async () => {
    await createProviderWithInventory({ slug: "spec-shop" });
    const customer = await createUser();
    const file = await storeUpload(customer.id, { filename: "part.stl", bytes: bytes() });
    const conversation = await createDetailedRequest(
      customer.id,
      baseRequest({ fileIds: [file.id], deadline: futureDate(10) }),
    );

    await prisma.conversation.delete({ where: { id: conversation.id } });
    expect(await prisma.requestFile.count({ where: { id: file.id } })).toBe(0);
  });
});
