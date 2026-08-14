-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "pricingMethod" TEXT NOT NULL DEFAULT 'MARKUP',
ADD COLUMN     "targetMarginPercent" DECIMAL(5,2);
