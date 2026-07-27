-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('KG', 'G', 'L', 'ML', 'UN');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- AlterTable: convert Ingredient.unit from text to enum, preserving existing values
ALTER TABLE "Ingredient" ALTER COLUMN "unit" TYPE "Unit" USING ("unit"::"Unit");

-- AlterTable: add price and category columns to Ingredient
ALTER TABLE "Ingredient" ADD COLUMN "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Ingredient" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "Ingredient_categoryId_idx" ON "Ingredient"("categoryId");

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: drop redundant unit column on RecipeIngredient (now uses the ingredient's own unit)
ALTER TABLE "RecipeIngredient" DROP COLUMN "unit";
