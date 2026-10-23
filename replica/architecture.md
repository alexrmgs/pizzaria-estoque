# Architecture: PDV próprio (reconstrução das funções de PDV + pedidos do SaiPos)

Fica dentro do pizzaria-estoque, como mais um grupo de telas (`app/(app)/pdv/...`), e não como app separado. Motivo: cardápio (Recipe), estoque, lojas, usuários e faturamento já moram aqui, e vender precisa baixar estoque.

## Stack

Tudo já está no projeto. Nada novo para aprender nem para pagar.

| camada | escolha | por quê |
| --- | --- | --- |
| web | Next.js 16 (App Router) + TS + shadcn/Tailwind | já é o app; ler `node_modules/next/dist/docs/` antes de codar (AGENTS.md) |
| banco | Postgres no Supabase | o mesmo; migração aplicada no SQL Editor, nunca no build |
| ORM | Prisma 7 + adapter pg | o mesmo; models `Pdv*` |
| auth | NextAuth v5 (já existe) + 2 permissões novas no Role | `canOperarPdv`, `canGerenciarPdv` |
| tempo real | polling de 3s (route handler `?since=`) | simples e funciona na Vercel; trocar por Supabase Realtime só se pesar |
| impressão | fila `PrintJob` (já existe) + agente local no PC da loja enviando ESC/POS para impressora de rede (porta 9100) | o navegador não fala com impressora de rede; Web Bluetooth (Knup) continua para etiqueta |
| impressão (fatia 1) | `window.print()` com layout 80mm | sem agente no começo |
| pagamentos | registro manual da forma (maquininha separada) | TEF/SmartPOS fora do escopo |
| fiscal | depois: NFC-e via Focus NFe (já integrado para NF-e recebidas) | — |
| jobs | Vercel Cron | fechar o dia (gerar Revenue), limpar PrintJob velho |
| hosting | Vercel | o mesmo; o deploy é automático quando a mudança estiver verificada |

Convenções do projeto mantidas, mesmo diferindo do padrão do skill: ids `cuid` em text, dinheiro em `numeric(10,2)` (Decimal do Prisma é exato, não precisa de centavos inteiros) e `timestamp(3)` em UTC, com o dia operacional calculado em America/Fortaleza.

## Schema

20 tabelas novas, mais ajustes em `Store`, `Role`, `StockMovement` e `PrintJob`. SQL completo em [schema.sql](schema.sql).

Acesso: **checagem no data layer**, sem RLS. Um `requirePdv(storeId)` em `lib/dal.ts` confere a permissão e se `store.companyId === user.companyId`. Toda action e rota chama ele.

| grupo | tabelas |
| --- | --- |
| cardápio (por empresa) | PdvCategoria, PdvProduto (→ Recipe), PdvGrupoOpcao, PdvOpcao, PdvProdutoGrupo, PdvFormaPagamento |
| config da loja | PdvPraca, PdvCategoriaPraca, PdvStatus, PdvEntregador, PdvMesa |
| clientes | PdvCliente (telefone único por empresa), PdvEndereco |
| caixa | PdvCaixa, PdvCaixaMovimento, PdvCaixaConferencia |
| vendas | PdvContador, PdvVenda, PdvVendaItem, PdvVendaItemSabor, PdvVendaItemOpcao, PdvPagamento, PdvStatusHistorico |

Decisões que o banco garante, não a tela:
- **Comanda = venda.** A mesa tem N vendas abertas. O nº de comanda é único entre as abertas (índice parcial).
- **Um caixa aberto por usuário por loja** (índice parcial `where fechadoEm is null`).
- **Nº do pedido** por loja por dia, via `PdvContador`: `UPDATE ... SET ultimo = ultimo + 1 RETURNING`. Não usa `max()+1`, que repete número com dois caixas ao mesmo tempo.
- **Clique duplo no "Fechar pedido"** não cria duas vendas: `clientRequestId` único, gerado na tela.
- **Nome e preço são fotografados** no item, para o cardápio poder mudar sem alterar vendas antigas.

## API

Server actions em `app/(app)/pdv/**/actions.ts`, como o resto do app. Route handlers só onde há polling ou acesso de máquina.

| método / caminho | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| action `buscarClientes` | busca por telefone ou nome | operar | termo | clientes + endereços | F01 |
| action `salvarCliente` | cria/edita cliente e endereço | operar | cliente, endereço | cliente | F01 |
| action `criarVenda` | cria venda + itens + pagamentos, numera, enfileira impressão, histórico | operar | venda completa + clientRequestId | venda | F01 F02 |
| action `editarItens` | adiciona/remove item (marca adicionadoDepois, reimprime só o novo) | operar | vendaId, itens | venda | F01 F04 |
| action `moverStatus` | muda status e grava histórico; tag ENTREGUE/FINALIZADO fecha | operar | vendaId, statusId | venda | F03 |
| action `vincularEntregador` | — | operar | vendaId, entregadorId | venda | F03 |
| action `trocarModulo` | delivery ↔ balcão | operar | vendaId, modulo | venda | F03 |
| action `cancelarVenda` | cancela com motivo e estorna o estoque | gerenciar | vendaId, motivo | venda | F03 |
| action `registrarPagamento` / `estornarPagamento` | pagamento parcial ou total; fecha quando quita | operar | vendaId, forma, valor, trocoPara | venda | F04 |
| action `abrirComanda` | abre venda SALAO em mesa e/ou comanda | operar | mesa?, comanda?, pessoas, garçom | venda | F04 |
| action `transferirItens` | move itens entre vendas abertas | operar | itemIds, destinoVendaId | ok | F04 |
| action `pedirConta` / `imprimirParcial` | — | operar | vendaId | ok | F04 |
| GET `/api/pdv/[storeId]/pedidos?since=` | vendas alteradas desde t (kanban) | operar | since | vendas resumidas | F03 |
| GET `/api/pdv/[storeId]/kds?praca=&since=` | itens pendentes por praça | operar ou usuário KDS | praca, since | itens | F05 |
| action `kdsPronto` | marca item(ns) prontos; se todos, avança status | operar | itemIds | ok | F05 |
| action `abrirCaixa` / `movimentoCaixa` / `fecharCaixa` | turno de caixa; fechar bloqueia com mesa aberta e exige obs se houver diferença | operar (fechar: dono do caixa) | valores, contagem por forma | caixa + resumo | F06 |
| GET `/api/pdv/print-jobs?storeId=` | agente local busca PENDENTE | token do agente (header) | — | jobs | impressão |
| POST `/api/pdv/print-jobs/[id]/ok` | agente marca IMPRESSO | token do agente | — | ok | impressão |
| actions de cadastro | cardápio, opções, formas, praças, status, mesas, entregadores | gerenciar | — | — | config |

