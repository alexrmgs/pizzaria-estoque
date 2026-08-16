-- Cálculo de rescisão trabalhista ao demitir um funcionário.
CREATE TYPE "TerminationReason" AS ENUM ('SEM_JUSTA_CAUSA', 'PEDIDO_DEMISSAO', 'JUSTA_CAUSA', 'ACORDO');
CREATE TYPE "AvisoPrevioTipo" AS ENUM ('INDENIZADO', 'TRABALHADO', 'DISPENSADO');

CREATE TABLE "Termination" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dismissalDate" DATE NOT NULL,
    "reason" "TerminationReason" NOT NULL,
    "avisoPrevio" "AvisoPrevioTipo",
    "lastVacationDate" DATE NOT NULL,
    "baseSalary" DECIMAL(10,2) NOT NULL,
    "avisoPrevioDays" INTEGER NOT NULL DEFAULT 0,
    "projectedEndDate" DATE NOT NULL,
    "saldoSalario" DECIMAL(10,2) NOT NULL,
    "avisoIndenizadoValor" DECIMAL(10,2) NOT NULL,
    "feriasVencidas" DECIMAL(10,2) NOT NULL,
    "feriasProporcionais" DECIMAL(10,2) NOT NULL,
    "decimoTerceiro" DECIMAL(10,2) NOT NULL,
    "inssDeduzido" DECIMAL(10,2) NOT NULL,
    "irrfDeduzido" DECIMAL(10,2) NOT NULL,
    "adiantamentosDeduzidos" DECIMAL(10,2) NOT NULL,
    "descontoAvisoNaoCumprido" DECIMAL(10,2) NOT NULL,
    "totalLiquido" DECIMAL(10,2) NOT NULL,
    "fgtsBalanceInformado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "multaFgts" DECIMAL(10,2) NOT NULL,
    "jaPago" BOOLEAN NOT NULL DEFAULT false,
    "formaPagamento" TEXT,
    "payableId" TEXT,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Termination_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Termination_employeeId_idx" ON "Termination"("employeeId");

ALTER TABLE "Termination" ADD CONSTRAINT "Termination_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Advance" ADD COLUMN "terminationId" TEXT;
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_terminationId_fkey" FOREIGN KEY ("terminationId") REFERENCES "Termination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollAdjustment" ADD COLUMN "terminationId" TEXT;
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_terminationId_fkey" FOREIGN KEY ("terminationId") REFERENCES "Termination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
