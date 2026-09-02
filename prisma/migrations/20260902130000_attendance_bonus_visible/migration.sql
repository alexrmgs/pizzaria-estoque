-- Chave pra ligar/desligar quando o bônus de assiduidade aparece pro
-- funcionário em Meu Ponto (o cálculo/fechamento continua funcionando igual).
ALTER TABLE "AppSettings" ADD COLUMN "attendanceBonusVisible" BOOLEAN NOT NULL DEFAULT true;
