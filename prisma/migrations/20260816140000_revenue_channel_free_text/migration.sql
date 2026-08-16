-- Revenue.channel: enum -> texto livre (preserva os valores existentes)
ALTER TABLE "Revenue" ALTER COLUMN "channel" DROP DEFAULT;
ALTER TABLE "Revenue" ALTER COLUMN "channel" TYPE TEXT USING "channel"::TEXT;
ALTER TABLE "Revenue" ALTER COLUMN "channel" SET DEFAULT 'LOJA_PROPRIA';

-- Nova coluna: loja/marca dentro do canal
ALTER TABLE "Revenue" ADD COLUMN "channelStore" TEXT NOT NULL DEFAULT '';

-- Troca a constraint única pra incluir channelStore
DROP INDEX "Revenue_date_storeId_channel_key";
CREATE UNIQUE INDEX "Revenue_date_storeId_channel_channelStore_key" ON "Revenue"(date, "storeId", channel, "channelStore");

-- O enum não é mais usado por nenhuma coluna
DROP TYPE "RevenueChannel";
