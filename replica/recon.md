# Recon map: SaiPos (web, PDV + pedidos)

Escopo: PDV + pedidos. Inclui delivery/balcão, salão (mesas e comandas), ficha, kanban de pedidos, KDS, frente de caixa e impressão.
Para: uso interno nas lojas do Alex, substituindo o SaiPos (não é produto pra vender).
Data: 2026-10-23

Fontes: só material público (site, central de ajuda). A conta SaiPos do usuário não foi usada.
Os termos do SaiPos podem proibir usar a conta para construir um sistema concorrente. Como o uso aqui é interno, o risco é baixo, mas a conta só entra se o próprio usuário navegar e tirar prints.

## Fontes

| # | fonte | URL | observações |
| --- | --- | --- | --- |
| 1 | central de ajuda (índice) | https://intercom.help/meajuda-saipos/pt-BR/ | 13 coleções, cerca de 430 artigos |
| 2 | ajuda: Vendas | https://intercom.help/meajuda-saipos/pt-BR/collections/19755213-vendas | 73 artigos, a melhor lista de funcionalidades |
| 3 | ajuda: Frente de caixa | https://intercom.help/meajuda-saipos/pt-BR/collections/19755234-frente-de-caixa | 12 artigos |
| 4 | ajuda: Impressoras e comandas | https://intercom.help/meajuda-saipos/pt-BR/collections/19755207-impressoras-e-comandas | 27 artigos |
| 5 | ajuda: registrar venda delivery/balcão | https://intercom.help/meajuda-saipos/pt-BR/articles/17020549-como-registrar-vendas-de-delivery-ou-balcao | passo a passo do fluxo principal |
| 6 | ajuda: kanban / tela de pedidos | https://intercom.help/meajuda-saipos/pt-BR/articles/17020532-filtros-e-movimentacoes-na-tela-de-pedidos | colunas, card, filtros |
| 7 | ajuda: módulo de salão | https://intercom.help/meajuda-saipos/pt-BR/articles/17020572-modulo-de-salao | estados da mesa |
| 8 | ajuda: dividir pagamento no salão | https://intercom.help/meajuda-saipos/pt-BR/articles/17020560-como-dividir-o-pagamento-de-uma-venda-de-salao | dividir por valor, por pessoa ou por item |
| 9 | ajuda: fechar frente de caixa | https://intercom.help/meajuda-saipos/pt-BR/articles/17020676-como-fechar-uma-frente-de-caixa | esperado x em caixa, fechamento às cegas |
| 10 | ajuda: KDS | https://intercom.help/meajuda-saipos/pt-BR/articles/17020595-tela-kds-sistema-de-display-para-cozinha | etapas, cores, timer |
| 11 | site: PDV | https://saipos.com/gestao/fluxo-de-caixa/sistema-pdv | pitch e lista de recursos |
| 12 | site: comanda digital (Garçom) | https://saipos.com/sistema/comanda-digital | app do garçom |
| 13 | site: central de pedidos | https://saipos.com/sistema/restaurante/central-de-pedidos-para-restaurante | canais, roteamento por CEP |
| 14 | preços | https://saipos.com/planos-e-precos | a partir de R$240,79/mês |
| 15 | API de dados SaiPos (já usada no pizzaria-estoque) | (token por loja) | mostra o modelo de venda, item e pagamento |

## Core loop

Lançar um pedido (delivery, balcão ou mesa) → cozinha produz (impressão ou KDS) → pedido avança de status até entregue/pago → caixa fecha batendo com as vendas.

## Telas

