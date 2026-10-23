-- PDV, fatia 1 (balcão → quadro → caixa). Aplicar pelo Supabase SQL Editor.

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canGerenciarPdv" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canOperarPdv" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PdvCategoria" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdvCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvProduto" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "recipeId" TEXT,
    "maxSabores" INTEGER NOT NULL DEFAULT 1,
    "cobraServico" BOOLEAN NOT NULL DEFAULT true,
    "codigo" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdvProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvFormaPagamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PdvFormaPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvStatus" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#64748b',
    "tag" TEXT,

    CONSTRAINT "PdvStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvContador" (
    "storeId" TEXT NOT NULL,
    "dia" DATE NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PdvContador_pkey" PRIMARY KEY ("storeId","dia")
);

-- CreateTable
CREATE TABLE "PdvCaixa" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "abertoPorId" TEXT NOT NULL,
    "valorInicial" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" TIMESTAMP(3),
    "fechadoPorId" TEXT,
    "cego" BOOLEAN NOT NULL DEFAULT false,
    "obs" TEXT,

    CONSTRAINT "PdvCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvCaixaMovimento" (
    "id" TEXT NOT NULL,
    "caixaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdvCaixaMovimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvCaixaConferencia" (
    "caixaId" TEXT NOT NULL,
    "formaId" TEXT NOT NULL,
    "esperado" DECIMAL(10,2) NOT NULL,
    "contado" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PdvCaixaConferencia_pkey" PRIMARY KEY ("caixaId","formaId")
);

-- CreateTable
CREATE TABLE "PdvVenda" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "dia" DATE NOT NULL,
    "modulo" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'LOJA_PROPRIA',
    "clienteNome" TEXT,
    "statusId" TEXT,
    "caixaId" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "acrescimo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "acrescimoMotivo" TEXT,
    "desconto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "descontoMotivo" TEXT,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "obs" TEXT,
    "situacao" TEXT NOT NULL DEFAULT 'ABERTA',
    "canceladaEm" TIMESTAMP(3),
    "cancelMotivo" TEXT,
    "clientRequestId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fechadaEm" TIMESTAMP(3),

    CONSTRAINT "PdvVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvVendaItem" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "qtd" DECIMAL(10,3) NOT NULL,
    "precoUnit" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "obs" TEXT,
    "cobraServico" BOOLEAN NOT NULL DEFAULT true,
    "adicionadoDepois" BOOLEAN NOT NULL DEFAULT false,
    "canceladoEm" TIMESTAMP(3),
    "cancelMotivo" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdvVendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvPagamento" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "formaId" TEXT NOT NULL,
    "caixaId" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "trocoPara" DECIMAL(10,2),
    "estornadoEm" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdvPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvStatusHistorico" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "statusId" TEXT,
    "evento" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdvStatusHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PdvCategoria_companyId_nome_key" ON "PdvCategoria"("companyId", "nome");

-- CreateIndex
CREATE INDEX "PdvProduto_companyId_categoriaId_ordem_idx" ON "PdvProduto"("companyId", "categoriaId", "ordem");

-- CreateIndex
CREATE INDEX "PdvProduto_categoriaId_idx" ON "PdvProduto"("categoriaId");

-- CreateIndex
CREATE INDEX "PdvProduto_recipeId_idx" ON "PdvProduto"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "PdvFormaPagamento_companyId_nome_key" ON "PdvFormaPagamento"("companyId", "nome");

-- CreateIndex
CREATE INDEX "PdvStatus_storeId_ordem_idx" ON "PdvStatus"("storeId", "ordem");

-- CreateIndex
CREATE INDEX "PdvCaixa_storeId_abertoEm_idx" ON "PdvCaixa"("storeId", "abertoEm");

-- CreateIndex
CREATE INDEX "PdvCaixa_abertoPorId_idx" ON "PdvCaixa"("abertoPorId");

-- CreateIndex
CREATE INDEX "PdvCaixa_fechadoPorId_idx" ON "PdvCaixa"("fechadoPorId");

-- CreateIndex
CREATE INDEX "PdvCaixaMovimento_caixaId_idx" ON "PdvCaixaMovimento"("caixaId");

-- CreateIndex
CREATE INDEX "PdvCaixaMovimento_userId_idx" ON "PdvCaixaMovimento"("userId");

-- CreateIndex
CREATE INDEX "PdvCaixaConferencia_formaId_idx" ON "PdvCaixaConferencia"("formaId");

-- CreateIndex
CREATE UNIQUE INDEX "PdvVenda_clientRequestId_key" ON "PdvVenda"("clientRequestId");

-- CreateIndex
CREATE INDEX "PdvVenda_storeId_situacao_updatedAt_idx" ON "PdvVenda"("storeId", "situacao", "updatedAt");

-- CreateIndex
CREATE INDEX "PdvVenda_storeId_dia_idx" ON "PdvVenda"("storeId", "dia");

-- CreateIndex
CREATE INDEX "PdvVenda_statusId_idx" ON "PdvVenda"("statusId");

-- CreateIndex
CREATE INDEX "PdvVenda_caixaId_idx" ON "PdvVenda"("caixaId");

-- CreateIndex
CREATE INDEX "PdvVenda_createdById_idx" ON "PdvVenda"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "PdvVenda_storeId_dia_numero_key" ON "PdvVenda"("storeId", "dia", "numero");

-- CreateIndex
CREATE INDEX "PdvVendaItem_vendaId_idx" ON "PdvVendaItem"("vendaId");

-- CreateIndex
CREATE INDEX "PdvVendaItem_produtoId_idx" ON "PdvVendaItem"("produtoId");

-- CreateIndex
CREATE INDEX "PdvVendaItem_userId_idx" ON "PdvVendaItem"("userId");

-- CreateIndex
CREATE INDEX "PdvPagamento_vendaId_idx" ON "PdvPagamento"("vendaId");

-- CreateIndex
CREATE INDEX "PdvPagamento_caixaId_formaId_idx" ON "PdvPagamento"("caixaId", "formaId");

-- CreateIndex
CREATE INDEX "PdvPagamento_formaId_idx" ON "PdvPagamento"("formaId");

-- CreateIndex
CREATE INDEX "PdvPagamento_userId_idx" ON "PdvPagamento"("userId");

-- CreateIndex
CREATE INDEX "PdvStatusHistorico_vendaId_createdAt_idx" ON "PdvStatusHistorico"("vendaId", "createdAt");

-- CreateIndex
CREATE INDEX "PdvStatusHistorico_statusId_idx" ON "PdvStatusHistorico"("statusId");

-- CreateIndex
CREATE INDEX "PdvStatusHistorico_userId_idx" ON "PdvStatusHistorico"("userId");

-- AddForeignKey
ALTER TABLE "PdvCategoria" ADD CONSTRAINT "PdvCategoria_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvProduto" ADD CONSTRAINT "PdvProduto_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvProduto" ADD CONSTRAINT "PdvProduto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "PdvCategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvProduto" ADD CONSTRAINT "PdvProduto_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvFormaPagamento" ADD CONSTRAINT "PdvFormaPagamento_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvStatus" ADD CONSTRAINT "PdvStatus_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvContador" ADD CONSTRAINT "PdvContador_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCaixa" ADD CONSTRAINT "PdvCaixa_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCaixa" ADD CONSTRAINT "PdvCaixa_abertoPorId_fkey" FOREIGN KEY ("abertoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCaixa" ADD CONSTRAINT "PdvCaixa_fechadoPorId_fkey" FOREIGN KEY ("fechadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCaixaMovimento" ADD CONSTRAINT "PdvCaixaMovimento_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "PdvCaixa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCaixaMovimento" ADD CONSTRAINT "PdvCaixaMovimento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCaixaConferencia" ADD CONSTRAINT "PdvCaixaConferencia_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "PdvCaixa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCaixaConferencia" ADD CONSTRAINT "PdvCaixaConferencia_formaId_fkey" FOREIGN KEY ("formaId") REFERENCES "PdvFormaPagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVenda" ADD CONSTRAINT "PdvVenda_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVenda" ADD CONSTRAINT "PdvVenda_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "PdvStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVenda" ADD CONSTRAINT "PdvVenda_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "PdvCaixa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVenda" ADD CONSTRAINT "PdvVenda_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVendaItem" ADD CONSTRAINT "PdvVendaItem_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "PdvVenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVendaItem" ADD CONSTRAINT "PdvVendaItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "PdvProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvVendaItem" ADD CONSTRAINT "PdvVendaItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvPagamento" ADD CONSTRAINT "PdvPagamento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "PdvVenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvPagamento" ADD CONSTRAINT "PdvPagamento_formaId_fkey" FOREIGN KEY ("formaId") REFERENCES "PdvFormaPagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvPagamento" ADD CONSTRAINT "PdvPagamento_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "PdvCaixa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvPagamento" ADD CONSTRAINT "PdvPagamento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvStatusHistorico" ADD CONSTRAINT "PdvStatusHistorico_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "PdvVenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvStatusHistorico" ADD CONSTRAINT "PdvStatusHistorico_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "PdvStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvStatusHistorico" ADD CONSTRAINT "PdvStatusHistorico_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Regras que o Prisma não expressa ──

-- um caixa aberto por usuário por loja
CREATE UNIQUE INDEX "PdvCaixa_um_aberto_por_usuario" ON "PdvCaixa" ("storeId", "abertoPorId") WHERE "fechadoEm" IS NULL;

ALTER TABLE "PdvProduto" ADD CONSTRAINT "PdvProduto_preco_ck" CHECK ("preco" >= 0 AND "maxSabores" BETWEEN 1 AND 4);
ALTER TABLE "PdvFormaPagamento" ADD CONSTRAINT "PdvFormaPagamento_tipo_ck" CHECK ("tipo" IN ('DINHEIRO','CARTAO_CREDITO','CARTAO_DEBITO','PIX','VOUCHER','FIADO','OUTRO'));
ALTER TABLE "PdvStatus" ADD CONSTRAINT "PdvStatus_tag_ck" CHECK ("tag" IS NULL OR "tag" IN ('PRODUCAO','PRONTO','EM_ENTREGA','ENTREGUE','FINALIZADO'));
ALTER TABLE "PdvCaixa" ADD CONSTRAINT "PdvCaixa_valor_ck" CHECK ("valorInicial" >= 0);
ALTER TABLE "PdvCaixaMovimento" ADD CONSTRAINT "PdvCaixaMovimento_ck" CHECK ("valor" > 0 AND "tipo" IN ('REFORCO','SANGRIA','DESPESA'));
ALTER TABLE "PdvVenda" ADD CONSTRAINT "PdvVenda_ck" CHECK (
  "modulo" IN ('DELIVERY','BALCAO','SALAO','FICHA')
  AND "situacao" IN ('ABERTA','PAGA','CANCELADA')
  AND "subtotal" >= 0 AND "acrescimo" >= 0 AND "desconto" >= 0 AND "total" >= 0
  AND (("situacao" = 'CANCELADA') = ("canceladaEm" IS NOT NULL))
);
ALTER TABLE "PdvVendaItem" ADD CONSTRAINT "PdvVendaItem_ck" CHECK ("qtd" > 0 AND "precoUnit" >= 0 AND "total" >= 0);
ALTER TABLE "PdvPagamento" ADD CONSTRAINT "PdvPagamento_ck" CHECK ("valor" > 0 AND ("trocoPara" IS NULL OR "trocoPara" >= "valor"));

-- quem já administra usuários começa com o PDV liberado
UPDATE "Role" SET "canOperarPdv" = true, "canGerenciarPdv" = true WHERE "canManageUsuarios" = true;
