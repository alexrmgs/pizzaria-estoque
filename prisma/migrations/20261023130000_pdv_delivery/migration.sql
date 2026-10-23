-- PDV: delivery (clientes, endereços, taxa de entrega). Aplicar pelo Supabase SQL Editor.

-- AlterTable
ALTER TABLE "PdvVenda" ADD COLUMN     "clienteId" TEXT,
ADD COLUMN     "enderecoTexto" TEXT,
ADD COLUMN     "obsEntrega" TEXT,
ADD COLUMN     "taxaEntrega" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PdvCliente" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "obs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdvCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvEndereco" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "bairro" TEXT,
    "complemento" TEXT,
    "referencia" TEXT,
    "taxaEntrega" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdvEndereco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PdvCliente_companyId_nome_idx" ON "PdvCliente"("companyId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "PdvCliente_companyId_telefone_key" ON "PdvCliente"("companyId", "telefone");

-- CreateIndex
CREATE INDEX "PdvEndereco_clienteId_idx" ON "PdvEndereco"("clienteId");

-- CreateIndex
CREATE INDEX "PdvVenda_clienteId_idx" ON "PdvVenda"("clienteId");

-- AddForeignKey
ALTER TABLE "PdvVenda" ADD CONSTRAINT "PdvVenda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "PdvCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCliente" ADD CONSTRAINT "PdvCliente_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvEndereco" ADD CONSTRAINT "PdvEndereco_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "PdvCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "PdvVenda" ADD CONSTRAINT "PdvVenda_taxa_ck" CHECK ("taxaEntrega" >= 0);
ALTER TABLE "PdvEndereco" ADD CONSTRAINT "PdvEndereco_taxa_ck" CHECK ("taxaEntrega" >= 0);
