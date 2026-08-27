import { expect, type Page } from "@playwright/test";

/**
 * Signs in through the development credentials provider. The provider is
 * hard-disabled in production builds, so this only ever works against the
 * dev/test server Playwright boots.
 */
export async function signIn(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Development sign-in").fill(email);
  await page.getByRole("button", { name: /sign in without google/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"), { timeout: 30_000 });
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.toLowerCase();
}
