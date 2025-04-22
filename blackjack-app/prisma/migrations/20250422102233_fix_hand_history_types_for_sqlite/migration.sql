-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "hashedPassword" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "balance" DECIMAL NOT NULL DEFAULT 1000.00,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GameHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "betAmount" DECIMAL NOT NULL,
    "outcome" TEXT NOT NULL,
    "payoutAmount" DECIMAL NOT NULL,
    "initialPlayerHand" TEXT NOT NULL,
    "initialDealerUpCard" TEXT NOT NULL,
    "finalPlayerHand" TEXT NOT NULL,
    "finalDealerHand" TEXT NOT NULL,
    "playerScore" INTEGER NOT NULL,
    "dealerScore" INTEGER NOT NULL,
    CONSTRAINT "GameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "GameHistory_userId_idx" ON "GameHistory"("userId");

-- CreateIndex
CREATE INDEX "GameHistory_playedAt_idx" ON "GameHistory"("playedAt");
