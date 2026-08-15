"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarLote } from "./actions";
import { imprimirTspl } from "../etiquetas/ble-print";
import { buildProducaoTspl } from "../etiquetas/tspl";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}

function addDaysISO(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Domínio fixo de produção — vai dentro do QR pra abrir direto (a câmera
// nativa do celular já reconhece QR de URL e oferece pra abrir no navegador,
// sem precisar entrar no sistema antes pra escanear).
const SITE_URL = "https://fbgestao.com";

export function LoteForm({
  ingredients,
  responsaveis,
  empresa,
  widthMm,
  heightMm,
}: {
  ingredients: { id: string; name: string; unit: string }[];
  responsaveis: string[];
  empresa: { nome: string; cnpj: string; endereco: string; cep: string; cidade: string };
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? "");
  const [producao, setProducao] = useState(todayISO());
  const [validadeDias, setValidadeDias] = useState("3");
  const [temperatura, setTemperatura] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [printing, setPrinting] = useState(false);

  const ingredient = ingredients.find((i) => i.id === ingredientId);
  const dias = Math.max(0, Number(validadeDias) || 0);
  const validadeISO = /^\d{4}-\d{2}-\d{2}$/.test(producao) ? addDaysISO(producao, dias) : "";

  async function imprimir() {
    if (!ingredientId) {
      toast.error("Selecione o produto.");
      return;
    }
    const qtd = Number(quantidade.replace(",", "."));
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast.error("Informe o peso/quantidade.");
      return;
    }
    setPrinting(true);

    const result = await criarLote({
      ingredientId,
      quantity: qtd,
      producaoISO: producao,
      validadeISO: validadeISO || undefined,
    });
    if (result.error || !result.id) {
      setPrinting(false);
      toast.error(result.error ?? "Não deu pra registrar a entrada.");
      return;
    }

    try {
      const tspl = buildProducaoTspl({
        produto: ingredient?.name ?? "",
        temperatura,
        peso: `${quantidade} ${ingredient?.unit ?? ""}`,
        fabricacao: formatBR(producao),
        validade: validadeISO ? formatBR(validadeISO) : "—",
        responsavel,
        empresaNome: empresa.nome,
        empresaCnpj: empresa.cnpj,
        empresaCidade: empresa.cidade,
        copias: 1,
        widthMm,
        heightMm,
        qrContent: `${SITE_URL}/lotes/${result.id}`,
      });
      await imprimirTspl(tspl);
    } catch (e) {
      setPrinting(false);
      toast.error(
        "Entrada registrada, mas não imprimiu: " +
          (e instanceof Error ? e.message : "erro no Bluetooth") +
          " — dá pra reimprimir em Lotes.",
      );
      router.refresh();
      return;
    }

    setPrinting(false);
    toast.success("Entrada registrada e etiqueta impressa ✅");
    setQuantidade("");
    router.refresh();
  }

  return (
    <div className="flex max-w-lg flex-col gap-3 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="ingredientId" className="text-xs">
          Produto (estoque de produção)
        </Label>
        <select
          id="ingredientId"
          value={ingredientId}
          onChange={(e) => setIngredientId(e.target.value)}
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {ingredients.length === 0 && <option value="">Nenhum item de produção cadastrado</option>}
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-400">
          Só aparecem itens marcados como &quot;Produzido internamente&quot; em Estoque.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="producao" className="text-xs">
            Data de fabricação
          </Label>
          <Input
            id="producao"
            type="date"
            value={producao}
            onChange={(e) => setProducao(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="validadeDias" className="text-xs">
            Validade (dias)
          </Label>
          <Input
            id="validadeDias"
            type="number"
            min="0"
            max="3650"
            value={validadeDias}
            onChange={(e) => setValidadeDias(e.target.value)}
            className="h-10 w-24"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="temperatura" className="text-xs">
            Temperatura
          </Label>
          <Input
            id="temperatura"
            value={temperatura}
            onChange={(e) => setTemperatura(e.target.value)}
            placeholder="Ex: Congelado"
            className="h-10 w-48"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="quantidade" className="text-xs">
            Peso/quantidade {ingredient ? `(${ingredient.unit})` : ""}
          </Label>
          <Input
            id="quantidade"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="Ex: 1,5"
            className="h-10 w-32"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="responsavel" className="text-xs">
            Responsável
          </Label>
          <Input
            id="responsavel"
            list="lote-responsaveis"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="Nome de quem produziu"
            className="h-10"
          />
          <datalist id="lote-responsaveis">
            {responsaveis.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <Button onClick={imprimir} disabled={printing || !ingredientId} className="h-10">
          {printing ? "Registrando…" : "Registrar entrada e imprimir"}
        </Button>
      </div>

      <p className="text-xs text-neutral-400">
        Cada etiqueta impressa vira um lote: entra no estoque na hora, com um QR code que dá baixa
        (saída) quando escaneado depois.
      </p>
    </div>
  );
}
