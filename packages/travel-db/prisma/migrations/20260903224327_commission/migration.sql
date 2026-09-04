-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('MARGIN', 'SELL', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'VOID');

-- AlterTable
ALTER TABLE "agencySettings" ADD COLUMN     "defaultCommissionBasis" "CommissionBasis",
ADD COLUMN     "defaultCommissionRate" DECIMAL(6,4);

-- CreateTable
CREATE TABLE "commission" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "basis" "CommissionBasis" NOT NULL,
    "rate" DECIMAL(6,4),
    "basisBaseAmount" DECIMAL(24,4),
    "amount" DECIMAL(14,2),
    "currency" TEXT,
    "amountBase" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "fxRate" DECIMAL(20,10),
    "fxRateAt" TIMESTAMP(3),
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_agencyId_idx" ON "commission"("agencyId");

-- CreateIndex
CREATE INDEX "commission_agencyId_status_createdAt_idx" ON "commission"("agencyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "commission_agencyId_userId_status_idx" ON "commission"("agencyId", "userId", "status");

-- CreateIndex
CREATE INDEX "commission_bookingId_idx" ON "commission"("bookingId");

-- AddForeignKey
ALTER TABLE "commission" ADD CONSTRAINT "commission_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission" ADD CONSTRAINT "commission_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission" ADD CONSTRAINT "commission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission" ADD CONSTRAINT "commission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
