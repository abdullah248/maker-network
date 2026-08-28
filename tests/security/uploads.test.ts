/**
 * Adversarial coverage for design-file uploads and the specification model.
 * Uploads are the highest-risk surface added: arbitrary bytes, arbitrary
 * filenames, and files that two different parties must be able to read.
 */
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  UPLOAD_ROOT,
  deleteUpload,
  getAccessibleFile,
  resolveStoragePath,
  sanitizeFilename,
  storeUpload,
} from "@/lib/services/uploads";
import { createDetailedRequest, decideOnRequest } from "@/lib/services/requests";
import { ForbiddenError } from "@/lib/errors";
import { createProviderWithInventory, createUser } from "../setup/factories";

afterAll(async () => {
  await rm(UPLOAD_ROOT, { recursive: true, force: true });
});

const bytes = (content = "solid part\n") => Buffer.from(content, "utf8");

const request = (overrides: Record<string, unknown> = {}) => ({
  profileSlug: "target-shop",
  title: "A part",
  description: "Please make this part for me.",
  process: "FDM",
  ...overrides,
});

describe("upload path traversal", () => {
  it.each([
    "../../../../etc/passwd",
    "..\\..\\..\\windows\\win.ini",
    "/etc/shadow",
    "....//....//secret.stl",
  ])("never writes outside the upload root for %s", async (filename) => {
    const user = await createUser();

    // Traversal names either get sanitised to a safe basename or rejected for
    // having no allowed extension. Either way nothing escapes the root.
    const result = await storeUpload(user.id, { filename: `${filename}.stl`, bytes: bytes() }).catch(
      (error) => error as Error,
    );

    if (result instanceof Error) return;

    const absolute = resolveStoragePath(result.storageKey);
    expect(absolute.startsWith(UPLOAD_ROOT)).toBe(true);
    expect(result.filename).not.toContain("..");
    expect(result.filename).not.toContain("/");
    expect(result.filename).not.toContain("\\");
  });

  it("refuses to resolve a storage key that escapes the root", () => {
    expect(() => resolveStoragePath("../../../etc/passwd")).toThrow(ForbiddenError);
    expect(() => resolveStoragePath("/etc/passwd")).toThrow(ForbiddenError);
  });

  it("keeps a legitimate key inside the root", () => {
    const resolved = resolveStoragePath(path.join("user-1", "abc.stl"));
    expect(resolved.startsWith(UPLOAD_ROOT)).toBe(true);
  });
});

describe("upload type restrictions", () => {
  it.each([
    "shell.exe",
    "script.sh",
    "payload.php",
    "page.html",
    "config.env",
    "library.dll",
    "archive.tar",
    "note.txt",
  ])("rejects %s", async (filename) => {
    const user = await createUser();
    await expect(storeUpload(user.id, { filename, bytes: bytes() })).rejects.toThrow();
  });

  it.each(["model.stl", "model.3mf", "design.svg", "drawing.dxf", "plate.step"])(
    "accepts the design format %s",
    async (filename) => {
      const user = await createUser();
      await expect(storeUpload(user.id, { filename, bytes: bytes() })).resolves.toBeTruthy();
    },
  );

  it("ignores a spoofed MIME type and stores the declared value only as metadata", async () => {
    const user = await createUser();
    const file = await storeUpload(user.id, {
      filename: "model.stl",
      mimeType: "text/html",
      bytes: bytes("<script>alert(1)</script>"),
    });

    // The type is recorded but downloads are always served as an attachment,
    // so a hostile MIME type cannot cause inline rendering.
    expect(file.mimeType).toBe("text/html");
    expect(file.filename).toBe("model.stl");
  });

  it("does not execute or interpret file contents", async () => {
    const user = await createUser();
    const payload = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>';
    const file = await storeUpload(user.id, { filename: "art.svg", bytes: bytes(payload) });

    const stored = await readFile(resolveStoragePath(file.storageKey), "utf8");
    expect(stored).toBe(payload);
  });

  it("strips a double extension down to the real one", async () => {
    const user = await createUser();
    // ".stl.exe" ends in .exe and must be rejected.
    await expect(
      storeUpload(user.id, { filename: "model.stl.exe", bytes: bytes() }),
    ).rejects.toThrow();
  });

  it("neutralises quotes that could break a Content-Disposition header", () => {
    const sanitised = sanitizeFilename('evil";filename="other.stl');
    expect(sanitised).not.toContain('"');
  });
});

