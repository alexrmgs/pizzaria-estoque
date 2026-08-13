import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  pluggyConfigured,
  getAccounts,
  getItem,
  type PluggyAccount,
} from "@/lib/pluggy";
import { ConnectButton } from "./connect-button";
import { RemoveButton } from "./remove-button";
import { ExtratoConta } from "./extrato-conta";
import { AtualizarButton } from "./atualizar-button";

export const maxDuration = 60;

const currency = (v: number, code = "BRL") =>
  v.toLocaleString("pt-BR", { style: "currency", currency: code || "BRL" });

type Conta = {
  connectionId: string;
  bankName: string;
  account: PluggyAccount;
  sincronizando?: boolean;
  error?: string;
};

export default async function BancosPage() {
  await requirePermission("canViewRelatorios");

  const configured = pluggyConfigured();
  const connections = configured
    ? await prisma.bankConnection.findMany({ orderBy: { createdAt: "asc" } })
    : [];

  // Busca contas e extrato de cada conexão (ao vivo na Pluggy).
  const contas: Conta[] = [];
  for (const conn of connections) {
    try {
      // Status do item: se ainda não terminou de atualizar, o extrato pode
      // não ter chegado (a Pluggy puxa o histórico depois do saldo).
      let sincronizando = false;
      try {
        const item = await getItem(conn.itemId);
        sincronizando = !["UPDATED", "OUTDATED"].includes(item.status);
      } catch {
        // ignora
      }
      const accounts = await getAccounts(conn.itemId);
      for (const account of accounts) {
        contas.push({
          connectionId: conn.id,
          bankName: conn.name ?? "Banco",
          account,
          sincronizando,
        });
      }
    } catch (e) {
      contas.push({
        connectionId: conn.id,
        bankName: conn.name ?? "Banco",
        account: {
          id: conn.id,
          type: "",
          subtype: null,
          name: "—",
          marketingName: null,
          number: null,
          balance: 0,
          currencyCode: "BRL",
        },
        error: e instanceof Error ? e.message : "Falha ao consultar o banco.",
      });
    }
  }

  // Separa conta bancária (dinheiro de verdade) de cartão de crédito
  // (fatura/limite) — não dá pra somar os dois como "saldo".
  const bancarias = contas.filter((c) => c.account.type !== "CREDIT");
  const cartoes = contas.filter((c) => c.account.type === "CREDIT");
  const saldoEmConta = bancarias.reduce((s, c) => s + (c.error ? 0 : c.account.balance), 0);
  const faturaCartoes = cartoes.reduce(
    (s, c) => s + (c.error ? 0 : Math.abs(c.account.balance)),
    0,
  );
  const limiteDisponivel = cartoes.reduce(
    (s, c) => s + (c.account.creditData?.availableCreditLimit ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Bancos</h1>
          <p className="text-sm text-neutral-500">
            Conecte suas contas (Open Finance) e veja saldo e extrato automático.
          </p>
        </div>
        {configured && (
          <div className="flex gap-2">
            {connections.length > 0 && <AtualizarButton />}
            <ConnectButton />
          </div>
        )}
      </div>

      {!configured && (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-neutral-600">
              A integração Open Finance ainda não está configurada. Falta cadastrar as chaves da
              Pluggy (PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET).
            </p>
          </CardContent>
        </Card>
      )}

      {configured && connections.length === 0 && (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-neutral-600">
              Nenhum banco conectado ainda. Clique em <b>Conectar banco</b> pra começar (no modo
              teste dá pra usar o banco de sandbox da Pluggy).
            </p>
          </CardContent>
        </Card>
      )}

      {contas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-neutral-500">Saldo em conta</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{currency(saldoEmConta)}</p>
              <p className="text-xs text-neutral-400">dinheiro disponível nas contas</p>
            </CardContent>
          </Card>
          {cartoes.length > 0 && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-neutral-500">Fatura dos cartões</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">{currency(faturaCartoes)}</p>
                  <p className="text-xs text-neutral-400">valor em aberto (não é saldo)</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-neutral-500">Limite disponível</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{currency(limiteDisponivel)}</p>
                  <p className="text-xs text-neutral-400">limite dos cartões (não é saldo)</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* CONTAS BANCÁRIAS */}
      {bancarias.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold uppercase text-neutral-500">Contas bancárias</h2>
          {bancarias.map((c) => {
            const chequeEspecial = c.account.bankData?.overdraftContractedLimit ?? 0;
            return (
              <Card key={c.account.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {c.bankName} — {c.account.marketingName || c.account.name}
                    </CardTitle>
                    <p className="text-sm text-neutral-500">
                      {c.account.number ? `Conta ${c.account.number} · ` : ""}
                      {c.error ? (
                        <span className="text-red-600">{c.error}</span>
                      ) : (
                        <span className="font-semibold text-neutral-700">
                          Saldo: {currency(c.account.balance, c.account.currencyCode)}
                        </span>
                      )}
                    </p>
                    {chequeEspecial > 0 && (
                      <p className="text-xs text-neutral-400">
                        Cheque especial (limite): {currency(chequeEspecial)} — não é saldo
                      </p>
                    )}
                  </div>
                  <RemoveButton id={c.connectionId} name={c.bankName} />
                </CardHeader>
                {!c.error && (
                <ExtratoConta
                  accountId={c.account.id}
                  sincronizando={c.sincronizando}
                  nome={`${c.bankName} ${c.account.marketingName || c.account.name}`}
                />
              )}
              </Card>
            );
          })}
        </div>
      )}

      {/* CARTÕES DE CRÉDITO */}
      {cartoes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold uppercase text-neutral-500">Cartões de crédito</h2>
          {cartoes.map((c) => (
            <Card key={c.account.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {c.bankName} — {c.account.marketingName || c.account.name}
                    {c.account.creditData?.brand ? ` (${c.account.creditData.brand})` : ""}
                  </CardTitle>
                  {c.error ? (
                    <p className="text-sm text-red-600">{c.error}</p>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      <span className="font-semibold text-red-600">
                        Fatura: {currency(Math.abs(c.account.balance), c.account.currencyCode)}
                      </span>
                      {c.account.creditData?.creditLimit != null && (
                        <> · Limite: {currency(c.account.creditData.creditLimit)}</>
                      )}
                      {c.account.creditData?.availableCreditLimit != null && (
                        <> · Disponível: {currency(c.account.creditData.availableCreditLimit)}</>
                      )}
                    </p>
                  )}
                </div>
                <RemoveButton id={c.connectionId} name={c.bankName} />
              </CardHeader>
              {!c.error && (
                <ExtratoConta
                  accountId={c.account.id}
                  sincronizando={c.sincronizando}
                  nome={`${c.bankName} ${c.account.marketingName || c.account.name}`}
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
