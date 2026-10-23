"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Search } from "lucide-react";

import { KdsCard, MesaCard, PedidoCard, ProdutoTile, StatusColuna } from "@/components/pdv/cards";
import { ConferenciaCaixa, FormaPagamentoPicker, PagamentosParciais, ValorComMotivo } from "@/components/pdv/payment";
import { Cronometro, ModuloTag, PdvButton, PdvField } from "@/components/pdv/primitives";

// Vitrine do design do PDV: todos os componentes base em todos os estados,
// com dados de mentira. Serve de conferência visual antes de montar as telas.

const FORMAS = [
  { id: "din", nome: "Dinheiro", tipo: "DINHEIRO" as const },
  { id: "pix", nome: "PIX", tipo: "PIX" as const },
  { id: "cre", nome: "Crédito", tipo: "CARTAO_CREDITO" as const },
  { id: "deb", nome: "Débito", tipo: "CARTAO_DEBITO" as const },
];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-pdv-display text-xs font-extrabold tracking-[.2em] text-pdv-accent uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

export default function PdvDesignPage() {
  const [forma, setForma] = useState<string | null>("pix");
  const [desc, setDesc] = useState("5,00");
  const [motivo, setMotivo] = useState("");

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-pdv-line bg-pdv-bg/95 px-4 backdrop-blur">
        <Image src="/logo.png" alt="FB Pizzaria & Esfiharia" width={40} height={39} priority />
        <span className="font-pdv-display text-lg font-extrabold tracking-wide">
          PDV <span className="text-pdv-accent">FB</span>
        </span>
        <span className="ml-2 rounded-full border border-pdv-line px-2 py-0.5 text-xs text-pdv-muted">design</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm text-pdv-muted">
            <span className="size-2 rounded-full bg-pdv-success" aria-hidden /> Caixa aberto
          </span>
          <PdvButton variant="primary" size="md">
            <Plus /> Novo pedido
          </PdvButton>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 p-4 pb-24 md:p-8">
        <Secao titulo="Botões">
          <div className="flex flex-wrap items-center gap-3">
            <PdvButton variant="primary" size="lg">Cobrar R$ 89,90</PdvButton>
            <PdvButton variant="primary">Fechar pedido</PdvButton>
            <PdvButton>Secundário</PdvButton>
            <PdvButton variant="ghost">Fantasma</PdvButton>
            <PdvButton variant="danger">Cancelar venda</PdvButton>
            <PdvButton variant="primary" loading>Salvando</PdvButton>
            <PdvButton disabled>Desabilitado</PdvButton>
            <PdvButton size="icon" aria-label="Buscar"><Search /></PdvButton>
          </div>
        </Secao>

        <Secao titulo="Tipos de pedido e tempo">
          <div className="flex flex-wrap items-center gap-3">
            <ModuloTag modulo="DELIVERY" />
            <ModuloTag modulo="BALCAO" />
            <ModuloTag modulo="SALAO" />
            <ModuloTag modulo="FICHA" />
            <ModuloTag modulo="DELIVERY" solid />
            <ModuloTag modulo="BALCAO" solid />
            <ModuloTag modulo="SALAO" solid />
            <ModuloTag modulo="FICHA" solid />
            <span className="mx-2 h-6 w-px bg-pdv-line" />
            <Cronometro minutos={8} />
            <Cronometro minutos={24} />
            <Cronometro minutos={41} />
          </div>
        </Secao>

        <Secao titulo="Quadro de pedidos">
          <div className="flex gap-3 overflow-x-auto pb-2">
            <StatusColuna nome="No forno" cor="var(--pdv-accent)" quantidade={2}>
              <PedidoCard pedido={{ numero: 142, modulo: "DELIVERY", cliente: "Ana Paula", endereco: "Rua das Flores, 120 — Centro", total: 89.9, taxaEntrega: 7, minutosNoStatus: 34, hora: "19:42" }} />
              <PedidoCard pedido={{ numero: 143, modulo: "BALCAO", cliente: "Balcão", total: 45, minutosNoStatus: 4, hora: "20:11" }} />
            </StatusColuna>
            <StatusColuna nome="Pronto" cor="var(--pdv-warning)" quantidade={1}>
              <PedidoCard pedido={{ numero: 140, modulo: "FICHA", cliente: "Ficha 18", total: 32.5, minutosNoStatus: 23, hora: "19:30" }} />
            </StatusColuna>
            <StatusColuna nome="Saiu" cor="var(--pdv-delivery)" quantidade={1}>
              <PedidoCard pedido={{ numero: 138, modulo: "DELIVERY", cliente: "João Victor", endereco: "Av. Central, 900", total: 120, minutosNoStatus: 12, hora: "19:15", entregador: "Rafa" }} />
            </StatusColuna>
            <StatusColuna nome="Entregue" cor="var(--pdv-success)" quantidade={0} />
          </div>
        </Secao>

        <Secao titulo="Mesas">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            <MesaCard numero={1} estado="LIVRE" />
            <MesaCard numero={2} estado="OCUPADA" total={86.5} pessoas={3} minutos={25} />
            <MesaCard numero={3} estado="CONTA" total={214} pessoas={6} minutos={72} />
            <MesaCard numero={4} estado="OCIOSA" total={40} pessoas={2} minutos={48} />
            <MesaCard numero={5} estado="LIVRE" />
            <MesaCard numero={6} estado="OCUPADA" total={19.9} pessoas={1} minutos={6} />
            <MesaCard numero={7} estado="LIVRE" />
            <MesaCard numero={8} estado="LIVRE" />
          </div>
        </Secao>

        <Secao titulo="Lançar produtos">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <ProdutoTile nome="Pizza Calabresa G" preco={59.9} quantidadeNoCarrinho={2} />
            <ProdutoTile nome="Pizza Frango c/ Catupiry G" preco={64.9} />
            <ProdutoTile nome="Esfiha de Carne" preco={6.5} quantidadeNoCarrinho={10} />
            <ProdutoTile nome="Beirute de Filé" preco={42} />
            <ProdutoTile nome="Pizza Portuguesa G" preco={62.9} esgotado />
            <ProdutoTile nome="Refrigerante 2L" preco={14} />
          </div>
        </Secao>

        <div className="grid gap-12 lg:grid-cols-2">
          <Secao titulo="Pagamento">
            <FormaPagamentoPicker formas={FORMAS} valor={forma} onChange={setForma} />
            <ValorComMotivo label="Desconto" valor={desc} motivo={motivo} onValor={setDesc} onMotivo={setMotivo} />
            <PdvField label="Troco para" inputMode="decimal" placeholder="100,00" />
            <PagamentosParciais total={214} pagamentos={[{ forma: "PIX", valor: 100 }, { forma: "Crédito", valor: 71.33 }]} onRemover={() => {}} />
            <PagamentosParciais total={89.9} pagamentos={[{ forma: "Dinheiro", valor: 89.9 }]} />
          </Secao>

          <Secao titulo="Fechar caixa">
            <ConferenciaCaixa linhas={[{ forma: "Dinheiro", esperado: 412.5 }, { forma: "PIX", esperado: 1280.9 }, { forma: "Crédito", esperado: 960 }, { forma: "Débito", esperado: 355.4 }]} />
            <p className="text-sm text-pdv-muted">Às cegas (o operador não vê o esperado):</p>
            <ConferenciaCaixa cego linhas={[{ forma: "Dinheiro", esperado: 412.5 }, { forma: "PIX", esperado: 1280.9 }]} />
          </Secao>
        </div>

        <Secao titulo="Cozinha (KDS)">
          <div className="flex flex-wrap gap-3">
            <KdsCard
              numero={142}
              modulo="DELIVERY"
              referencia="Ana Paula · entrega"
              minutos={9}
              itens={[
                { nome: "Pizza G meio a meio", qtd: 1, detalhes: ["½ Calabresa", "½ Frango c/ Catupiry", "Borda de cheddar"] },
                { nome: "Esfiha de Carne", qtd: 10 },
              ]}
            />
            <KdsCard
              numero={139}
              modulo="SALAO"
              referencia="Mesa 3 · comanda 12"
              minutos={26}
              itens={[
                { nome: "Beirute de Filé", qtd: 2, obs: "Sem cebola", obsNova: true },
                { nome: "Pizza Portuguesa M", qtd: 1, novo: true },
              ]}
            />
            <KdsCard numero={143} modulo="BALCAO" referencia="Balcão" minutos={3} itens={[{ nome: "Esfiha de Queijo", qtd: 6, obs: "Bem assada" }]} />
          </div>
        </Secao>
      </main>
    </div>
  );
}
