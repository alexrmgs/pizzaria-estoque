-- PDV: categorias de produto mãe criadas pelo usuário (Pizzas, Bordas, Adicionais…) + descrição e foto do produto. Aplicar pelo Supabase SQL Editor.

-- AlterTable
ALTER TABLE "PdvProdutoMae" ADD COLUMN     "categoriaId" TEXT,
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "fotoUrl" TEXT,
ALTER COLUMN "tipo" SET DEFAULT 'OUTRO';

-- AlterTable
ALTER TABLE "PdvCardapioItem" ADD COLUMN     "saborCategoriaId" TEXT;

-- CreateTable
CREATE TABLE "PdvProdutoCategoria" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PdvProdutoCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PdvProdutoCategoria_companyId_nome_key" ON "PdvProdutoCategoria"("companyId", "nome");

-- CreateIndex
CREATE INDEX "PdvProdutoMae_categoriaId_idx" ON "PdvProdutoMae"("categoriaId");

-- CreateIndex
CREATE INDEX "PdvCardapioItem_saborCategoriaId_idx" ON "PdvCardapioItem"("saborCategoriaId");

-- AddForeignKey
ALTER TABLE "PdvProdutoMae" ADD CONSTRAINT "PdvProdutoMae_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "PdvProdutoCategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvCardapioItem" ADD CONSTRAINT "PdvCardapioItem_saborCategoriaId_fkey" FOREIGN KEY ("saborCategoriaId") REFERENCES "PdvProdutoCategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdvProdutoCategoria" ADD CONSTRAINT "PdvProdutoCategoria_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- tipo deixa de ser lista fixa
ALTER TABLE "PdvProdutoMae" DROP CONSTRAINT IF EXISTS "PdvProdutoMae_tipo_ck";

-- ── Migra o que já existe: cada tipo antigo vira uma categoria ──
INSERT INTO "PdvProdutoCategoria" ("id", "companyId", "nome", "ordem")
SELECT gen_random_uuid()::text, t."companyId", t.nome, t.ordem
FROM (
  SELECT DISTINCT p."companyId",
    CASE p."tipo" WHEN 'PIZZA' THEN 'Pizzas' WHEN 'ESFIHA' THEN 'Esfihas' WHEN 'BEIRUTE' THEN 'Beirutes' WHEN 'BEBIDA' THEN 'Bebidas'
                  WHEN 'DOCE' THEN 'Doces' WHEN 'ADICIONAL' THEN 'Adicionais' ELSE 'Outros' END AS nome,
    CASE p."tipo" WHEN 'PIZZA' THEN 0 WHEN 'ESFIHA' THEN 1 WHEN 'BEIRUTE' THEN 2 WHEN 'BEBIDA' THEN 3
                  WHEN 'DOCE' THEN 4 WHEN 'ADICIONAL' THEN 5 ELSE 6 END AS ordem
  FROM "PdvProdutoMae" p
) t
ON CONFLICT ("companyId", "nome") DO NOTHING;

UPDATE "PdvProdutoMae" p SET "categoriaId" = c."id"
FROM "PdvProdutoCategoria" c
WHERE p."categoriaId" IS NULL AND c."companyId" = p."companyId"
  AND c."nome" = CASE p."tipo" WHEN 'PIZZA' THEN 'Pizzas' WHEN 'ESFIHA' THEN 'Esfihas' WHEN 'BEIRUTE' THEN 'Beirutes' WHEN 'BEBIDA' THEN 'Bebidas'
                  WHEN 'DOCE' THEN 'Doces' WHEN 'ADICIONAL' THEN 'Adicionais' ELSE 'Outros' END;

UPDATE "PdvCardapioItem" i SET "saborCategoriaId" = c."id"
FROM "PdvCardapioCategoria" cc, "PdvCardapio" cp, "PdvProdutoCategoria" c
WHERE i."saborTipo" IS NOT NULL AND i."saborCategoriaId" IS NULL
  AND cc."id" = i."categoriaId" AND cp."id" = cc."cardapioId" AND c."companyId" = cp."companyId"
  AND c."nome" = CASE i."saborTipo" WHEN 'PIZZA' THEN 'Pizzas' WHEN 'ESFIHA' THEN 'Esfihas' WHEN 'BEIRUTE' THEN 'Beirutes' WHEN 'BEBIDA' THEN 'Bebidas'
                  WHEN 'DOCE' THEN 'Doces' WHEN 'ADICIONAL' THEN 'Adicionais' ELSE 'Outros' END;
