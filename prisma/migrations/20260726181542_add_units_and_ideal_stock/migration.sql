-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Unit" ADD VALUE 'PECA';
ALTER TYPE "Unit" ADD VALUE 'FARDO';

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "idealStock" DECIMAL(10,3);
