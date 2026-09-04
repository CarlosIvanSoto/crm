-- AlterTable
ALTER TABLE "quote" ADD COLUMN     "acceptedByName" TEXT,
ADD COLUMN     "acceptedOptionId" TEXT;

-- CreateTable
CREATE TABLE "quoteShare" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "firstViewAt" TIMESTAMP(3),
    "lastViewAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quoteShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quoteShare_tokenHash_key" ON "quoteShare"("tokenHash");

-- CreateIndex
CREATE INDEX "quoteShare_agencyId_idx" ON "quoteShare"("agencyId");

-- CreateIndex
CREATE INDEX "quoteShare_quoteId_idx" ON "quoteShare"("quoteId");

-- AddForeignKey
ALTER TABLE "quoteShare" ADD CONSTRAINT "quoteShare_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quoteShare" ADD CONSTRAINT "quoteShare_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quoteShare" ADD CONSTRAINT "quoteShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

