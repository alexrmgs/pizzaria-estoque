-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsappPhone" TEXT;

-- CreateTable
CREATE TABLE "WhatsappPendingMovement" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "type" "MovementType" NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappPendingMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappPendingMovement_phone_idx" ON "WhatsappPendingMovement"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsappPhone_key" ON "User"("whatsappPhone");

-- AddForeignKey
ALTER TABLE "WhatsappPendingMovement" ADD CONSTRAINT "WhatsappPendingMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappPendingMovement" ADD CONSTRAINT "WhatsappPendingMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