| ID | tela | como chegar | propósito | componentes principais | estados |
| --- | --- | --- | --- | --- | --- |
| S01 | Kanban de pedidos (tela inicial) | login | ver e mover pedidos de delivery, balcão e ficha por status | cabeçalho com atalhos de módulos, status dos canais, botão loja aberta/fechada, abas Entrega/Retirada, colunas de status, cards, filtros | vazio, cheio, coluna Cancelados oculta, canal offline |
| S02 | Busca de cliente (delivery/balcão) | barra do S01 ou ícone de moto | achar o cliente por telefone ou nome, ou "balcão sem cliente" | campo de busca, lista de resultados, endereços salvos, "+ novo endereço", opção Balcão | não encontrado → cadastro |
| S03 | Cadastro e edição de cliente/endereço | S02 | nome, telefone, endereço, CEP | formulário, CEP → endereço | erro de validação |
| S04 | Tela de venda (lançamento de itens) | S02, S07 ou S09 | escolher produtos, opcionais, meio a meio e observação | categorias, grade de produtos, busca, leitor de código de barras, modal de opcionais/adicionais, carrinho | carrinho vazio, item sem estoque |
| S05 | Pagamento e entrega | S04 → "PAGAMENTO E ENTREGA" | taxa de entrega, acréscimo, desconto (valor, % ou cupom), forma de pagamento, troco, cupom fiscal + CPF, agendamento | campos de valor com "motivo", seletor de pagamento, troco, checkbox NFC-e | troco < total, cupom inválido |
| S06 | Detalhe da venda | "VER" no card do S01 | editar itens, pagamento, cliente, tipo (delivery ↔ balcão), entregador, observações; reimprimir; cancelar; histórico de status | abas, timeline de status, ações | cancelada, finalizada |
| S07 | Mapa de mesas (Salão) | ícone de garçom | ver as mesas e abrir mesa ou comanda | grade de cards, busca por nº de mesa ou comanda, filtros (em atendimento, finalizadas, canceladas), tamanho da grade, garçom com cadeado | Disponível, Em consumo, Pediu a conta, Ociosa |
| S08 | Mesa/comanda aberta | S07 | consumo, nº de pessoas, várias comandas na mesa, transferir itens, remover item, imprimir parcial, simular conta | lista de itens por comanda, ações | sem itens, pediu a conta |
| S09 | Pagamento do salão | S08 → fechar | dividir tudo (por pessoas ou valor), dividir por item, pagamentos parciais, taxa de serviço, couvert, agrupar comandas, NFC-e | lista de pagamentos, "PAGAR RESTANTE", "DIVIDIR" | parcial, quitado |
| S10 | Venda de ficha | atalho Ficha | venda rápida paga na hora, que gera ficha/senha | igual ao S04, com pagamento direto | — |
| S11 | KDS | atalho KDS ou usuário tipo KDS | cozinha vê e avança os pedidos | filtro de praças, seletor de etapas, cards com timer, botões ➡️ e ❌ | dentro do prazo, atrasado (laranja ou vermelho), item novo (amarelo), observação nova (rosa) |
| S12 | Abrir frente de caixa | ícone de caixa no topo | abrir caixa com troco inicial | valor inicial, usuário | já aberto |
| S13 | Movimentos de caixa | menu do caixa | reforço, retirada/sangria, pagamento de despesa, transferência entre caixas | modal com valor e motivo | — |
| S14 | Fechar frente de caixa | menu do caixa | conferir por forma de pagamento | colunas Esperado x Em caixa, saldo, observação obrigatória se houver diferença, editar pagamentos | às cegas (esconde Esperado), bloqueado com mesa aberta |
| S15 | Lista de frentes de caixa / resumo | menu | histórico e resumo por caixa | tabela, detalhe | — |
| S16 | Configurações: status de venda | Opções da loja | renomear e criar status, tags (Produção, Entregue, Finalizado), migração automática para Finalizado | lista editável | — |
| S17 | Configurações: impressão | Opções da loja | praças/cozinhas por categoria, nº de vias, impressão automática de pedidos importados, layout da comanda, itens zerados | formulários | impressora offline |
| S18 | Entregadores / check-in | atalho Check-in do Entregador | vincular entregador ao pedido e registrar saída e volta | lista e seleção | — |
| S19 | App do garçom (mobile) | celular ou SmartPOS | S07 + S08 + S04 no celular | layout mobile | offline? (não confirmado) |

