# Build log — PDV FB

| tela | data | estado | o que falta | mais difícil que parecia |
| --- | --- | --- | --- | --- |
| shell (layout, nav, setup automático) | 2026-10-23 | feito | — | o setup importa o cardápio das Receitas com preço; status e formas padrão são criados por loja |
| S01 quadro de pedidos | 2026-10-23 | parcial | filtros, coluna Cancelados, arrastar | atualização: router.refresh a cada 4s, sem WebSocket |
| S04 lançar itens | 2026-10-23 | parcial | opcionais, meio a meio, delivery | — |
| S05 pagamento | 2026-10-23 | parcial | dividir em várias formas, acréscimo, cupom, NFC-e | — |
| S06 detalhe/reimpressão | 2026-10-23 | parcial | é só a via impressa + cancelar; falta editar itens/pagamento | impressão automática pelo navegador volta pra venda no `afterprint` |
| S12 abrir caixa | 2026-10-23 | feito | — | — |
| S13 movimentos de caixa | 2026-10-23 | feito | transferência entre caixas | — |
| S14 fechar caixa | 2026-10-23 | parcial | modo às cegas, bloqueio com mesa aberta (não há mesas ainda) | — |

Não testado de ponta a ponta ainda: depende de rodar `prisma/migrations/20261023120000_pdv_fatia1/migration.sql` no Supabase.
Sem screenshots em replica/clone-screens: as telas exigem login + tabelas no banco.
