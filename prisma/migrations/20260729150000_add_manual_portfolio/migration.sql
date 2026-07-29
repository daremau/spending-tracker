-- CreateEnum
CREATE TYPE "BankAccountKind" AS ENUM ('STANDARD', 'INVESTMENT_CASH');

-- CreateEnum
CREATE TYPE "InvestmentAccountType" AS ENUM ('BROKERAGE', 'EXCHANGE', 'WALLET');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'ETF', 'CRYPTO');

-- CreateEnum
CREATE TYPE "InvestmentTransactionType" AS ENUM (
    'OPENING_POSITION',
    'BUY',
    'SELL',
    'DIVIDEND',
    'FEE'
);

-- CreateEnum
CREATE TYPE "MarketDataSource" AS ENUM ('TWELVE_DATA', 'MANUAL');

-- AlterTable
ALTER TABLE "BankAccount"
ADD COLUMN "kind" "BankAccountKind" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "InvestmentAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InvestmentAccountType" NOT NULL,
    "cashCurrency" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "provider" TEXT,
    "providerSymbol" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentTransaction" (
    "id" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT,
    "type" "InvestmentTransactionType" NOT NULL,
    "quantity" DECIMAL(30,12),
    "unitPrice" DECIMAL(24,8),
    "cashAmount" DECIMAL(24,8),
    "fees" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "fxRateToReporting" DECIMAL(24,10) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketQuote" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "source" "MarketDataSource" NOT NULL,
    "price" DECIMAL(24,8) NOT NULL,
    "currency" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentAccount_cashAccountId_key"
ON "InvestmentAccount"("cashAccountId");

-- CreateIndex
CREATE INDEX "InvestmentAccount_archivedAt_idx"
ON "InvestmentAccount"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_type_symbol_market_key"
ON "Asset"("type", "symbol", "market");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_provider_providerSymbol_key"
ON "Asset"("provider", "providerSymbol");

-- CreateIndex
CREATE INDEX "Asset_active_type_idx"
ON "Asset"("active", "type");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentTransaction_clientRequestId_key"
ON "InvestmentTransaction"("clientRequestId");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_accountId_date_createdAt_idx"
ON "InvestmentTransaction"("accountId", "date", "createdAt");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_assetId_date_createdAt_idx"
ON "InvestmentTransaction"("assetId", "date", "createdAt");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_accountId_assetId_idx"
ON "InvestmentTransaction"("accountId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketQuote_assetId_source_key"
ON "MarketQuote"("assetId", "source");

-- CreateIndex
CREATE INDEX "MarketQuote_active_source_idx"
ON "MarketQuote"("active", "source");

-- AddForeignKey
ALTER TABLE "InvestmentAccount"
ADD CONSTRAINT "InvestmentAccount_cashAccountId_fkey"
FOREIGN KEY ("cashAccountId") REFERENCES "BankAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT "InvestmentTransaction_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "InvestmentAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT "InvestmentTransaction_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketQuote"
ADD CONSTRAINT "MarketQuote_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
