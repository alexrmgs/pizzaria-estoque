CREATE TYPE "RecipeType" AS ENUM ('PRODUCAO', 'PIZZA', 'BEIRUTE', 'ESFIHA');

ALTER TABLE "Recipe" ADD COLUMN "type" "RecipeType" NOT NULL DEFAULT 'PRODUCAO';
CREATE INDEX "Recipe_type_idx" ON "Recipe"("type");

ALTER TABLE "RecipeIngredient" ADD COLUMN "wastePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
