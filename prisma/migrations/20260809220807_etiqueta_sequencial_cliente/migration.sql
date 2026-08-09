-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "etiquetaProximoNumero" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PrintJob" ADD COLUMN     "cliente" TEXT;
