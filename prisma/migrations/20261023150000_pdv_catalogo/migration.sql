-- PDV: catálogo (produto mãe + variações) e cardápios. Aplicar pelo Supabase SQL Editor.

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "pdvCardapioId" TEXT;

-- AlterTable
ALTER TABLE "PdvVendaItem" ADD COLUMN     "cardapioItemId" TEXT,
ALTER COLUMN "produtoId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PdvProdutoMae" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdvProdutoMae_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvVariacao" (
    "id" TEXT NOT NULL,
    "produtoMaeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "recipeId" TEXT,
    "precoReferencia" DECIMAL(10,2),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PdvVariacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvCardapio" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'PDV',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdvCardapio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvCardapioCategoria" (
    "id" TEXT NOT NULL,
    "cardapioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dias" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "horaInicio" TEXT,
    "horaFim" TEXT,

    CONSTRAINT "PdvCardapioCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvCardapioItem" (
    "id" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "preco" DECIMAL(10,2) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "maxSabores" INTEGER NOT NULL DEFAULT 1,
    "saborTipo" TEXT,
    "saborVariacao" TEXT,
    "regraPreco" TEXT NOT NULL DEFAULT 'MAIOR',
    "cobraServico" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PdvCardapioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvCardapioComponente" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "variacaoId" TEXT NOT NULL,
    "qtd" DECIMAL(10,3) NOT NULL DEFAULT 1,

    CONSTRAINT "PdvCardapioComponente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvVendaItemParte" (
    "id" TEXT NOT NULL,
    "vendaItemId" TEXT NOT NULL,
    "variacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fracao" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "PdvVendaItemParte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PdvProdutoMae_companyId_tipo_idx" ON "PdvProdutoMae"("companyId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "PdvProdutoMae_companyId_nome_key" ON "PdvProdutoMae"("companyId", "nome");

-- CreateIndex
CREATE INDEX "PdvVariacao_recipeId_idx" ON "PdvVariacao"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "PdvVariacao_produtoMaeId_nome_key" ON "PdvVariacao"("produtoMaeId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "PdvCardapio_companyId_nome_key" ON "PdvCardapio"("companyId", "nome");

-- CreateIndex
CREATE INDEX "PdvCardapioCategoria_cardapioId_ordem_idx" ON "PdvCardapioCategoria"("cardapioId", "ordem");

-- CreateIndex
CREATE INDEX "PdvCardapioItem_categoriaId_ordem_idx" ON "PdvCardapioItem"("categoriaId", "ordem");

-- CreateIndex
CREATE INDEX "PdvCardapioComponente_itemId_idx" ON "PdvCardapioComponente"("itemId");

-- CreateIndex
CREATE INDEX "PdvCardapioComponente_variacaoId_idx" ON "PdvCardapioComponente"("variacaoId");

-- CreateIndex
CREATE INDEX "PdvVendaItemParte_vendaItemId_idx" ON "PdvVendaItemParte"("vendaItemId");

-- CreateIndex
CREATE INDEX "PdvVendaItemParte_variacaoId_idx" ON "PdvVendaItemParte"("variacaoId");

-- CreateIndex
CREATE INDEX "PdvVendaItem_cardapioItemId_idx" ON "PdvVendaItem"("cardapioItemId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_pdvCardapioId_fkey" FOREIGN KEY ("pdvCardapioId") REFERENCES "PdvCardapio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVendaItem" ADD CONSTRAINT "PdvVendaItem_cardapioItemId_fkey" FOREIGN KEY ("cardapioItemId") REFERENCES "PdvCardapioItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvProdutoMae" ADD CONSTRAINT "PdvProdutoMae_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVariacao" ADD CONSTRAINT "PdvVariacao_produtoMaeId_fkey" FOREIGN KEY ("produtoMaeId") REFERENCES "PdvProdutoMae"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVariacao" ADD CONSTRAINT "PdvVariacao_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCardapio" ADD CONSTRAINT "PdvCardapio_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCardapioCategoria" ADD CONSTRAINT "PdvCardapioCategoria_cardapioId_fkey" FOREIGN KEY ("cardapioId") REFERENCES "PdvCardapio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCardapioItem" ADD CONSTRAINT "PdvCardapioItem_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "PdvCardapioCategoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCardapioComponente" ADD CONSTRAINT "PdvCardapioComponente_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PdvCardapioItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCardapioComponente" ADD CONSTRAINT "PdvCardapioComponente_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "PdvVariacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVendaItemParte" ADD CONSTRAINT "PdvVendaItemParte_vendaItemId_fkey" FOREIGN KEY ("vendaItemId") REFERENCES "PdvVendaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVendaItemParte" ADD CONSTRAINT "PdvVendaItemParte_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "PdvVariacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "PdvProdutoMae" ADD CONSTRAINT "PdvProdutoMae_tipo_ck" CHECK ("tipo" IN ('PIZZA','ESFIHA','BEIRUTE','BEBIDA','ADICIONAL','DOCE','OUTRO'));
ALTER TABLE "PdvCardapioItem" ADD CONSTRAINT "PdvCardapioItem_ck" CHECK ("preco" >= 0 AND "maxSabores" BETWEEN 1 AND 4 AND "regraPreco" IN ('MAIOR','MEDIA'));
ALTER TABLE "PdvCardapioComponente" ADD CONSTRAINT "PdvCardapioComponente_ck" CHECK ("qtd" > 0);
ALTER TABLE "PdvVendaItemParte" ADD CONSTRAINT "PdvVendaItemParte_ck" CHECK ("fracao" > 0);
