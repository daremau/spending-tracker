-- AlterTable
ALTER TABLE "BankAccount"
ALTER COLUMN "balance" TYPE DECIMAL(24,8);

-- CreateEnum
CREATE TYPE "ExchangeRateSource" AS ENUM ('TWELVE_DATA', 'MANUAL');

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "reportingCurrency" TEXT NOT NULL DEFAULT 'PYG',
    "timezone" TEXT NOT NULL DEFAULT 'America/Asuncion',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "source" "ExchangeRateSource" NOT NULL,
    "rate" DECIMAL(24,10) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_toCurrency_active_idx"
ON "ExchangeRate"("toCurrency", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_fromCurrency_toCurrency_source_key"
ON "ExchangeRate"("fromCurrency", "toCurrency", "source");

-- Seed the single-user default without overwriting an existing setting.
INSERT INTO "AppSettings" (
    "id",
    "reportingCurrency",
    "timezone",
    "updatedAt"
)
VALUES (
    'singleton',
    'PYG',
    'America/Asuncion',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
