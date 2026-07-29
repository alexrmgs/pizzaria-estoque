CREATE TYPE "SwapStatus" AS ENUM ('PENDENTE', 'ACEITO_PELO_FUNCIONARIO', 'RECUSADO_PELO_FUNCIONARIO', 'APROVADO', 'RECUSADO_PELA_GERENCIA', 'CANCELADO');

CREATE TABLE "ShiftSwapRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "requesterDate" DATE NOT NULL,
    "targetDate" DATE NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDENTE',
    "note" TEXT,
    "targetRespondedAt" TIMESTAMP(3),
    "managerId" TEXT,
    "managerRespondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftSwapRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShiftSwapRequest_requesterId_idx" ON "ShiftSwapRequest"("requesterId");
CREATE INDEX "ShiftSwapRequest_targetId_idx" ON "ShiftSwapRequest"("targetId");
CREATE INDEX "ShiftSwapRequest_status_idx" ON "ShiftSwapRequest"("status");

ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
