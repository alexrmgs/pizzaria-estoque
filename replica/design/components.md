# Componentes do PDV FB

Direção visual: **escuro de alto contraste com a identidade da FB**. A logo traz o carvão `#262324` como superfície, o laranja `#fe9400` como cor de ação e o branco quente como texto. Montserrat 800 nos títulos e números (mesma família geométrica do letreiro), Geist no corpo e Geist Mono nos valores.

Não usa nada do SaiPos: nem o azul, nem ícones, nem textos. Ícones vêm do Lucide (MIT).

Cada tipo de pedido tem uma cor, sempre acompanhada de ícone e texto (nunca só a cor):
- delivery: azul `#6cb4ff`
- balcão: verde-água `#3ddbc4`
- mesa: lilás `#c99bff`
- ficha: rosa `#ff8ac4`

Arquivos:
- tokens: [tokens.json](tokens.json), [tokens.css](tokens.css) (cópia de `app/pdv-theme.css`)
- código: `components/pdv/{primitives,cards,payment}.tsx`
- vitrine: `/pdv/design`

Contraste: 28 pares, **0 falhas AA**. O menor é a borda do input sobre a superfície, 4.33:1, acima do mínimo de 3:1 para UI.
Escopo: os tokens só valem dentro de `.pdv` (layout `app/(pdv)`), então o resto do app não muda.

Regras para todos os componentes: alvo de toque mínimo de 48px, foco visível com anel laranja de 3px e offset, `prefers-reduced-motion` desliga o pisca-pisca e dinheiro sempre em mono com `tabular-nums`.

```
PdvButton
  variants  primary (laranja), secondary (carvão + borda), ghost, danger (vermelho)
  sizes     sm 36px, md 48px, lg 64px (CTA: Montserrat caixa-alta), icon 48px
  states    default, hover, active (desce 1px), focus-visible (anel laranja), disabled (40%), loading (spinner + aria-busy)
  tokens    bg pdv-accent, text pdv-on-accent, radius pdv-md
  a11y      <button> real; o ícone sozinho exige aria-label
  used on   todas

ModuloTag
  variants  DELIVERY, BALCAO, SALAO, FICHA × contorno | sólido
  tokens    pdv-delivery/balcao/mesa/ficha; no sólido, texto pdv-on-accent
  a11y      ícone aria-hidden + texto — a cor nunca é o único sinal
  used on   S01, S06, S11

Cronometro
  states    normal (muted), alerta ≥75% do limite (amarelo), atrasado ≥ limite (vermelho piscando)
  a11y      aria-label "N minutos, atrasado"
  used on   S01, S11

PdvField
  sizes     48px
  states    default, focus (borda + anel laranja), disabled, erro (borda vermelha + mensagem role=alert ligada por aria-describedby)
  a11y      <label> sempre visível, nunca só placeholder
  used on   S02, S03, S05, S09, S12-S14

PedidoCard
  conteúdo  nº grande, cronômetro, cliente, endereço, tag do tipo, total, hora, entregador ou taxa
  states    normal, hover, focus, atrasado (via cronômetro)
  tokens    borda esquerda de 4px na cor do tipo
  a11y      o card inteiro é um <button> que abre o pedido
  used on   S01

StatusColuna
  states    com pedidos, vazia ("Nada aqui agora")
  a11y      <section> com aria-label "Nome: N pedidos"
  used on   S01

MesaCard
  states    LIVRE (apagada), OCUPADA (lilás), CONTA (laranja sólido: pede ação), OCIOSA (amarelo)
  conteúdo  nº, estado em texto, total, pessoas, tempo
  a11y      aria-label completo; quadrado, cerca de 100px no tablet
  used on   S07

ProdutoTile
  states    normal, hover (borda laranja), esgotado (disabled + texto "Esgotado"), com quantidade no pedido (bolinha laranja)
  a11y      a quantidade tem aria-label "N no pedido"
  used on   S04, S10

FormaPagamentoPicker
  states    selecionada (laranja sólido), normal, foco
  a11y      radio nativo escondido (sr-only): setas do teclado funcionam
  used on   S05, S09

ValorComMotivo
  states    sem valor (motivo desabilitado), com valor sem motivo (erro "Diga o motivo")
  used on   S05, S09

PagamentosParciais
  states    vazio, parcial ("Falta" em laranja), quitado ("Quitado" em verde)
  a11y      total com aria-live=polite
  used on   S09

ConferenciaCaixa
  variants  normal, às cegas (esconde Esperado e Diferença)
  states    não preenchido (—), ok (verde), sobra (amarelo), falta (vermelho)
  a11y      cada input com aria-label "Contado em <forma>"
  used on   S14

KdsCard
  states    normal, atrasado (borda e cabeçalho vermelhos, tempo piscando), item novo (fundo amarelo + "NOVO"), observação (rosa), observação nova (laranja)
  ações     ✕ tira da tela sem mudar o status; "Pronto →" avança
  used on   S11
```

Faltam (entram junto com as telas, em `/replica-build`):
- busca de cliente com resultados (S02)
- modal de opcionais e meio a meio (S04)
- carrinho lateral (S04)
- modal de movimento de caixa (S13)
- toast: usa o `sonner` que já existe