Webhooks de entrada: nenhum na fase 1. Depois, os pedidos do CardápioWeb (via API dele) e do iFood (API oficial, credenciamento).
Webhooks de saída: nenhum.

Jobs:
- `fechar-dia`, cron 05:00 (Fortaleza): soma as vendas PAGA do dia por loja e canal e grava um `Revenue` (channel `LOJA_PROPRIA`) para lojas com `pdvAtivo`. O financeiro, DRE e relatórios continuam funcionando sem mudança.
- `limpar-print-jobs`, diário: apaga PrintJob IMPRESSO com mais de 7 dias.

## As partes que mordem

- **Fuso:** guardar em UTC e calcular o "dia" em America/Fortaleza. Pizzaria vira a meia-noite aberta: o dia operacional precisa de um corte configurável (ex. 05:00), senão um pedido das 00:30 cai no dia seguinte.
- **Idempotência:** `clientRequestId` na criação. A baixa de estoque marca `pdvVendaId` no StockMovement, então não baixa duas vezes e o cancelamento estorna exatamente o que saiu.
- **Corridas:** número do pedido (contador atômico), dois caixas fechando a mesma mesa (`registrarPagamento` em transação com `SELECT ... FOR UPDATE` na venda), garçom e caixa editando a mesma comanda.
- **Dinheiro:** subtotal, serviço e total são recalculados no servidor a partir dos itens, nunca confiando no valor da tela. Arredondamento do meio a meio: preço pelo MAIOR sabor ou pela MÉDIA (config da loja), arredondado a 2 casas.
- **Tempo real:** polling de 3s × N telas × lojas. Usar `updatedAt > since` com índice; está ok para algumas lojas.
- **Offline:** **o maior risco.** Se a internet da loja cai, o SaiPos (que roda instalado no Windows) segue e este não. Plano: fase 1 com 4G de reserva no roteador. Fila offline (IndexedDB) fica como item próprio depois.
- **Convivência com SaiPos:** enquanto a loja usar os dois, o sync SaiPos e o PDV duplicariam faturamento e baixa de estoque. A flag `Store.pdvAtivo` decide: com ela ligada, o sync SaiPos pula a loja e o PDV assume.
- **Multi-tenant:** cardápio, clientes e formas de pagamento por `companyId`; operação por `storeId`. As tabelas antigas globais (Recipe, Ingredient) seguem globais por enquanto.
- **Impressão:** impressora de rede e agente local são o ponto mais frágil da operação. O agente reimprime o que ficou PENDENTE, e a tela mostra um alerta "impressora parada há X min".
- **LGPD:** cliente tem telefone e endereço, então incluir excluir/anonimizar cliente em cadastro.

## Ordem de construção

1. **Fatia vertical (feia, ponta a ponta):** balcão sem cliente → itens → 1 pagamento → aparece no kanban → imprime via navegador → avança status → fecha caixa.
   - Telas: S04, S05 (só pagamento), S01 (3 colunas fixas), S12, S14 (sem modo às cegas).
   - Tabelas: PdvCategoria, PdvProduto (seed das Recipes PIZZA/BEIRUTE/ESFIHA com `currentPrice`), PdvFormaPagamento, PdvStatus, PdvContador, PdvVenda, PdvVendaItem, PdvPagamento, PdvCaixa, PdvCaixaConferencia, PdvStatusHistorico.
   - Rotas: `criarVenda`, `moverStatus`, GET pedidos, `abrirCaixa`, `fecharCaixa`.
2. **Must (delivery de verdade + operação):**
   - Telas: S02/S03 clientes e endereços, S05 completo (taxa, desconto e acréscimo com motivo, troco), opcionais e **meio a meio**, S06 (editar, cancelar, reimprimir), entregador.
   - Também: filtros do kanban, praças + agente de impressão, sangria/reforço (S13), baixa de estoque pela ficha técnica, flag `pdvAtivo` + job `fechar-dia`.
3. **Should:** salão inteiro (S07–S09: mesas, comandas, transferir, dividir conta, taxa de serviço, bloqueio de caixa com mesa aberta), KDS (S11), fechamento às cegas, histórico de status e de cliente, agendamento, ficha (S10).
4. **Could:** garçom no celular (PWA das telas S07/S08), KDS com etapas, cupom, fiado, couvert, agrupar comandas, transferência entre caixas, código de barras.
5. **Depois:** NFC-e (Focus NFe), pedidos do CardápioWeb/iFood entrando sozinhos, fila offline. Melhorias do `/replica-entrepreneur`, se rodar.
