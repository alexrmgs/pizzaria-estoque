-- Ingrediente com movimentações/receitas vinculadas não pode ser excluído
-- (preserva histórico) — agora dá pra arquivar em vez de excluir.
ALTER TABLE "Ingredient" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
