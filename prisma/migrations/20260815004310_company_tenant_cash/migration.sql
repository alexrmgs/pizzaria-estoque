-- AddColumn (nullable first — backfill antes de travar NOT NULL)
ALTER TABLE "Payable" ADD COLUMN "companyId" TEXT;
ALTER TABLE "CashEntry" ADD COLUMN "companyId" TEXT;
ALTER TABLE "CashMonth" ADD COLUMN "companyId" TEXT;
ALTER TABLE "CoinMovement" ADD COLUMN "companyId" TEXT;

-- Backfill: vincula tudo que já existe à Empresa 1 (a mesma criada na
-- migração anterior — só tem 1 empresa até aqui).
UPDATE "Payable" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
UPDATE "CashEntry" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
UPDATE "CashMonth" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
UPDATE "CoinMovement" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;

-- Agora trava NOT NULL
ALTER TABLE "Payable" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "CashEntry" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "CashMonth" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "CoinMovement" ALTER COLUMN "companyId" SET NOT NULL;

-- DropIndex (CashMonth.month era @unique global, agora é único só dentro da empresa)
DROP INDEX IF EXISTS "CashMonth_month_key";

-- CreateIndex
CREATE INDEX "Payable_companyId_idx" ON "Payable"("companyId");
DROP INDEX IF EXISTS "CashEntry_date_idx";
CREATE INDEX "CashEntry_companyId_date_idx" ON "CashEntry"("companyId", "date");
CREATE UNIQUE INDEX "CashMonth_companyId_month_key" ON "CashMonth"("companyId", "month");
DROP INDEX IF EXISTS "CoinMovement_date_idx";
CREATE INDEX "CoinMovement_companyId_date_idx" ON "CoinMovement"("companyId", "date");

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashEntry" ADD CONSTRAINT "CashEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMonth" ADD CONSTRAINT "CashMonth_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoinMovement" ADD CONSTRAINT "CoinMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
