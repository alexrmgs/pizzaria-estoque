-- Número sequencial do lote. Lotes que já existem são numerados pela ordem
-- de criação; os novos seguem a sequência.
CREATE SEQUENCE "StockLabel_numero_seq";
ALTER TABLE "StockLabel" ADD COLUMN "numero" INTEGER;
UPDATE "StockLabel" s SET "numero" = r.n
FROM (SELECT id, row_number() OVER (ORDER BY "createdAt") AS n FROM "StockLabel") r
WHERE s.id = r.id;
SELECT setval('"StockLabel_numero_seq"', COALESCE((SELECT MAX("numero") FROM "StockLabel"), 0) + 1, false);
ALTER TABLE "StockLabel" ALTER COLUMN "numero" SET NOT NULL,
  ALTER COLUMN "numero" SET DEFAULT nextval('"StockLabel_numero_seq"');
ALTER SEQUENCE "StockLabel_numero_seq" OWNED BY "StockLabel"."numero";
CREATE UNIQUE INDEX "StockLabel_numero_key" ON "StockLabel"("numero");