## Fluxos

```
F01 Pedido delivery por telefone
    S01 -> S02 (digita telefone, Enter) -> escolhe endereço -> S04 (itens) -> S05 (taxa, pagamento, troco) -> fechar -> impressão/KDS -> card na coluna Cozinha
    happy path cliques: ~8 + itens
    edge: cliente novo, endereço novo, troco, cupom inválido, agendado para depois, NFC-e com CPF

F02 Venda de balcão sem cliente
    S01 -> S02 "balcão sem cliente" -> S04 -> S05 -> fechar
    happy path cliques: ~5 + itens

F03 Pedido avança até entregue
    S01 card Cozinha -> Aguardando entrega -> vincula entregador -> Saiu para entrega -> Entregue -> (auto) Finalizado
    edge: cancelar com motivo, voltar status, trocar o pagamento depois

F04 Mesa do início ao fim
    S07 abrir mesa -> S08 (nº de pessoas, comanda) -> S04 itens -> impressão por praça -> ... -> Pediu a conta -> S09 dividir/pagar -> mesa Disponível
    edge: várias comandas na mesa, transferir item entre mesas, remover item já enviado, agrupar comandas, couvert, taxa de serviço só em itens marcados, excluir pagamento lançado errado

F05 Cozinha no KDS
    pedido entra no status com tag Produção -> aparece no S11 filtrado por praça -> etapa 1 ➡️ etapa 2 ➡️ status seguinte
    edge: item adicionado depois (amarelo), atrasado (pisca), item avançado sozinho

F06 Turno de caixa
    S12 abrir com troco -> vendas -> S13 sangria/reforço -> S14 fechar (conta por forma) -> resumo
    edge: mesas abertas bloqueiam o fechamento, diferença exige observação, fechamento às cegas, só quem abriu pode fechar

F07 Pedido de app (iFood) entra sozinho
    integração -> card no S01 + impressão automática
    edge: canal offline, pedidos agrupados do iFood
```

## Componentes

| componente | variantes | estados | usado em |
| --- | --- | --- | --- |
| Card de pedido | delivery, balcão, ficha | normal, tempo no status, cancelado | S01 |
| Coluna de status | cor por status | vazia, com contador | S01 |
| Card de mesa | — | disponível, em consumo, pediu conta, ociosa | S07 |
| Grade de produtos | por categoria | sem estoque, com foto ou sem | S04, S10, S19 |
| Modal de opcionais | obrigatório/opcional, mín/máx, meio a meio | incompleto, ok | S04 |
| Carrinho/lista de itens | editável, só leitura | vazio | S04, S06, S08 |
| Campo de valor com motivo | acréscimo, desconto (R$ ou %) | — | S05, S09 |
| Seletor de forma de pagamento | dinheiro (com troco), cartão, PIX, fiado, online | — | S05, S09, S14 |
| Lista de pagamentos parciais | — | restante > 0, quitado | S09 |
| Card do KDS | — | normal, atrasado, item novo, observação nova, selecionado | S11 |
| Modal de movimento de caixa | reforço, retirada, transferência | — | S13 |
| Tabela Esperado x Em caixa | normal, às cegas | sobra, falta, ok | S14 |
| Busca de cliente | — | carregando, vazio, resultados | S02 |
| Toast/confirmação | sucesso, erro | — | todos |
| Cabeçalho com atalhos e status dos canais | — | canal online/offline, loja aberta/fechada | todos |

## Modelo de dados inferido

