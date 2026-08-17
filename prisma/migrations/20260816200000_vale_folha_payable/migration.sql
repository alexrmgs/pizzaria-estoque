-- Vale e folha fechada passam a gerar conta em Contas a Pagar/Pagas.
ALTER TABLE "Advance" ADD COLUMN "payableId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "payableId" TEXT;
