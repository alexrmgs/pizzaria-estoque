-- CreateEnum
CREATE TYPE "NotaStatus" AS ENUM ('CONFERINDO', 'LANCADA');

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "fornecedor" TEXT,
    "chave" TEXT,
    "emissao" DATE,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "NotaStatus" NOT NULL DEFAULT 'CONFERINDO',
    "boleto" BOOLEAN NOT NULL DEFAULT false,
    "vencimento" DATE,
    "payableId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscalItem" (
    "id" TEXT NOT NULL,
    "notaId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitValue" DECIMAL(10,4) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "ingredientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaFiscalItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotaFiscalItem_notaId_idx" ON "NotaFiscalItem"("notaId");

-- AddForeignKey
ALTER TABLE "NotaFiscalItem" ADD CONSTRAINT "NotaFiscalItem_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "NotaFiscal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
