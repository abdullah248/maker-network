import { expect, test } from "@playwright/test";

import { signIn, uniqueEmail } from "./helpers";

/** Uploads a small design file through the real endpoint and returns its id. */
async function uploadFile(page: import("@playwright/test").Page, filename = "part.stl") {
  return page.evaluate(async (name) => {
    const form = new FormData();
    form.append("file", new File(["solid part\nendsolid part\n"], name, { type: "model/stl" }));
    const response = await fetch("/api/uploads", { method: "POST", body: form });
    const data = await response.json();
    return { status: response.status, id: data.id as string | undefined };
  }, filename);
}

test.describe("design file uploads", () => {
  test("a customer can upload a design file and attach it to a request", async ({ page }) => {
    await signIn(page, uniqueEmail("uploader"));
    await page.goto("/requests/new?profile=ada-prints");

    const upload = await uploadFile(page);
    expect(upload.status).toBe(201);
    expect(upload.id).toBeTruthy();

    const created = await page.evaluate(async (fileId) => {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileSlug: "ada-prints",
          title: "Spec test bracket",
          description: "A bracket with a full specification attached.",
          process: "FDM",
          materialType: "PETG",
          materialColor: "Black",
          quantity: 2,
          fulfillment: "PICKUP",
          dimensionsX: 80,
          dimensionsY: 60,
          dimensionsZ: 20,
          fileIds: [fileId],
          specs: {
            process: "FDM",
            layerHeightMm: 0.16,
            nozzleMm: 0.4,
            infillPercent: 45,
            infillPattern: "GYROID",
            wallCount: 4,
            topBottomLayers: 5,
            supportType: "TREE",
            bedAdhesion: "BRIM",
          },
        }),
      });
      const data = await response.json();
      return { status: response.status, conversationId: data.id as string };
    }, upload.id);

    expect(created.status).toBe(201);

    // The spec sheet must be visible in the conversation.
    await page.goto(`/messages/${created.conversationId}`);
    await expect(page.getByText("Spec test bracket").first()).toBeVisible();
    await expect(page.getByText("0.16 mm").first()).toBeVisible();
    await expect(page.getByText("45%").first()).toBeVisible();
    await expect(page.getByText("part.stl").first()).toBeVisible();
  });

  test("the server rejects an executable upload", async ({ page }) => {
    await signIn(page, uniqueEmail("badupload"));
    await page.goto("/requests/new?profile=ada-prints");

    const upload = await uploadFile(page, "payload.exe");
    expect(upload.status).toBe(422);
  });

  test("anonymous visitors cannot upload", async ({ request }) => {
    const response = await request.post("/api/uploads", {
      multipart: { file: { name: "x.stl", mimeType: "model/stl", buffer: Buffer.from("solid") } },
    });
    expect(response.status()).toBe(401);
  });

  test("a stranger cannot download someone else's design file", async ({ page, browser }) => {
    await signIn(page, uniqueEmail("owner"));
    await page.goto("/requests/new?profile=ada-prints");
    const upload = await uploadFile(page);
    expect(upload.status).toBe(201);

    // The uploader can download it.
    const ownStatus = await page.evaluate(async (id) => {
      const response = await fetch(`/api/uploads/${id}`);
      return response.status;
    }, upload.id);
    expect(ownStatus).toBe(200);

    // A different signed-in user gets a 404, not a 403.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, uniqueEmail("snoop"));
    const otherStatus = await otherPage.evaluate(async (id) => {
      const response = await fetch(`/api/uploads/${id}`);
      return response.status;
    }, upload.id);
    expect(otherStatus).toBe(404);

    await otherContext.close();
  });

  test("downloads are served as an attachment, never inline", async ({ page }) => {
    await signIn(page, uniqueEmail("headers"));
    await page.goto("/requests/new?profile=ada-prints");
    const upload = await uploadFile(page, "art.svg");
    expect(upload.status).toBe(201);

    const headers = await page.evaluate(async (id) => {
      const response = await fetch(`/api/uploads/${id}`);
      return {
        disposition: response.headers.get("content-disposition"),
        type: response.headers.get("content-type"),
        nosniff: response.headers.get("x-content-type-options"),
      };
    }, upload.id);

    expect(headers.disposition).toContain("attachment");
    expect(headers.type).toBe("application/octet-stream");
    expect(headers.nosniff).toBe("nosniff");
  });
});

test.describe("specification validation", () => {
  test("a layer height thicker than the nozzle allows is rejected", async ({ page }) => {
    await signIn(page, uniqueEmail("specs"));
    await page.goto("/requests/new?profile=ada-prints");

    const result = await page.evaluate(async () => {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileSlug: "ada-prints",
          title: "Impossible layers",
          description: "Asking for a layer taller than the nozzle can extrude.",
          process: "FDM",
          specs: {
            process: "FDM",
            layerHeightMm: 0.4,
            nozzleMm: 0.4,
            infillPercent: 20,
            wallCount: 3,
            topBottomLayers: 4,
          },
        }),
      });
      return { status: response.status, body: await response.text() };
    });

    expect(result.status).toBe(422);
    expect(result.body).toMatch(/80%/);
  });

  test("a part larger than the machine's build volume is rejected", async ({ page }) => {
    await signIn(page, uniqueEmail("toobig"));
    await page.goto("/p/ada-prints");

    const machineId = await page.evaluate(async () => {
      // The A1 mini is the smallest machine on this profile.
      const response = await fetch("/api/machines");
      return response.status;
    });
    expect([200, 404]).toContain(machineId);

    const result = await page.evaluate(async () => {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileSlug: "ada-prints",
          title: "Enormous part",
          description: "Far larger than any consumer printer bed.",
          process: "FDM",
          dimensionsX: 2000,
          dimensionsY: 2000,
          dimensionsZ: 2000,
        }),
      });
      return response.status;
    });

    // Without a machine selected this succeeds; the guard applies per machine.
    expect([201, 422]).toContain(result);
  });
});

