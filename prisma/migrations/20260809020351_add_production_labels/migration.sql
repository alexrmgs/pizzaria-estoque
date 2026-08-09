-- CreateEnum
CREATE TYPE "PrintJobType" AS ENUM ('PEDIDO', 'PRODUCAO');

-- AlterTable
ALTER TABLE "PrintJob" ADD COLUMN     "copias" INTEGER,
ADD COLUMN     "producaoData" DATE,
ADD COLUMN     "produto" TEXT,
ADD COLUMN     "tipo" "PrintJobType" NOT NULL DEFAULT 'PEDIDO',
ADD COLUMN     "validadeData" DATE,
ALTER COLUMN "pedido" DROP NOT NULL,
ALTER COLUMN "volumes" DROP NOT NULL;
