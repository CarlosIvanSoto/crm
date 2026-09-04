-- DropIndex
DROP INDEX "activity_dueAt_idx";

-- AlterTable
ALTER TABLE "activity" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "sourceKey" TEXT;

-- Backfill: every existing task is owned by its author until reassigned.
UPDATE "activity" SET "assignedToId" = "createdById" WHERE "type" = 'TASK';

-- CreateIndex
CREATE INDEX "activity_agencyId_assignedToId_completedAt_dueAt_idx" ON "activity"("agencyId", "assignedToId", "completedAt", "dueAt");

-- CreateIndex
CREATE INDEX "activity_agencyId_dueAt_idx" ON "activity"("agencyId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "activity_agencyId_sourceKey_key" ON "activity"("agencyId", "sourceKey");

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
