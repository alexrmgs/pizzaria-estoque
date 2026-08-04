CREATE TYPE "RevenueChannel" AS ENUM ('LOJA_PROPRIA', 'IFOOD', 'NOVENTA_NOVE');

-- Lançamentos existentes não distinguiam canal; entram como "Loja própria"
-- (o valor default) e o usuário separa por canal dali pra frente.
ALTER TABLE "Revenue" ADD COLUMN "channel" "RevenueChannel" NOT NULL DEFAULT 'LOJA_PROPRIA';

DROP INDEX "Revenue_date_storeId_key";
CREATE UNIQUE INDEX "Revenue_date_storeId_channel_key" ON "Revenue"("date", "storeId", "channel");
