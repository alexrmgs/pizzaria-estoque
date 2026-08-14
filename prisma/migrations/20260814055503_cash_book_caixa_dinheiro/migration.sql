-- CreateEnum
CREATE TYPE "CashDirection" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "CashSaidaTipo" AS ENUM ('PAGAMENTO', 'FUNDO');

-- CreateTable
CREATE TABLE "CashEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "direction" "CashDirection" NOT NULL,
    "tipo" "CashSaidaTipo",
    "amount" DECIMAL(10,2) NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMonth" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "saldoInicial" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ini05" INTEGER NOT NULL DEFAULT 0,
    "ini10" INTEGER NOT NULL DEFAULT 0,
    "ini25" INTEGER NOT NULL DEFAULT 0,
    "ini50" INTEGER NOT NULL DEFAULT 0,
    "ini100" INTEGER NOT NULL DEFAULT 0,
    "cedulasContadas" DECIMAL(10,2),
    "moedasContadas" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinMovement" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "direction" "CashDirection" NOT NULL,
    "q05" INTEGER NOT NULL DEFAULT 0,
    "q10" INTEGER NOT NULL DEFAULT 0,
    "q25" INTEGER NOT NULL DEFAULT 0,
    "q50" INTEGER NOT NULL DEFAULT 0,
    "q100" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashEntry_date_idx" ON "CashEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CashMonth_month_key" ON "CashMonth"("month");

-- CreateIndex
CREATE INDEX "CoinMovement_date_idx" ON "CoinMovement"("date");
