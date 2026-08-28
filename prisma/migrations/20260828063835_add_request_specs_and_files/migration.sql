-- CreateTable
CREATE TABLE "RequestFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploaderId" TEXT NOT NULL,
    "requestId" TEXT,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestFile_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequestFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PrintRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PrintRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "machineId" TEXT,
    "materialId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "fulfillment" TEXT NOT NULL DEFAULT 'PICKUP',
    "budgetCents" INTEGER,
    "deadline" DATETIME,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "process" TEXT NOT NULL DEFAULT 'FDM',
    "materialType" TEXT,
    "materialColor" TEXT,
    "specs" TEXT,
    "dimensionsX" REAL,
    "dimensionsY" REAL,
    "dimensionsZ" REAL,
    "declineReason" TEXT,
    "quotedPriceCents" INTEGER,
    "quotedLeadDays" INTEGER,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PrintRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrintRequest_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PrintRequest_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PrintRequest" ("budgetCents", "conversationId", "createdAt", "deadline", "description", "fileUrl", "fulfillment", "id", "machineId", "materialId", "quantity", "status", "title", "updatedAt") SELECT "budgetCents", "conversationId", "createdAt", "deadline", "description", "fileUrl", "fulfillment", "id", "machineId", "materialId", "quantity", "status", "title", "updatedAt" FROM "PrintRequest";
DROP TABLE "PrintRequest";
ALTER TABLE "new_PrintRequest" RENAME TO "PrintRequest";
CREATE UNIQUE INDEX "PrintRequest_conversationId_key" ON "PrintRequest"("conversationId");
CREATE INDEX "PrintRequest_status_idx" ON "PrintRequest"("status");
CREATE INDEX "PrintRequest_process_idx" ON "PrintRequest"("process");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RequestFile_storageKey_key" ON "RequestFile"("storageKey");

-- CreateIndex
CREATE INDEX "RequestFile_uploaderId_requestId_idx" ON "RequestFile"("uploaderId", "requestId");

-- CreateIndex
CREATE INDEX "RequestFile_requestId_idx" ON "RequestFile"("requestId");
