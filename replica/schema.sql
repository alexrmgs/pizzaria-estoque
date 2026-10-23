-- PDV (substituto do SaiPos) — esquema proposto.
-- Segue as convenções do pizzaria-estoque (Prisma 7): tabelas "PascalCase",
-- colunas camelCase, id text (cuid gerado pelo Prisma), dinheiro em
-- numeric(10,2) e datas em timestamp(3). Vira os models no schema.prisma e uma
-- migração em prisma/migrations, aplicada pelo Supabase SQL Editor (nunca no
-- build da Vercel).
-- Acesso: sem RLS (o app conecta com usuário de serviço). Toda query passa
-- pelo data layer, que confere se o storeId/companyId pertence à empresa do
-- usuário logado (requirePdv em lib/dal.ts).

-- ───────────── Ajustes em tabelas existentes ─────────────

alter table "Store"
  add column "pdvAtivo" boolean not null default false,          -- liga o PDV e desliga o sync SaiPos dessa loja
  add column "pdvTaxaServicoPct" numeric(5,2) not null default 10,
  add column "pdvPrecoMeioAMeio" text not null default 'MAIOR'
    check ("pdvPrecoMeioAMeio" in ('MAIOR','MEDIA')),
  add column "pdvFechamentoCego" boolean not null default false,
  add column "pdvTempoOciosoMin" integer not null default 0;     -- 0 = desligado

alter table "Role"
  add column "canOperarPdv" boolean not null default false,      -- lançar venda, mover status, caixa próprio
  add column "canGerenciarPdv" boolean not null default false;   -- cardápio, status, praças, cancelar, conferir caixa de outro

-- baixa de estoque feita por uma venda: permite estornar no cancelamento e
-- não baixar duas vezes
alter table "StockMovement" add column "pdvVendaId" text;
create index on "StockMovement" ("pdvVendaId");

-- fila de impressão já existente ganha o tipo COMANDA
alter type "PrintJobType" add value 'COMANDA';
alter table "PrintJob"
  add column "storeId" text references "Store"(id) on delete cascade,
  add column "pracaId" text,
  add column "conteudo" text;                                    -- texto ESC/POS-friendly já formatado
create index on "PrintJob" ("storeId", "status", "createdAt");

-- ───────────── Cardápio (por empresa) ─────────────

