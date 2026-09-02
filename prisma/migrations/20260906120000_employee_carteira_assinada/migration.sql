-- Define se o funcionário tem carteira assinada — decide se o contracheque
-- mostra INSS/IRRF/FGTS por padrão ou já sai na versão simplificada.
ALTER TABLE "Employee" ADD COLUMN "carteiraAssinada" BOOLEAN NOT NULL DEFAULT true;