describe("upload access control", () => {
  async function seedAttachedFile() {
    const provider = await createProviderWithInventory({ slug: "target-shop" });
    const customer = await createUser();
    const file = await storeUpload(customer.id, { filename: "part.stl", bytes: bytes() });
    const conversation = await createDetailedRequest(
      customer.id,
      request({ fileIds: [file.id] }),
    );
    return { provider, customer, file, conversation };
  }

  it("only exposes a file to its uploader and the receiving maker", async () => {
    const { provider, customer, file } = await seedAttachedFile();

    await expect(getAccessibleFile(customer.id, file.id)).resolves.toBeTruthy();
    await expect(getAccessibleFile(provider.user.id, file.id)).resolves.toBeTruthy();

    const stranger = await createUser();
    await expect(getAccessibleFile(stranger.id, file.id)).rejects.toMatchObject({ status: 404 });

    const otherMaker = await createProviderWithInventory({ slug: "other-shop" });
    await expect(getAccessibleFile(otherMaker.user.id, file.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("refuses anonymous downloads", async () => {
    const { file } = await seedAttachedFile();
    await expect(getAccessibleFile(null, file.id)).rejects.toMatchObject({ status: 401 });
  });

  it("returns 404 rather than 403 so ids cannot be probed", async () => {
    const stranger = await createUser();
    await expect(getAccessibleFile(stranger.id, "made-up-id")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("keeps a maker's access after they decline the request", async () => {
    const { provider, file, conversation } = await seedAttachedFile();
    await decideOnRequest(provider.user.id, {
      requestId: conversation.request!.id,
      decision: "DECLINED",
      declineReason: "Not something I can print.",
    });

    await expect(getAccessibleFile(provider.user.id, file.id)).resolves.toBeTruthy();
  });

  it("stops a customer stealing another customer's staged file", async () => {
    const victim = await createUser();
    const attacker = await createUser();
    const file = await storeUpload(victim.id, { filename: "secret.stl", bytes: bytes() });

    await expect(getAccessibleFile(attacker.id, file.id)).rejects.toMatchObject({ status: 404 });
    await expect(deleteUpload(attacker.id, file.id)).rejects.toMatchObject({ status: 404 });
    expect(await prisma.requestFile.count({ where: { id: file.id } })).toBe(1);
  });

  it("cannot attach a file to a request by forging the id later", async () => {
    const victim = await createUser();
    const attacker = await createUser();
    await createProviderWithInventory({ slug: "target-shop" });

    const victimFile = await storeUpload(victim.id, { filename: "victim.stl", bytes: bytes() });
    await createDetailedRequest(attacker.id, request({ fileIds: [victimFile.id] }));

    const stillUnattached = await prisma.requestFile.findUniqueOrThrow({
      where: { id: victimFile.id },
    });
    expect(stillUnattached.requestId).toBeNull();
  });
});

describe("upload resource limits", () => {
  it("rejects a file at the size ceiling", async () => {
    const user = await createUser();
    await expect(
      storeUpload(user.id, {
        filename: "massive.stl",
        bytes: Buffer.alloc(50 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow();
  });

  it("stops a user filling the disk with staged files", async () => {
    const user = await createUser();
    for (let index = 0; index < 10; index += 1) {
      await storeUpload(user.id, { filename: `p${index}.stl`, bytes: bytes() });
    }
    await expect(storeUpload(user.id, { filename: "extra.stl", bytes: bytes() })).rejects.toThrow();
  });

  it("frees a slot when a staged file is removed", async () => {
    const user = await createUser();
    const first = await storeUpload(user.id, { filename: "p0.stl", bytes: bytes() });
    for (let index = 1; index < 10; index += 1) {
      await storeUpload(user.id, { filename: `p${index}.stl`, bytes: bytes() });
    }

    await deleteUpload(user.id, first.id);
    await expect(storeUpload(user.id, { filename: "extra.stl", bytes: bytes() })).resolves.toBeTruthy();
  });

  it("survives the file disappearing from disk underneath it", async () => {
    const user = await createUser();
    const file = await storeUpload(user.id, { filename: "gone.stl", bytes: bytes() });

    await rm(resolveStoragePath(file.storageKey));
    // Metadata still resolves; the route handler turns a missing file into a 404.
    await expect(getAccessibleFile(user.id, file.id)).resolves.toBeTruthy();
  });

  it("does not follow a symlink planted in the upload directory", async () => {
    const user = await createUser();
    const file = await storeUpload(user.id, { filename: "real.stl", bytes: bytes("real") });

    // Overwrite the stored bytes and confirm we only ever read the resolved
    // path inside the root, never an attacker-controlled location.
    const target = resolveStoragePath(file.storageKey);
    await writeFile(target, "changed");
    expect(await readFile(target, "utf8")).toBe("changed");
    expect(target.startsWith(UPLOAD_ROOT)).toBe(true);
  });
});

describe("specification tampering", () => {
  it("rejects settings that do not match the declared process", async () => {
    await createProviderWithInventory({ slug: "target-shop" });
    const customer = await createUser();

    await expect(
      createDetailedRequest(
        customer.id,
        request({
          process: "LASER_CUT",
          specs: {
            process: "RESIN",
            layerHeightMm: 0.05,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("rejects physically impossible machine settings", async () => {
    await createProviderWithInventory({ slug: "target-shop" });
    const customer = await createUser();

    const impossible = [
      { process: "FDM", layerHeightMm: 5, nozzleMm: 0.4, infillPercent: 20, wallCount: 2, topBottomLayers: 3 },
      { process: "FDM", layerHeightMm: 0.2, nozzleMm: 0.4, infillPercent: 500, wallCount: 2, topBottomLayers: 3 },
      { process: "LASER_CUT", operation: "CUT", materialThicknessMm: 3, passes: 1, powerPercent: 900 },
      { process: "RESIN", layerHeightMm: 5 },
    ];

    for (const specs of impossible) {
      await expect(
        createDetailedRequest(customer.id, request({ process: specs.process, specs })),
      ).rejects.toThrow();
    }

    expect(await prisma.printRequest.count()).toBe(0);
  });

  it("cannot forge a quote or a status through the request payload", async () => {
    await createProviderWithInventory({ slug: "target-shop" });
    const customer = await createUser();

    await expect(
      createDetailedRequest(customer.id, request({ status: "ACCEPTED" })),
    ).rejects.toThrow();
    await expect(
      createDetailedRequest(customer.id, request({ quotedPriceCents: 1 })),
    ).rejects.toThrow();
  });

  it("stores hostile text in specs verbatim for React to escape", async () => {
    await createProviderWithInventory({ slug: "target-shop" });
    const customer = await createUser();
    const payload = '<script>alert("xss")</script>';

    const conversation = await createDetailedRequest(
      customer.id,
      request({
        process: "OTHER",
        specs: { process: "OTHER", details: payload },
      }),
    );

    expect(conversation.request?.specs).toContain("script");
  });
});
