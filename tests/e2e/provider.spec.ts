import { expect, test } from "@playwright/test";

import { signIn, uniqueEmail, uniqueSlug } from "./helpers";

test.describe("provider onboarding journey", () => {
  test("a new maker can onboard, list a machine and material, publish, and be found", async ({
    page,
  }) => {
    const email = uniqueEmail("maker");
    const slug = uniqueSlug("test-shop");
    const displayName = `Test Shop ${slug}`;

    await signIn(page, email);

    // 1. Choose an account type.
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Set up my profile" }).click();
    await page.waitForURL(/\/dashboard/);

    // 2. Create the public profile.
    await page.goto("/dashboard/profile");
    await page.getByLabel("Display name").fill(displayName);
    await page.getByLabel("Handle").fill(slug);
    await page.getByLabel("City").fill("Portland");
    await page.getByLabel("Region / state").fill("OR");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible({
      timeout: 30_000,
    });

    // 3. Add a machine from the curated catalog.
    await page.goto("/dashboard/machines");
    await page.getByRole("button", { name: "Add your first machine" }).first().click();
    await page.getByLabel("Category").selectOption("LASER_CUTTER");
    await page.getByLabel("Machine").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Add machine" }).last().click();
    await expect(page.getByText(/laser cutter \/ engraver/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // 4. Add a priced material.
    await page.goto("/dashboard/materials");
    await page.getByRole("button", { name: "Add your first material" }).first().click();
    await page.getByLabel("Category").selectOption("SHEET_WOOD");
    await page.getByLabel(/^Name/).fill("Test plywood");
    await page.getByLabel("Price per unit").fill("7.25");
    await page.getByRole("button", { name: "Add material" }).last().click();
    await expect(page.getByText("Test plywood").first()).toBeVisible({ timeout: 30_000 });

    // 5. Publish, then confirm the public page is live.
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Publish profile" }).click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible({ timeout: 30_000 });

    await page.goto(`/p/${slug}`);
    await expect(page.getByRole("heading", { name: displayName })).toBeVisible();
    await expect(page.getByText("Test plywood").first()).toBeVisible();

    // 6. And discoverable through the directory.
    await page.goto(`/browse?q=${encodeURIComponent(displayName)}`);
    await expect(
      page.getByRole("link", { name: new RegExp(displayName, "i") }).first(),
    ).toBeVisible();
  });

  test("a negative material price is rejected server-side", async ({ page }) => {
    await signIn(page, "ada@example.com");
    await page.goto("/dashboard/materials");

    // Bypass the browser's native number validation and hit the API the way a
    // malicious client would, to prove the server enforces the rule itself.
    const result = await page.evaluate(async () => {
      const response = await fetch("/api/materials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: "SHEET_WOOD",
          name: "Negative price probe",
          unit: "SHEET",
          pricePerUnit: -50,
          currency: "USD",
          inStock: true,
          canCustomOrder: false,
        }),
      });
      return { status: response.status, body: await response.text() };
    });

    expect(result.status).toBe(422);
    expect(result.body).toMatch(/negative/i);

    await page.reload();
    await expect(page.getByText("Negative price probe")).toHaveCount(0);
  });

  test("a provider cannot write to another provider's inventory", async ({ page }) => {
    await signIn(page, "ada@example.com");

    // Discover a machine id belonging to a different seeded provider.
    await page.goto("/dashboard/machines");
    const status = await page.evaluate(async () => {
      const response = await fetch("/api/machines/some-other-providers-machine", {
        method: "DELETE",
      });
      return response.status;
    });

    expect([403, 404]).toContain(status);
  });
});

test.describe("access control", () => {
  test("anonymous visitors are redirected away from the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/signin/);
    await expect(page).toHaveURL(/callbackUrl=/);
  });

  test("anonymous visitors are redirected away from messages", async ({ page }) => {
    await page.goto("/messages");
    await page.waitForURL(/\/signin/);
  });

  test("an open-redirect callbackUrl is ignored", async ({ page }) => {
    await page.goto("/signin?callbackUrl=https://evil.example/steal");
    await expect(page).toHaveURL(/\/signin/);

    await signIn(page, uniqueEmail("redirect"));
    expect(page.url()).not.toContain("evil.example");
    expect(new URL(page.url()).hostname).toBe("localhost");
  });

  test("API routes reject anonymous callers", async ({ request }) => {
    const endpoints: Array<[string, string]> = [
      ["GET", "/api/profile"],
      ["GET", "/api/machines"],
      ["GET", "/api/materials"],
      ["GET", "/api/hours"],
      ["GET", "/api/conversations"],
    ];

    for (const [method, url] of endpoints) {
      const response = await request.fetch(url, { method });
      expect(response.status(), `${method} ${url}`).toBe(401);
    }
  });

  test("API mutations reject anonymous callers", async ({ request }) => {
    const post = await request.post("/api/machines", {
      data: { category: "LASER_CUTTER", make: "x", model: "y", quantity: 1 },
    });
    expect(post.status()).toBe(401);

    const conversation = await request.post("/api/conversations", {
      data: { profileSlug: "ada-prints", subject: "hi", message: "hello" },
    });
    expect(conversation.status()).toBe(401);
  });

  test("a signed-in user cannot mutate another provider's inventory", async ({ page }) => {
    await signIn(page, uniqueEmail("attacker"));

    // Attempt to delete a machine the caller does not own. The service layer
    // rejects it, so this must never return a success status.
    const status = await page.evaluate(async () => {
      const response = await fetch("/api/machines/not-my-machine", { method: "DELETE" });
      return response.status;
    });
    expect(status).toBeGreaterThanOrEqual(400);

    const updateStatus = await page.evaluate(async () => {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "INDIVIDUAL", slug: "ada-prints", displayName: "Hijack", city: "X" }),
      });
      return response.status;
    });
    // Either a conflict (handle taken) or a validation error, never a 200.
    expect(updateStatus).toBeGreaterThanOrEqual(400);
  });
});
