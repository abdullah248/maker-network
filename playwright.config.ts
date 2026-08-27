import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// Auth.js normalises its own origin to `localhost`, so the whole suite must
// use the same host or the session cookie is dropped on redirect.
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const E2E_DATABASE_URL = `file:${path.resolve(process.cwd(), ".tmp", "e2e.db")}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Dev mode on purpose: the credentials test-login provider is hard-disabled
    // in production builds, so E2E needs a non-production server.
    // Prepare a dedicated, freshly seeded database before the server boots so
    // the suite never depends on local dev data.
    command: `rm -f .tmp/e2e.db* && npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-value-0123456789abcdef",
      AUTH_TRUST_HOST: "true",
      ENABLE_DEV_LOGIN: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
