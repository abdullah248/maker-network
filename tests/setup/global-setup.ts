import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const TMP_DIR = path.resolve(process.cwd(), ".tmp");
export const TEMPLATE_DB = path.join(TMP_DIR, "test-template.db");

/**
 * Builds a single migrated SQLite database that every test worker copies.
 * Running migrations once keeps the suite fast and avoids concurrent writes to
 * the same file.
 */
export default function setup() {
  mkdirSync(TMP_DIR, { recursive: true });
  if (existsSync(TEMPLATE_DB)) rmSync(TEMPLATE_DB);

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${TEMPLATE_DB}` },
  });
}
