ALTER TABLE "Ingredient" ADD COLUMN "recipeUnit" "Unit";
ALTER TABLE "Ingredient" ADD COLUMN "unitsPerPackage" DECIMAL(10,3) NOT NULL DEFAULT 1;
