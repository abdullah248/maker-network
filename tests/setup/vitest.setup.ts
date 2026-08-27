import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach } from "vitest";

const TMP_DIR = path.resolve(process.cwd(), ".tmp");
const TEMPLATE_DB = path.join(TMP_DIR, "test-template.db");

// Each worker gets its own copy of the migrated database so tests never
// contend on the same SQLite file.
const workerId = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "0";
const WORKER_DB = path.join(TMP_DIR, `test-worker-${workerId}.db`);

mkdirSync(TMP_DIR, { recursive: true });
copyFileSync(TEMPLATE_DB, WORKER_DB);

process.env.DATABASE_URL = `file:${WORKER_DB}`;
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-secret-value-0123456789abcdef";
process.env.ENABLE_DEV_LOGIN = "false";

const { prisma } = await import("@/lib/db");

/** Order matters: children before parents. */
const TABLES = [
  "Message",
  "PrintRequest",
  "Conversation",
  "AvailabilitySlot",
  "OperatingHours",
  "Material",
  "Machine",
  "Profile",
  "Session",
  "Account",
  "VerificationToken",
  "User",
] as const;

export async function resetDatabase() {
  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
