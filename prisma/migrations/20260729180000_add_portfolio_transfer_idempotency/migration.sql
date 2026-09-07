-- Portfolio funding uses the existing transfer ledger. A nullable unique
-- request identifier makes portfolio-originated transfers idempotent while
-- leaving existing income, expense, and transfer rows unchanged.
ALTER TABLE "Transaction"
ADD COLUMN "clientRequestId" TEXT;

CREATE UNIQUE INDEX "Transaction_clientRequestId_key"
ON "Transaction"("clientRequestId");
