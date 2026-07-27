-- CreateEnum
CREATE TYPE "OvertimeMode" AS ENUM ('HORA_EXTRA', 'BANCO_HORAS');

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'settings',
    "overtimeMode" "OvertimeMode" NOT NULL DEFAULT 'HORA_EXTRA',
    "dailyExpectedHours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "overtimeRate" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable: link Employee to an optional User login account
ALTER TABLE "Employee" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: overtime/hour-bank tracking on Payment
ALTER TABLE "Payment" ADD COLUMN "overtimeHours" DECIMAL(6,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "overtimeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "bankedHours" DECIMAL(6,2) NOT NULL DEFAULT 0;
