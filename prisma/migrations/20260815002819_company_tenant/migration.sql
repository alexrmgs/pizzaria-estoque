-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- AddColumn (nullable first — backfill antes de travar NOT NULL)
ALTER TABLE "Store" ADD COLUMN "companyId" TEXT;
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Role" ADD COLUMN "companyId" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "companyId" TEXT;

-- Backfill: cria a Empresa 1 com os dados que já existem e vincula tudo a ela.
INSERT INTO "Company" ("id", "name", "createdAt")
VALUES (gen_random_uuid()::text, 'FB Pizzaria & Esfiharia', now());

UPDATE "Store" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
UPDATE "User"  SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
UPDATE "Role"  SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
UPDATE "AppSettings" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;

-- Agora trava NOT NULL
ALTER TABLE "Store" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Role" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "AppSettings" ALTER COLUMN "companyId" SET NOT NULL;

-- DropIndex (o Role.name era @unique global, agora é único só dentro da empresa)
DROP INDEX IF EXISTS "Role_name_key";

-- CreateIndex
CREATE INDEX "Store_companyId_idx" ON "Store"("companyId");
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");
CREATE UNIQUE INDEX "AppSettings_companyId_key" ON "AppSettings"("companyId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
