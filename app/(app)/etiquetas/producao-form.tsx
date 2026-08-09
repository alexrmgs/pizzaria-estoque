"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enfileirarProducao } from "./actions";

const TEMP_SUGESTOES = ["Congelado (-18°C)", "Refrigerado (0 a 4°C)", "Ambiente"];

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

export function ProducaoForm({
  produtos,
  responsaveis,
  widthMm,
  heightMm,
}: {
  produtos: string[];
  responsaveis: string[];
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
  const [produto, setProduto] = useState("");
  const [producao, setProducao] = useState(todayISO());
  const [validadeDias, setValidadeDias] = useState("3");
  const [temperatura, setTemperatura] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [peso, setPeso] = useState("");
  const [copias, setCopias] = useState("1");
  const [isPending, startTransition] = useTransition();

  const dias = Math.max(0, Number(validadeDias) || 0);
  const validadeISO = /^\d{4}-\d{2}-\d{2}$/.test(producao) ? addDaysISO(producao, dias) : "";
  const titleFont = Math.max(11, Math.min(widthMm, heightMm * 1.6) * 0.16);
  const lineFont = titleFont * 0.5;

  function imprimir() {
    startTransition(async () => {
      const result = await enfileirarProducao({
        produto,
        producaoISO: producao,
        validadeDias: dias,
        copias: Number(copias),
        temperatura,
        responsavel,
        peso,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Enviado pra impressora ✅");
      setProduto("");
      setPeso("");
      router.refresh();
    });
  }

  function imprimirNavegador() {
    if (!produto.trim()) {
      toast.error("Informe o produto.");
      return;
    }
    const params = new URLSearchParams({
      tipo: "producao",
      produto: produto.trim(),
      producao,
      validade: validadeISO,
      temperatura,
      responsavel,
      peso,
      copias,
    });
    window.open(`/imprimir/etiquetas?${params.toString()}`, "_blank");
  }

  return (
    <div className="flex max-w-lg flex-col gap-3 rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="produto" className="text-xs">
          Produto (estoque de produção)
        </Label>
        <Input
          id="produto"
          list="producao-produtos"
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          placeholder="Ex: Bacon fatiado"
          className="h-10"
        />
        <datalist id="producao-produtos">
          {produtos.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
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
        <div className="flex flex-col gap-1">
          <Label htmlFor="copias" className="text-xs">
            Cópias
          </Label>
          <Input
            id="copias"
            type="number"
            min="1"
            max="50"
            value={copias}
            onChange={(e) => setCopias(e.target.value)}
            className="h-10 w-20"
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
            list="producao-temperaturas"
            value={temperatura}
            onChange={(e) => setTemperatura(e.target.value)}
            placeholder="Ex: Congelado"
            className="h-10 w-48"
          />
          <datalist id="producao-temperaturas">
            {TEMP_SUGESTOES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="peso" className="text-xs">
            Peso do pacote
          </Label>
          <Input
            id="peso"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            placeholder="Ex: 1,5 kg"
            className="h-10 w-32"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="responsavel" className="text-xs">
            Responsável
          </Label>
          <Input
            id="responsavel"
            list="producao-responsaveis"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="Nome de quem produziu"
            className="h-10"
          />
          <datalist id="producao-responsaveis">
            {responsaveis.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <Button onClick={imprimir} disabled={isPending} className="h-10">
          Imprimir etiquetas
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase text-neutral-500">
          Prévia da etiqueta ({widthMm}×{heightMm}mm)
        </p>
        <div
          style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}
          className="flex max-w-full flex-col justify-center gap-0.5 rounded-md border bg-white px-3"
        >
          <p className="text-center font-black leading-tight" style={{ fontSize: `${titleFont}pt` }}>
            {produto.trim() || "PRODUTO"}
          </p>
          <p className="leading-tight" style={{ fontSize: `${lineFont}pt` }}>
            <b>Fab:</b> {formatBR(producao)} &nbsp; <b>Val:</b> {validadeISO ? formatBR(validadeISO) : "—"}
          </p>
          {temperatura.trim() && (
            <p className="leading-tight" style={{ fontSize: `${lineFont}pt` }}>
              <b>Temp:</b> {temperatura.trim()}
            </p>
          )}
          {peso.trim() && (
            <p className="leading-tight" style={{ fontSize: `${lineFont}pt` }}>
              <b>Peso:</b> {peso.trim()}
            </p>
          )}
          {responsavel.trim() && (
            <p className="leading-tight" style={{ fontSize: `${lineFont}pt` }}>
              <b>Resp:</b> {responsavel.trim()}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={imprimirNavegador}
        className="self-start text-xs text-neutral-400 underline hover:text-neutral-600"
      >
        Imprimir pelo navegador (provisório, até o PC estar configurado)
      </button>
    </div>
  );
}
