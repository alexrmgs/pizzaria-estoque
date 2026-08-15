-- CreateEnum
CREATE TYPE "StockLabelStatus" AS ENUM ('ATIVO', 'BAIXADO');

-- CreateTable
CREATE TABLE "StockLabel" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "producedAt" DATE NOT NULL,
    "expiresAt" DATE,
    "status" "StockLabelStatus" NOT NULL DEFAULT 'ATIVO',
    "entradaMovementId" TEXT,
    "saidaMovementId" TEXT,
    "createdById" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockLabel_ingredientId_idx" ON "StockLabel"("ingredientId");

-- CreateIndex
CREATE INDEX "StockLabel_status_idx" ON "StockLabel"("status");

-- AddForeignKey
ALTER TABLE "StockLabel" ADD CONSTRAINT "StockLabel_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLabel" ADD CONSTRAINT "StockLabel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLabel" ADD CONSTRAINT "StockLabel_consumedById_fkey" FOREIGN KEY ("consumedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
