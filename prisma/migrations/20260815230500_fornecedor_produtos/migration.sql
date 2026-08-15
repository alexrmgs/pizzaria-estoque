-- CreateTable
CREATE TABLE "_FornecedorToIngredient" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FornecedorToIngredient_AB_pkey" PRIMARY KEY ("A", "B")
);

-- CreateIndex
CREATE INDEX "_FornecedorToIngredient_B_index" ON "_FornecedorToIngredient"("B");

-- AddForeignKey
ALTER TABLE "_FornecedorToIngredient" ADD CONSTRAINT "_FornecedorToIngredient_A_fkey" FOREIGN KEY ("A") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FornecedorToIngredient" ADD CONSTRAINT "_FornecedorToIngredient_B_fkey" FOREIGN KEY ("B") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
