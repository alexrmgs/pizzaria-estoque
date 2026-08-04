ALTER TABLE "Recipe" ADD COLUMN "yieldUnits" INTEGER;
ALTER TABLE "RecipeIngredient" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Preenche a ordem dos ingredientes já cadastrados com a ordem aproximada
-- de criação (id é cuid, cronologicamente crescente), já que antes a ordem
-- era só implícita.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "recipeId" ORDER BY id) - 1 AS rn
  FROM "RecipeIngredient"
)
UPDATE "RecipeIngredient" ri
SET "order" = numbered.rn
FROM numbered
WHERE ri.id = numbered.id;