```
Loja        id, nome, cnpj, config (taxa_servico_pct, fechamento_cego, tempo_ocioso_min, ...)
            evidência: opções da loja nos artigos   confiança: alta

Cliente     id, loja_id, nome, telefone, cpf?, enderecos[]
Endereco    id, cliente_id, cep, rua, numero, bairro, complemento, referencia
            evidência: S02/S03, artigo 5   confiança: alta

Venda       id, loja_id, numero, modulo (delivery|balcao|salao|ficha), canal (manual|ifood|site|bot...),
            numero_parceiro, cliente_id?, endereco_id?, entregador_id?, status_id, agendado_para?,
            taxa_entrega, acrescimo, acrescimo_motivo, desconto, desconto_motivo, cupom_id?,
            taxa_servico, couvert, total, obs_entrega, caixa_id, criado_em
            evidência: S01, S05, S06, API de dados   confiança: alta

VendaItem   id, venda_id, comanda_id?, produto_id, qtd, preco_unit, obs, cobra_servico, adicionado_depois, cancelado
VendaItemOpcao  id, item_id, opcao_id, qtd, preco
            evidência: S04, KDS (item amarelo = adicionado depois)   confiança: alta

Pagamento   id, venda_id, forma_id, valor, troco_para?, caixa_id, criado_em
            evidência: S05, S09, S14   confiança: alta

StatusVenda id, loja_id, nome, ordem, tag (producao|entregue|finalizado|logistica|cancelado)
StatusHistorico  venda_id, status_id, usuario_id, em
            evidência: S16, artigo "Histórico de status da venda"   confiança: alta

Mesa        id, loja_id, numero, estado (calculado)
Comanda     id, loja_id, numero, mesa_id?, venda_id, pessoas, garcom_id, aberta_em, fechada_em
            evidência: S07/S08 (comanda sem mesa, mesa sem comanda, várias por mesa)   confiança: média

Praca       id, loja_id, nome, impressora, etapas[]   (categoria -> praça)
            evidência: S11, S17   confiança: média

Caixa (frente)  id, loja_id, usuario_abertura_id, valor_inicial, aberto_em, fechado_em, cego
CaixaMovimento  id, caixa_id, tipo (reforco|retirada|sangria|transferencia), valor, motivo, destino_caixa_id?
CaixaConferencia caixa_id, forma_id, esperado, contado, obs
            evidência: S12-S14   confiança: alta

Entregador  id, loja_id, nome, telefone      confiança: alta
Cupom       id, codigo, tipo (valor|pct), valor, validade   confiança: média
Usuario     id, nome, papel (admin|caixa|garcom|kds)      confiança: média
```

Relações: Loja 1-n Venda; Venda 1-n VendaItem, Pagamento, StatusHistorico; Mesa 1-n Comanda; Comanda 1-1 Venda; Caixa 1-n Pagamento, CaixaMovimento.
O cardápio (Produto, Categoria, Opções) e o estoque já existem no pizzaria-estoque: reaproveitar.

## Matriz de funcionalidades

Ver `features.csv`. must: 24, should: 16, could: 8, skip: 6.

## Fora do escopo (não dá ou não vale clonar)

- Integração iFood/Rappi/Aiqfome como "parceiro SaiPos": dá pra fazer pela API oficial do iFood (credenciamento como software house), mas é um projeto à parte. Até lá, o CardápioWeb (MCP já conectado) cobre os pedidos online.
- Emissão de NFC-e: exige certificado, CSC e SEFAZ. Usar um provedor (Focus NFe já está integrado para NF-e recebidas e também emite NFC-e).
- TEF e SmartPOS: integração com adquirente e maquininha. Usar POS separado e registrar a forma manualmente.
- Saipos Bot (WhatsApp com IA), Totem e App do Entregador com roteirização: produtos à parte.
- Balança/peso: não se aplica a pizzaria.

## Tamanho

Telas 19, fluxos 7, entidades ~16. Partes difíceis: (1) tempo real entre caixa, KDS e garçom; (2) impressão térmica confiável por praça (já existe Web Bluetooth para a Knup, mas impressora de cozinha por rede ou USB é outra história); (3) caixa e pagamentos parciais sem erro de centavo, com operação se a internet cair.
Tamanho: **L** (um trimestre) para tudo. Fatia fina com delivery/balcão + kanban + impressão + caixa: **M** (algumas semanas).
