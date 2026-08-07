-- CreateTable
CREATE TABLE "FixedCost" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariableCostRate" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "percentage" DECIMAL(6,3) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariableCostRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixedCost_storeId_idx" ON "FixedCost"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedCost_storeId_category_referenceMonth_key" ON "FixedCost"("storeId", "category", "referenceMonth");

-- CreateIndex
CREATE INDEX "VariableCostRate_storeId_idx" ON "VariableCostRate"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "VariableCostRate_storeId_category_key" ON "VariableCostRate"("storeId", "category");

-- AddForeignKey
ALTER TABLE "FixedCost" ADD CONSTRAINT "FixedCost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedCost" ADD CONSTRAINT "FixedCost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariableCostRate" ADD CONSTRAINT "VariableCostRate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariableCostRate" ADD CONSTRAINT "VariableCostRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
