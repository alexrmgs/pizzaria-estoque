-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('PENDENTE', 'PAGA');

-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'PENDENTE',
    "paidDate" DATE,
    "storeId" TEXT,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payable_status_dueDate_idx" ON "Payable"("status", "dueDate");
