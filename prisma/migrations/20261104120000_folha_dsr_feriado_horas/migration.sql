-- Folha igual à da contabilidade: horas de feriado/noturnas e reflexo no DSR.
ALTER TABLE "Payment" ADD COLUMN "holidayHours" DECIMAL(6,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "nightHours" DECIMAL(6,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "dsrExtrasAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "dsrNightAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
