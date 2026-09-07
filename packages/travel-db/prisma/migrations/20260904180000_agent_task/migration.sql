-- CreateTable
CREATE TABLE "agentTask" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "quoteId" TEXT,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "budget" INTEGER NOT NULL DEFAULT 4,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "leasedUntil" TIMESTAMP(3),
    "sessionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentConversation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "continuationToken" TEXT,
    "streamIndex" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agentTask_dueAt_leasedUntil_idx" ON "agentTask"("dueAt", "leasedUntil");

-- CreateIndex
CREATE INDEX "agentTask_quoteId_idx" ON "agentTask"("quoteId");

-- CreateIndex
CREATE INDEX "agentTask_agencyId_kind_subject_idx" ON "agentTask"("agencyId", "kind", "subject") WHERE ("finishedAt" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "agentConversation_sessionId_key" ON "agentConversation"("sessionId");

-- CreateIndex
CREATE INDEX "agentConversation_agencyId_quoteId_createdAt_idx" ON "agentConversation"("agencyId", "quoteId", "createdAt");

-- AddForeignKey
ALTER TABLE "agentTask" ADD CONSTRAINT "agentTask_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentTask" ADD CONSTRAINT "agentTask_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentConversation" ADD CONSTRAINT "agentConversation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentConversation" ADD CONSTRAINT "agentConversation_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentConversation" ADD CONSTRAINT "agentConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

