-- Nota fiscal: opção "já pago" (além de boleto), com forma de pagamento.
ALTER TABLE "NotaFiscal" ADD COLUMN "jaPago" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotaFiscal" ADD COLUMN "formaPagamento" TEXT;

-- Payable: guarda a forma de pagamento (dinheiro/pix) quando paga direto.
ALTER TABLE "Payable" ADD COLUMN "paymentMethod" TEXT;
