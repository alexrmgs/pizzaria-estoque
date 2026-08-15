"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ListItem = {
  id: string;
  name: string;
  unit: string;
  category: { name: string } | null;
  current: number;
  min: number;
  ideal: number | null;
  suggestedQty: number;
  estimatedCost: number;
};

// Marcação de "já comprei" fica só no navegador (localStorage) — é uma
// checklist informal pra quem tá indo às compras, não um registro do
// sistema (entrada de estoque continua sendo lançada em Movimentações).
// Store externo simples (useSyncExternalStore) em vez de useState+useEffect
// pra evitar ler localStorage durante a renderização e descasar do SSR.
const STORAGE_KEY = "pizzaria:lista-compras:comprados";
const EMPTY_SET = new Set<string>();

let comprados = EMPTY_SET;
let initialized = false;
const listeners = new Set<() => void>();

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    comprados = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    comprados = new Set();
  }
  initialized = true;
}

function subscribe(listener: () => void) {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  ensureInitialized();
  return comprados;
}

function getServerSnapshot() {
  return EMPTY_SET;
}

function persist() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(comprados)));
  listeners.forEach((listener) => listener());
}

function toggleComprado(id: string) {
  const next = new Set(comprados);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  comprados = next;
  persist();
}

function limparComprados() {
  comprados = new Set();
  persist();
}

export function PurchaseTable({ items }: { items: ListItem[] }) {
  const comprados = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const totalComprado = items.filter((item) => comprados.has(item.id)).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-xs text-neutral-500">
          {totalComprado} de {items.length} já marcado(s) como comprado
        </p>
        {totalComprado > 0 && (
          <Button variant="ghost" size="sm" onClick={limparComprados}>
            Limpar marcações
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="print:hidden w-10">Comprado</TableHead>
              <TableHead>Ingrediente</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Estoque atual</TableHead>
              <TableHead>Estoque mínimo</TableHead>
              <TableHead>Estoque aceitável</TableHead>
              <TableHead>Sugestão de compra</TableHead>
              <TableHead className="print:hidden">Custo estimado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const comprado = comprados.has(item.id);
              return (
                <TableRow key={item.id} className={cn(comprado && "opacity-50")}>
                  <TableCell className="print:hidden">
                    <input
                      type="checkbox"
                      checked={comprado}
                      onChange={() => toggleComprado(item.id)}
                      className="size-4"
                      aria-label={`Marcar ${item.name} como comprado`}
                    />
                  </TableCell>
                  <TableCell className={cn("font-medium", comprado && "line-through")}>
                    {item.name}
                  </TableCell>
                  <TableCell className="text-neutral-500">{item.category?.name ?? "—"}</TableCell>
                  <TableCell>
                    {item.current} {item.unit}
                  </TableCell>
                  <TableCell>
                    {item.min} {item.unit}
                  </TableCell>
                  <TableCell className="text-neutral-500">
                    {item.ideal !== null ? `${item.ideal} ${item.unit}` : "não definido"}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {item.suggestedQty} {item.unit}
                  </TableCell>
                  <TableCell className="print:hidden">{currency(item.estimatedCost)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
