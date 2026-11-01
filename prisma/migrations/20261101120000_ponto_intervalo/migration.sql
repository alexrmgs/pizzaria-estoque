-- Intervalo do turno: saída e volta, descontados das horas trabalhadas.
ALTER TABLE "TimeEntry" ADD COLUMN "breakStart" TIMESTAMP(3);
ALTER TABLE "TimeEntry" ADD COLUMN "breakEnd" TIMESTAMP(3);
