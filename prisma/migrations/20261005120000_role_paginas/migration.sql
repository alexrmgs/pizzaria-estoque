-- Telas avulsas liberadas pro cargo (ex: só "/ponto-totem" sem o RH inteiro).
ALTER TABLE "Role" ADD COLUMN "paginas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
