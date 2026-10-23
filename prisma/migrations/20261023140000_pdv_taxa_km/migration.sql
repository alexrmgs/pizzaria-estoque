-- PDV: taxa de entrega por km (faixas por loja + coordenadas do endereço). Aplicar pelo Supabase SQL Editor.

-- AlterTable
ALTER TABLE "PdvEndereco" ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7);

-- CreateTable
CREATE TABLE "PdvFaixaEntrega" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "ateKm" DECIMAL(5,2) NOT NULL,
    "taxa" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PdvFaixaEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PdvFaixaEntrega_storeId_ateKm_key" ON "PdvFaixaEntrega"("storeId", "ateKm");

-- AddForeignKey
ALTER TABLE "PdvFaixaEntrega" ADD CONSTRAINT "PdvFaixaEntrega_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "PdvFaixaEntrega" ADD CONSTRAINT "PdvFaixaEntrega_ck" CHECK ("ateKm" > 0 AND "taxa" >= 0);
