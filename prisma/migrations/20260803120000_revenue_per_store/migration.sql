ALTER TABLE "Revenue" ADD COLUMN "storeId" TEXT;
ALTER TABLE "Revenue" ADD COLUMN "orderCount" INTEGER NOT NULL DEFAULT 0;

-- Registros existentes (lançados antes do faturamento ser por loja) vão pra
-- primeira loja cadastrada, pra não perder o histórico.
UPDATE "Revenue" SET "storeId" = (SELECT id FROM "Store" ORDER BY "createdAt" ASC LIMIT 1) WHERE "storeId" IS NULL;

ALTER TABLE "Revenue" ALTER COLUMN "storeId" SET NOT NULL;

DROP INDEX "Revenue_date_key";
CREATE UNIQUE INDEX "Revenue_date_storeId_key" ON "Revenue"("date", "storeId");
CREATE INDEX "Revenue_storeId_idx" ON "Revenue"("storeId");

ALTER TABLE "Revenue" ADD CONSTRAINT "Revenue_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
