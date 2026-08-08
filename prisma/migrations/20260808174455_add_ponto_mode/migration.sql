-- CreateEnum
CREATE TYPE "PontoMode" AS ENUM ('CELULAR', 'FACIAL');

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "pontoMode" "PontoMode" NOT NULL DEFAULT 'CELULAR';
