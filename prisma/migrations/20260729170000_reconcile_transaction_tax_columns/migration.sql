-- These columns already exist in databases previously synchronized with
-- `prisma db push`, but were missing from the checked-in migration history.
-- The conditional statements make the bridge safe for both those databases
-- and clean databases created only from migrations.
ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "isDigitalTax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "parentTransactionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_parentTransactionId_key"
ON "Transaction"("parentTransactionId");

CREATE INDEX IF NOT EXISTS "Transaction_parentTransactionId_idx"
ON "Transaction"("parentTransactionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Transaction_parentTransactionId_fkey'
  ) THEN
    ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_parentTransactionId_fkey"
    FOREIGN KEY ("parentTransactionId")
    REFERENCES "Transaction"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;
