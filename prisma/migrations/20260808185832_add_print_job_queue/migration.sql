-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDENTE', 'IMPRESSO');

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "pedido" TEXT NOT NULL,
    "volumes" INTEGER NOT NULL,
    "labelWidthMm" INTEGER NOT NULL,
    "labelHeightMm" INTEGER NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" TIMESTAMP(3),

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintJob_status_createdAt_idx" ON "PrintJob"("status", "createdAt");
