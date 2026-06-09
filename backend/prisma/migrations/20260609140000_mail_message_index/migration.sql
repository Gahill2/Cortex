-- CreateTable
CREATE TABLE "MailMessageIndex" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "from" TEXT NOT NULL DEFAULT '',
    "snippet" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL,
    "unread" BOOLEAN NOT NULL DEFAULT false,
    "inInbox" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailMessageIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailSyncState" (
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "syncedCount" INTEGER NOT NULL DEFAULT 0,
    "targetCount" INTEGER NOT NULL DEFAULT 0,
    "currentAccount" TEXT,
    "lastError" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailSyncState_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "MailMessageIndex_userId_date_idx" ON "MailMessageIndex"("userId", "date");

-- CreateIndex
CREATE INDEX "MailMessageIndex_userId_accountId_idx" ON "MailMessageIndex"("userId", "accountId");

-- CreateIndex
CREATE INDEX "MailMessageIndex_userId_unread_idx" ON "MailMessageIndex"("userId", "unread");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessageIndex_userId_accountId_messageId_key" ON "MailMessageIndex"("userId", "accountId", "messageId");
