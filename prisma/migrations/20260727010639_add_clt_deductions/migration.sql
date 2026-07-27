ALTER TABLE "Employee" ADD COLUMN "dependents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AppSettings" ADD COLUMN "inssBrackets" JSONB NOT NULL DEFAULT '[{"upTo":1412.00,"rate":0.075},{"upTo":2666.68,"rate":0.09},{"upTo":4000.03,"rate":0.12},{"upTo":7786.02,"rate":0.14}]';
ALTER TABLE "AppSettings" ADD COLUMN "irrfBrackets" JSONB NOT NULL DEFAULT '[{"upTo":2259.20,"rate":0},{"upTo":2826.65,"rate":0.075},{"upTo":3751.05,"rate":0.15},{"upTo":4664.68,"rate":0.225},{"upTo":null,"rate":0.275}]';
ALTER TABLE "AppSettings" ADD COLUMN "irrfDependentDeduction" DECIMAL(10,2) NOT NULL DEFAULT 189.59;
ALTER TABLE "AppSettings" ADD COLUMN "valeTransporteRate" DECIMAL(4,2) NOT NULL DEFAULT 6;

ALTER TABLE "Payment" ADD COLUMN "faltaDays" DECIMAL(4,1) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "faltaAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "inssAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "irrfAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "valeTransporteAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
