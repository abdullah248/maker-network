import { expect, test } from "@playwright/test";

import { signIn, uniqueEmail } from "./helpers";

test.describe("customer request journey", () => {
  test("a customer can send a print request and both sides see the thread", async ({
    page,
    browser,
  }) => {
    const customerEmail = uniqueEmail("customer");
    const subject = `Prototype bracket ${Date.now()}`;

    await signIn(page, customerEmail);

    // Start from the public profile, as a real customer would.
    await page.goto("/p/ada-prints");
    await page.getByRole("link", { name: /request a print|send a request/i }).first().click();
    await page.waitForURL(/\/requests\/new/);

    await page.getByLabel(/title|what do you need/i).first().fill(subject);
    await page
      .getByLabel(/description|details/i)
      .first()
      .fill("A small bracket, 40 x 20 x 5 mm, black PLA please.");
    await page.getByRole("button", { name: /send print request/i }).first().click();

    await page.waitForURL(/\/messages\//, { timeout: 30_000 });
    await expect(page.getByText(subject).first()).toBeVisible();
    await expect(page.getByText(/small bracket/i).first()).toBeVisible();

    const threadUrl = page.url();

    // The customer can reply in the thread.
    const composer = page.getByRole("textbox").last();
    await composer.fill("Adding a note: matte finish is fine.");
    await page.getByRole("button", { name: /send/i }).last().click();
    await expect(page.getByText(/matte finish is fine/i).first()).toBeVisible({ timeout: 20_000 });

    // The provider sees the same conversation in their inbox.
    const providerContext = await browser.newContext();
    const providerPage = await providerContext.newPage();
    await signIn(providerPage, "ada@example.com");
    await providerPage.goto("/messages");
    await expect(providerPage.getByText(subject).first()).toBeVisible({ timeout: 20_000 });
    await providerPage.getByText(subject).first().click();
    await expect(providerPage.getByText(/small bracket/i).first()).toBeVisible();

    // An unrelated third party cannot read that thread.
    const strangerContext = await browser.newContext();
    const strangerPage = await strangerContext.newPage();
    await signIn(strangerPage, uniqueEmail("stranger"));
    const response = await strangerPage.goto(threadUrl);
    expect(response?.status()).toBe(404);

    await providerContext.close();
    await strangerContext.close();
  });

  test("a maker cannot send a request to their own profile", async ({ page }) => {
    await signIn(page, "ada@example.com");
    await page.goto("/requests/new?profile=ada-prints");
    await expect(page.getByText(/your own profile|cannot send a request to yourself/i).first()).toBeVisible();
  });

  test("a request to an unknown profile 404s", async ({ page }) => {
    await signIn(page, uniqueEmail("lost"));
    const response = await page.goto("/requests/new?profile=not-a-real-maker");
    expect(response?.status()).toBe(404);
  });

  test("message bodies are escaped, not executed", async ({ page }) => {
    await signIn(page, uniqueEmail("xss"));

    await page.goto("/requests/new?profile=lindqvist-laser");
    await page.getByLabel(/title|what do you need/i).first().fill("XSS probe");
    await page
      .getByLabel(/description|details/i)
      .first()
      .fill('<img src=x onerror="window.__xss=true">');
    await page.getByRole("button", { name: /send print request/i }).first().click();
    await page.waitForURL(/\/messages\//, { timeout: 30_000 });

    // The payload is visible as literal text and never executed.
    await expect(page.getByText("onerror").first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)).toBeUndefined();
  });
});
