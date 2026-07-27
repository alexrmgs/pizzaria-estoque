-- Add a temporary text column to hold the new role id, backfilled from the old enum
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

UPDATE "User" SET "roleId" = 'role_admin' WHERE "role" = 'ADMIN';
UPDATE "User" SET "roleId" = 'role_staff' WHERE "role" = 'STAFF';

-- Drop the old enum column/type (frees up the "Role" name for the new table)
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canManageEstoque" BOOLEAN NOT NULL DEFAULT false,
    "canManageReceitas" BOOLEAN NOT NULL DEFAULT false,
    "canManageUsuarios" BOOLEAN NOT NULL DEFAULT false,
    "canViewRelatorios" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- Seed the two default roles, matching the ids used to backfill User.roleId above
INSERT INTO "Role" ("id", "name", "canManageEstoque", "canManageReceitas", "canManageUsuarios", "canViewRelatorios")
VALUES
  ('role_admin', 'Administrador', true, true, true, true),
  ('role_staff', 'Equipe', false, false, false, false);

-- Finish converting User.roleId into a proper required foreign key
ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
