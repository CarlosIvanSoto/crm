-- AlterTable
ALTER TABLE "document" ADD COLUMN     "pathname" TEXT NOT NULL DEFAULT '';
ALTER TABLE "document" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: existing rows (if any) get their url as a placeholder pathname.
-- A document created before this migration has no signed-URL flow anyway.
UPDATE "document" SET "pathname" = "url" WHERE "pathname" = '';

ALTER TABLE "document" ALTER COLUMN "pathname" DROP DEFAULT;
ALTER TABLE "document" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "document_agencyId_kind_idx" ON "document"("agencyId", "kind");

-- CreateIndex
CREATE INDEX "document_agencyId_createdAt_idx" ON "document"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_agencyId_pathname_key" ON "document"("agencyId", "pathname");
