import { expect, test } from "@playwright/test";

test.describe("public surface", () => {
  test("landing page renders and search jumps into the directory", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /browse makers/i }).first()).toBeVisible();

    const search = page.getByRole("search").first();
    await search.locator('input[name="q"]').fill("laser");
    await search.locator('input[name="q"]').press("Enter");

    await page.waitForURL(/\/browse/);
    await expect(page).toHaveURL(/q=laser/);
  });

  test("directory lists seeded profiles", async ({ page }) => {
    await page.goto("/browse");
    await expect(page.getByRole("link", { name: /Cedar Park/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Ada's Print Bench/i }).first()).toBeVisible();
  });

  test("directory filters by profile type", async ({ page }) => {
    await page.goto("/browse?type=MAKERSPACE");
    await expect(page.getByRole("link", { name: /Cedar Park/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Ada's Print Bench/i })).toHaveCount(0);
  });

  test("directory filters by machine category", async ({ page }) => {
    await page.goto("/browse?category=CNC_ROUTER");
    await expect(page.getByRole("link", { name: /Bramble Street/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Cedar Park/i })).toHaveCount(0);
  });

  test("hostile query strings do not break the directory", async ({ page }) => {
    const response = await page.goto(
      "/browse?page=-99&perPage=99999&type=%3Cscript%3E&category=DROP&q=%27%20OR%201%3D1--",
    );
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("makerspace profile shows machines, materials, access rules and hours", async ({ page }) => {
    await page.goto("/p/cedar-park-library");

    await expect(page.getByRole("heading", { name: /Cedar Park Public Library/i })).toBeVisible();
    await expect(page.getByText(/Fusion Pro 36/i).first()).toBeVisible();
    await expect(page.getByText(/Baltic birch plywood/i).first()).toBeVisible();
    await expect(page.getByText(/library card/i).first()).toBeVisible();
    await expect(page.getByText(/Wednesday/i).first()).toBeVisible();
  });

  test("individual maker profile shows fulfilment options", async ({ page }) => {
    await page.goto("/p/ada-prints");

    await expect(page.getByRole("heading", { name: /Ada's Print Bench/i })).toBeVisible();
    await expect(page.getByText(/shipping/i).first()).toBeVisible();
    await expect(page.getByText(/X1 Carbon/i).first()).toBeVisible();
  });

  test("unknown profile returns 404", async ({ page }) => {
    const response = await page.goto("/p/no-such-maker");
    expect(response?.status()).toBe(404);
  });

  test("a draft profile is not publicly reachable", async ({ page }) => {
    const response = await page.goto("/p/secret-draft-profile");
    expect(response?.status()).toBe(404);
  });

  test("informational pages render", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/safety");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
