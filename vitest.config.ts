import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/setup/global-setup.ts"],
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    // SQLite test databases are per-worker so files can run in parallel safely.
    pool: "forks",
    // next-auth ships extensionless ESM imports that Node cannot resolve when
    // externalised; inlining lets Vite resolve them.
    server: { deps: { inline: ["next-auth", "@auth/core", "@auth/prisma-adapter"] } },
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/generated/**"],
    },
  },
});
