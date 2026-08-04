ALTER TABLE "Recipe" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Preenche a ordem das receitas já cadastradas mantendo a ordem alfabética
-- atual (dentro de cada categoria), já que antes a exibição era só por nome.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "type" ORDER BY name) - 1 AS rn
  FROM "Recipe"
)
UPDATE "Recipe" r
SET "order" = numbered.rn
FROM numbered
WHERE r.id = numbered.id;
