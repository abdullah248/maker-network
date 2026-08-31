-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "machineId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "altText" TEXT,
    "materialUsed" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortfolioItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PortfolioItem_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "providerResponse" TEXT,
    "providerRespondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "postalCode" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "websiteUrl" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "requiresAppointment" BOOLEAN NOT NULL DEFAULT false,
    "requiresMembership" BOOLEAN NOT NULL DEFAULT false,
    "requiresLibraryCard" BOOLEAN NOT NULL DEFAULT false,
    "membershipDetails" TEXT,
    "accessNotes" TEXT,
    "offersShipping" BOOLEAN NOT NULL DEFAULT false,
    "offersLocalPickup" BOOLEAN NOT NULL DEFAULT true,
    "canCustomOrderMaterials" BOOLEAN NOT NULL DEFAULT false,
    "customOrderNotes" TEXT,
    "acceptingRequests" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "ratingAverage" REAL NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("acceptingRequests", "accessNotes", "avatarUrl", "bio", "canCustomOrderMaterials", "city", "contactEmail", "country", "createdAt", "customOrderNotes", "displayName", "headline", "id", "latitude", "longitude", "membershipDetails", "offersLocalPickup", "offersShipping", "phone", "postalCode", "published", "region", "requiresAppointment", "requiresLibraryCard", "requiresMembership", "slug", "type", "updatedAt", "userId", "websiteUrl") SELECT "acceptingRequests", "accessNotes", "avatarUrl", "bio", "canCustomOrderMaterials", "city", "contactEmail", "country", "createdAt", "customOrderNotes", "displayName", "headline", "id", "latitude", "longitude", "membershipDetails", "offersLocalPickup", "offersShipping", "phone", "postalCode", "published", "region", "requiresAppointment", "requiresLibraryCard", "requiresMembership", "slug", "type", "updatedAt", "userId", "websiteUrl" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE UNIQUE INDEX "Profile_slug_key" ON "Profile"("slug");
CREATE INDEX "Profile_type_published_idx" ON "Profile"("type", "published");
CREATE INDEX "Profile_city_idx" ON "Profile"("city");
CREATE INDEX "Profile_ratingAverage_idx" ON "Profile"("ratingAverage");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PortfolioItem_profileId_sortOrder_idx" ON "PortfolioItem"("profileId", "sortOrder");

-- CreateIndex
CREATE INDEX "PortfolioItem_profileId_featured_idx" ON "PortfolioItem"("profileId", "featured");

-- CreateIndex
CREATE INDEX "Review_profileId_createdAt_idx" ON "Review"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "Review_profileId_authorId_key" ON "Review"("profileId", "authorId");
