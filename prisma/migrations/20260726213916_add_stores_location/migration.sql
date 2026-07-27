-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 150,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- AlterTable: link Employee to an optional Store
ALTER TABLE "Employee" ADD COLUMN "storeId" TEXT;
CREATE INDEX "Employee_storeId_idx" ON "Employee"("storeId");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: record distance-from-store at clock in/out time (audit trail, no raw coordinates stored)
ALTER TABLE "TimeEntry" ADD COLUMN "clockInDistanceM" INTEGER;
ALTER TABLE "TimeEntry" ADD COLUMN "clockOutDistanceM" INTEGER;