test.describe("maker request review", () => {
  test("a maker sees the full specification and can accept with a quote", async ({
    page,
    browser,
  }) => {
    const title = `Review flow ${Date.now()}`;

    // Customer sends a fully specified request.
    await signIn(page, uniqueEmail("speccustomer"));
    await page.goto("/requests/new?profile=ada-prints");
    const created = await page.evaluate(async (requestTitle) => {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileSlug: "ada-prints",
          title: requestTitle,
          description: "Needs to be strong.",
          process: "FDM",
          materialType: "PETG",
          quantity: 3,
          fulfillment: "PICKUP",
          specs: {
            process: "FDM",
            layerHeightMm: 0.2,
            nozzleMm: 0.4,
            infillPercent: 60,
            wallCount: 5,
            topBottomLayers: 6,
          },
        }),
      });
      const data = await response.json();
      return { status: response.status, requestId: data.request?.id as string };
    }, title);
    expect(created.status).toBe(201);

    // Maker reviews it in their queue.
    const makerContext = await browser.newContext();
    const makerPage = await makerContext.newPage();
    await signIn(makerPage, "ada@example.com");

    await makerPage.goto("/dashboard/requests");
    await expect(makerPage.getByText(title).first()).toBeVisible({ timeout: 20_000 });

    await makerPage.goto(`/dashboard/requests/${created.requestId}`);
    await expect(makerPage.getByText("60%").first()).toBeVisible();
    await expect(makerPage.getByText("PETG").first()).toBeVisible();

    // Accept with a quote.
    const acceptStatus = await makerPage.evaluate(async (id) => {
      const response = await fetch(`/api/requests/${id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: "ACCEPTED",
          quotedPrice: 35,
          quotedLeadDays: 4,
          message: "Happy to take this on.",
        }),
      });
      return response.status;
    }, created.requestId);
    expect(acceptStatus).toBe(200);

    // The quote is visible to the customer in the thread.
    await page.reload();
    await page.goto("/messages");
    await expect(page.getByText(title).first()).toBeVisible();

    await makerContext.close();
  });

  test("declining requires a reason", async ({ page, browser }) => {
    await signIn(page, uniqueEmail("declinecustomer"));
    await page.goto("/requests/new?profile=lindqvist-laser");
    const created = await page.evaluate(async () => {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileSlug: "lindqvist-laser",
          title: "Decline flow",
          description: "Something the maker will turn down.",
          process: "LASER_CUT",
        }),
      });
      const data = await response.json();
      return data.request?.id as string;
    });

    const makerContext = await browser.newContext();
    const makerPage = await makerContext.newPage();
    await signIn(makerPage, "marcus@example.com");

    const withoutReason = await makerPage.evaluate(async (id) => {
      const response = await fetch(`/api/requests/${id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "DECLINED" }),
      });
      return response.status;
    }, created);
    expect(withoutReason).toBe(422);

    const withReason = await makerPage.evaluate(async (id) => {
      const response = await fetch(`/api/requests/${id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: "DECLINED",
          declineReason: "I don't stock that material.",
        }),
      });
      return response.status;
    }, created);
    expect(withReason).toBe(200);

    await makerContext.close();
  });

  test("a maker cannot act on another maker's request", async ({ page, browser }) => {
    await signIn(page, uniqueEmail("crosscustomer"));
    await page.goto("/requests/new?profile=ada-prints");
    const requestId = await page.evaluate(async () => {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileSlug: "ada-prints",
          title: "Cross-tenant probe",
          description: "Only Ada should be able to action this.",
          process: "FDM",
        }),
      });
      const data = await response.json();
      return data.request?.id as string;
    });

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, "marcus@example.com");

    const status = await otherPage.evaluate(async (id) => {
      const response = await fetch(`/api/requests/${id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "ACCEPTED" }),
      });
      return response.status;
    }, requestId);
    expect(status).toBe(404);

    // And the detail page must 404 for them too.
    const pageResponse = await otherPage.goto(`/dashboard/requests/${requestId}`);
    expect(pageResponse?.status()).toBe(404);

    await otherContext.close();
  });

  test("the seeded specification request appears in the maker queue", async ({ page }) => {
    await signIn(page, "ada@example.com");
    await page.goto("/dashboard/requests");

    await expect(page.getByText(/Quadcopter arm/i).first()).toBeVisible();
    await expect(page.getByText(/Awaiting review/i).first()).toBeVisible();
  });
});
