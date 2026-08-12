import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  pluggyConfigured,
  getAccounts,
  getTransactions,
  type PluggyAccount,
  type PluggyTransaction,
} from "@/lib/pluggy";
import { ConnectButton } from "./connect-button";
import { RemoveButton } from "./remove-button";

export const maxDuration = 60;

const currency = (v: number, code = "BRL") =>
  v.toLocaleString("pt-BR", { style: "currency", currency: code || "BRL" });

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

type Conta = {
  connectionId: string;
  bankName: string;
  account: PluggyAccount;
  transactions: PluggyTransaction[];
  error?: string;
};

export default async function BancosPage() {
  await requirePermission("canViewRelatorios");

  const configured = pluggyConfigured();
  const connections = configured
    ? await prisma.bankConnection.findMany({ orderBy: { createdAt: "asc" } })
    : [];

  const from = isoDaysAgo(30);
  const to = isoDaysAgo(0);

  // Busca contas e extrato de cada conexão (ao vivo na Pluggy).
  const contas: Conta[] = [];
  for (const conn of connections) {
    try {
      const accounts = await getAccounts(conn.itemId);
      for (const account of accounts) {
        let transactions: PluggyTransaction[] = [];
        try {
          transactions = await getTransactions(account.id, from, to);
        } catch {
          transactions = [];
        }
        contas.push({
          connectionId: conn.id,
          bankName: conn.name ?? "Banco",
          account,
          transactions,
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
        transactions: [],
        error: e instanceof Error ? e.message : "Falha ao consultar o banco.",
      });
    }
  }

  const saldoTotal = contas.reduce((s, c) => s + (c.error ? 0 : c.account.balance), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Bancos</h1>
          <p className="text-sm text-neutral-500">
            Conecte suas contas (Open Finance) e veja saldo e extrato automático.
          </p>
        </div>
        {configured && <ConnectButton />}
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saldo total: {currency(saldoTotal)}</CardTitle>
          </CardHeader>
        </Card>
      )}

      {contas.map((c) => (
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
            </div>
            <RemoveButton id={c.connectionId} name={c.bankName} />
          </CardHeader>
          {!c.error && (
            <CardContent>
              <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                Extrato (últimos 30 dias)
              </p>
              {c.transactions.length === 0 ? (
                <p className="text-sm text-neutral-500">Sem movimentações no período.</p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-neutral-500">
                            {t.date.slice(0, 10).split("-").reverse().join("/")}
                          </TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell
                            className={
                              "text-right font-medium " +
                              (t.amount < 0 ? "text-red-600" : "text-emerald-600")
                            }
                          >
                            {currency(t.amount, t.currencyCode)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