create table "PdvCategoria" (
  id text primary key,
  "companyId" text not null references "Company"(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  "createdAt" timestamp(3) not null default now(),
  "updatedAt" timestamp(3) not null,
  unique ("companyId", nome)
);

create table "PdvProduto" (
  id text primary key,
  "companyId" text not null references "Company"(id) on delete cascade,
  "categoriaId" text not null references "PdvCategoria"(id) on delete restrict,
  nome text not null,
  preco numeric(10,2) not null check (preco >= 0),
  "recipeId" text references "Recipe"(id) on delete set null,  -- ficha técnica → baixa de estoque
  "maxSabores" integer not null default 1 check ("maxSabores" between 1 and 4), -- >1 = meio a meio
  "cobraServico" boolean not null default true,
  codigo text,                                                   -- código rápido / código de barras
  ordem integer not null default 0,
  ativo boolean not null default true,
  "createdAt" timestamp(3) not null default now(),
  "updatedAt" timestamp(3) not null
);
create index on "PdvProduto" ("companyId", "categoriaId", ordem);
create unique index on "PdvProduto" ("companyId", codigo) where codigo is not null;

create table "PdvGrupoOpcao" (
  id text primary key,
  "companyId" text not null references "Company"(id) on delete cascade,
  nome text not null,                                            -- "Borda", "Adicionais"
  minimo integer not null default 0,
  maximo integer not null default 1,
  check (maximo >= minimo and minimo >= 0)
);
create index on "PdvGrupoOpcao" ("companyId");

create table "PdvOpcao" (
  id text primary key,
  "grupoId" text not null references "PdvGrupoOpcao"(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) not null default 0 check (preco >= 0),
  "recipeId" text references "Recipe"(id) on delete set null,
  ordem integer not null default 0,
  ativo boolean not null default true
);
create index on "PdvOpcao" ("grupoId");

create table "PdvProdutoGrupo" (
  "produtoId" text not null references "PdvProduto"(id) on delete cascade,
  "grupoId" text not null references "PdvGrupoOpcao"(id) on delete cascade,
  ordem integer not null default 0,
  primary key ("produtoId", "grupoId")
);
create index on "PdvProdutoGrupo" ("grupoId");

create table "PdvFormaPagamento" (
  id text primary key,
  "companyId" text not null references "Company"(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('DINHEIRO','CARTAO_CREDITO','CARTAO_DEBITO','PIX','VOUCHER','FIADO','OUTRO')),
  ativo boolean not null default true,
  ordem integer not null default 0,
  unique ("companyId", nome)
);

-- ───────────── Configuração da loja ─────────────

create table "PdvPraca" (
  id text primary key,
  "storeId" text not null references "Store"(id) on delete cascade,
  nome text not null,                                            -- "Forno", "Bar", "Expedição"
  impressora text,                                               -- ip:porta (9100) ou null = só KDS
  vias integer not null default 1,
  unique ("storeId", nome)
);

create table "PdvCategoriaPraca" (
  "storeId" text not null references "Store"(id) on delete cascade,
  "categoriaId" text not null references "PdvCategoria"(id) on delete cascade,
  "pracaId" text not null references "PdvPraca"(id) on delete cascade,
  primary key ("storeId", "categoriaId")
);
create index on "PdvCategoriaPraca" ("pracaId");

create table "PdvStatus" (
  id text primary key,
  "storeId" text not null references "Store"(id) on delete cascade,
  nome text not null,
  ordem integer not null,
  cor text not null default '#64748b',
  tag text check (tag in ('PRODUCAO','PRONTO','EM_ENTREGA','ENTREGUE','FINALIZADO')),
  unique ("storeId", ordem)
);
create unique index on "PdvStatus" ("storeId", tag) where tag is not null;

create table "PdvEntregador" (
  id text primary key,
  "storeId" text not null references "Store"(id) on delete cascade,
  nome text not null,
  telefone text,
  ativo boolean not null default true
);
create index on "PdvEntregador" ("storeId");

create table "PdvMesa" (
  id text primary key,
  "storeId" text not null references "Store"(id) on delete cascade,
  numero integer not null,
  ativa boolean not null default true,
  unique ("storeId", numero)
);

-- ───────────── Clientes (por empresa: o mesmo cliente compra em qualquer loja) ─────────────

create table "PdvCliente" (
  id text primary key,
  "companyId" text not null references "Company"(id) on delete cascade,
  nome text not null,
  telefone text,                                                 -- só dígitos, com DDD
  cpf text,
  obs text,
  "createdAt" timestamp(3) not null default now(),
  "updatedAt" timestamp(3) not null
);
create unique index on "PdvCliente" ("companyId", telefone) where telefone is not null;
create index on "PdvCliente" ("companyId", nome);

create table "PdvEndereco" (
  id text primary key,
  "clienteId" text not null references "PdvCliente"(id) on delete cascade,
  cep text,
  logradouro text not null,
  numero text,
  bairro text,
  complemento text,
  referencia text,
  "createdAt" timestamp(3) not null default now()
);
create index on "PdvEndereco" ("clienteId");

-- ───────────── Caixa ─────────────

create table "PdvCaixa" (
  id text primary key,
  "storeId" text not null references "Store"(id) on delete cascade,
  "abertoPorId" text not null references "User"(id) on delete restrict,
  "valorInicial" numeric(10,2) not null default 0 check ("valorInicial" >= 0),
  "abertoEm" timestamp(3) not null default now(),
  "fechadoEm" timestamp(3),
  "fechadoPorId" text references "User"(id) on delete restrict,
  cego boolean not null default false,
  obs text
);
-- um caixa aberto por usuário por loja
create unique index on "PdvCaixa" ("storeId", "abertoPorId") where "fechadoEm" is null;
create index on "PdvCaixa" ("storeId", "abertoEm");

create table "PdvCaixaMovimento" (
  id text primary key,
  "caixaId" text not null references "PdvCaixa"(id) on delete cascade,
  tipo text not null check (tipo in ('REFORCO','SANGRIA','DESPESA','TRANSFERENCIA')),
  valor numeric(10,2) not null check (valor > 0),
  motivo text not null,
  "destinoCaixaId" text references "PdvCaixa"(id) on delete restrict,
  "userId" text not null references "User"(id) on delete restrict,
  "createdAt" timestamp(3) not null default now(),
  check ((tipo = 'TRANSFERENCIA') = ("destinoCaixaId" is not null))
);
create index on "PdvCaixaMovimento" ("caixaId");

create table "PdvCaixaConferencia" (
  "caixaId" text not null references "PdvCaixa"(id) on delete cascade,
  "formaId" text not null references "PdvFormaPagamento"(id) on delete restrict,
  esperado numeric(10,2) not null,
  contado numeric(10,2) not null,
  primary key ("caixaId", "formaId")
);

-- ───────────── Vendas ─────────────

-- número do pedido por loja por dia, sem corrida: UPDATE ... RETURNING
create table "PdvContador" (
  "storeId" text not null references "Store"(id) on delete cascade,
  dia date not null,
  ultimo integer not null default 0,
  primary key ("storeId", dia)
);

-- Uma venda = um pedido de delivery/balcão/ficha OU uma comanda de salão.
-- Várias comandas na mesma mesa = várias vendas com o mesmo mesaId.
create table "PdvVenda" (
  id text primary key,
  "storeId" text not null references "Store"(id) on delete restrict,
  numero integer not null,
  dia date not null,                                             -- dia operacional (America/Fortaleza)
  modulo text not null check (modulo in ('DELIVERY','BALCAO','SALAO','FICHA')),
  canal text not null default 'LOJA_PROPRIA',                    -- mesmo texto livre de Revenue.channel
  "numeroParceiro" text,
  "clienteId" text references "PdvCliente"(id) on delete set null,
  "enderecoTexto" text,                                          -- foto do endereço no momento da venda
  "entregadorId" text references "PdvEntregador"(id) on delete set null,
  "statusId" text references "PdvStatus"(id) on delete restrict, -- null no salão
  "mesaId" text references "PdvMesa"(id) on delete restrict,
  "comandaNumero" integer,
  pessoas integer not null default 1 check (pessoas > 0),
  "garcomId" text references "User"(id) on delete set null,
  "agendadoPara" timestamp(3),
  subtotal numeric(10,2) not null default 0,
  "taxaEntrega" numeric(10,2) not null default 0 check ("taxaEntrega" >= 0),
  acrescimo numeric(10,2) not null default 0 check (acrescimo >= 0),
  "acrescimoMotivo" text,
  desconto numeric(10,2) not null default 0 check (desconto >= 0),
  "descontoMotivo" text,
  "taxaServico" numeric(10,2) not null default 0 check ("taxaServico" >= 0),
  total numeric(10,2) not null default 0 check (total >= 0),
  "obsEntrega" text,
  situacao text not null default 'ABERTA' check (situacao in ('ABERTA','PEDIU_CONTA','PAGA','CANCELADA')),
  "canceladaEm" timestamp(3),
  "cancelMotivo" text,
  "clientRequestId" text not null,                               -- idempotência do "Fechar pedido"
  "createdById" text not null references "User"(id) on delete restrict,
  "createdAt" timestamp(3) not null default now(),
  "updatedAt" timestamp(3) not null,
  "fechadaEm" timestamp(3),
  unique ("storeId", dia, numero),
  unique ("clientRequestId"),
  check ((situacao = 'CANCELADA') = ("canceladaEm" is not null))
);
create index on "PdvVenda" ("storeId", situacao, "updatedAt");   -- kanban/KDS polling
create index on "PdvVenda" ("storeId", dia);
create index on "PdvVenda" ("clienteId");
create index on "PdvVenda" ("entregadorId");
create index on "PdvVenda" ("statusId");
create index on "PdvVenda" ("mesaId") where situacao in ('ABERTA','PEDIU_CONTA');
create index on "PdvVenda" ("createdById");
create index on "PdvVenda" ("garcomId");
-- nº de comanda não repete entre comandas abertas da loja
create unique index on "PdvVenda" ("storeId", "comandaNumero")
  where "comandaNumero" is not null and situacao in ('ABERTA','PEDIU_CONTA');

create table "PdvVendaItem" (
  id text primary key,
  "vendaId" text not null references "PdvVenda"(id) on delete cascade,
  "produtoId" text not null references "PdvProduto"(id) on delete restrict,
  nome text not null,                                            -- foto do nome (cardápio muda)
  qtd numeric(10,3) not null check (qtd > 0),
  "precoUnit" numeric(10,2) not null check ("precoUnit" >= 0),   -- já com sabores e opções
  total numeric(10,2) not null check (total >= 0),
  obs text,
  "cobraServico" boolean not null default true,
  "pracaId" text references "PdvPraca"(id) on delete set null,
  "adicionadoDepois" boolean not null default false,             -- KDS pinta de amarelo
  "enviadoEm" timestamp(3),                                      -- impresso/enviado à cozinha
  "prontoEm" timestamp(3),
  "canceladoEm" timestamp(3),
  "cancelMotivo" text,
  "userId" text not null references "User"(id) on delete restrict,
  "createdAt" timestamp(3) not null default now()
);
create index on "PdvVendaItem" ("vendaId");
create index on "PdvVendaItem" ("produtoId");
create index on "PdvVendaItem" ("pracaId", "prontoEm");

-- meio a meio: um item com 2+ sabores (fração = 1/n)
create table "PdvVendaItemSabor" (
  id text primary key,
  "itemId" text not null references "PdvVendaItem"(id) on delete cascade,
  "produtoId" text not null references "PdvProduto"(id) on delete restrict,
  nome text not null,
  fracao numeric(4,3) not null check (fracao > 0 and fracao <= 1)
);
create index on "PdvVendaItemSabor" ("itemId");
create index on "PdvVendaItemSabor" ("produtoId");

create table "PdvVendaItemOpcao" (
  id text primary key,
  "itemId" text not null references "PdvVendaItem"(id) on delete cascade,
  "opcaoId" text not null references "PdvOpcao"(id) on delete restrict,
  nome text not null,
  qtd integer not null default 1 check (qtd > 0),
  preco numeric(10,2) not null default 0
);
create index on "PdvVendaItemOpcao" ("itemId");
create index on "PdvVendaItemOpcao" ("opcaoId");

create table "PdvPagamento" (
  id text primary key,
  "vendaId" text not null references "PdvVenda"(id) on delete cascade,
  "formaId" text not null references "PdvFormaPagamento"(id) on delete restrict,
  "caixaId" text references "PdvCaixa"(id) on delete restrict,   -- null = pago online / fiado
  valor numeric(10,2) not null check (valor > 0),
  "trocoPara" numeric(10,2) check ("trocoPara" is null or "trocoPara" >= valor),
  "estornadoEm" timestamp(3),
  "userId" text not null references "User"(id) on delete restrict,
  "createdAt" timestamp(3) not null default now()
);
create index on "PdvPagamento" ("vendaId");
create index on "PdvPagamento" ("caixaId", "formaId");
create index on "PdvPagamento" ("formaId");

create table "PdvStatusHistorico" (
  id text primary key,
  "vendaId" text not null references "PdvVenda"(id) on delete cascade,
  "statusId" text references "PdvStatus"(id) on delete set null,
  evento text not null,                                          -- 'STATUS','CANCELADA','PAGA','ITEM_ADD','ITEM_CANCEL'
  "userId" text references "User"(id) on delete set null,
  "createdAt" timestamp(3) not null default now()
);
create index on "PdvStatusHistorico" ("vendaId", "createdAt");

-- o FK do PrintJob.pracaId só existe depois de PdvPraca
alter table "PrintJob"
  add constraint "PrintJob_pracaId_fkey" foreign key ("pracaId") references "PdvPraca"(id) on delete set null;
create index on "PrintJob" ("pracaId");
alter table "StockMovement"
  add constraint "StockMovement_pdvVendaId_fkey" foreign key ("pdvVendaId") references "PdvVenda"(id) on delete set null;
