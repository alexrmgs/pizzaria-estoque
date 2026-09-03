-- Preço unitário passa a aceitar 4 casas decimais (era só 2) — produtos
-- muito baratos por unidade (ex: R$0,017) estavam sendo bloqueados/
-- arredondados. Mesma precisão já usada em NotaFiscalItem.unitValue.
ALTER TABLE "Ingredient" ALTER COLUMN "unitPrice" TYPE DECIMAL(10,4);
ALTER TABLE "StockMovement" ALTER COLUMN "unitPriceAtEntry" TYPE DECIMAL(10,4);
