# Ensaio: demo do Radar de Negócios (`radar-demo.tsx`)

Gold: `phone-touch` do Stageshow (telefone preso no topo, sangrando pela base, tela 1:1).
Mantive: estágio 440×520 com `compact` 358×478 abaixo de 440 px, Phone pinado no topo, cursor de toque
em repouso no canto, loop que volta ao início com causa visível (o cartão sai porque o pedido foi atendido).
Mudei: moldura Android; o chão laranja-claro do próprio produto (faixa do Radar na home) no lugar do cinza da
gold; lista de cartões brancos com os tokens do DESIGN-SYSTEM (Poppins 400/600/700, beringela, laranja, raio 12,
botão de 52 px com rótulo beringela); folha inferior própria (`.ol-sheet`, raio 20) com dois anúncios da vitrine.

Beats (≈11,3 s, em loop):
1. ≈0,9 s — chega o pedido "Moto Honda Titan 160, até 2019" (`Collapse reveal="drop"`, empurra a geladeira para baixo).
2. ≈3,2 s — toque em "Propor Produto": escurece a tela e sobe "Oferecer da sua vitrine".
3. ≈4,9 s — toque em "Honda CG Titan 160 · 2019": a linha fica laranja-claro com check.
4. ≈6,1 s — toque em "Enviar proposta": vira "Enviando…" com spinner e a folha desce.
5. ≈7,6 s — payoff: o botão vira verde "Proposta enviada" e a contagem rola para "1 de 5 propostas enviadas"; segura 2,7 s.
6. ≈10,3 s — o cartão sai, a lista volta ao repouso, o cursor volta ao canto; o loop recomeça.
Poster (`poster`): o estado 5, com o resultado em tela (é o que aparece com movimento reduzido).

Capturado: larguras 440 e 390 (`--width 390`); loop com `--gate` (30×500 ms) nas duas larguras; `--states`;
`--reduced` (poster); closes `--at novo/enviada/sai` com `--slow 3-4`; `--zoom target:propor`;
`scripts/jumps.mjs` (cobertura completa, sem saltos). Tudo no playground Vite do kit (`?capture=olaki-radar`).

Gate: `rehearsal passed (necessary, not sufficient: references/verify.md and the fresh eye in review.md still stand)`
— loop em 440 e loop em 390, após a última mudança de conteúdo.

Film (cada linha → quadro → correção ou por que fica):
- `clipped: div.ol-scrim clipped top by 11px by div.ss-phone__screen` → olaki-loop-wide.png (abertura da folha) → corrigido: `top: -48px` (altura da barra de status Android).
- `appears with no entrance` / `vanishes with no exit` do ícone do botão (avião → check) → beat-enviada.png → corrigido com `IconSwap` (os dois ícones empilhados no slot `icon` do Button, crossfade).
- `steps in its box` na etiqueta "Esta semana" quando a lista se move → beat-novo-slow.png → corrigido com `will-change: transform` em `.ol-card`.
- `clipped: … "Outros"` chip cortado pelo cartão → still da 1ª rodada → corrigido: chip removido, padding 0 17px.
- `near aligned: .ol-head__title e .ol-tag "Precisa hoje" 13,3px` → olaki-still-wide.png → fica: o título do cabeçalho encosta na margem da tela (16 px) e a etiqueta fica dentro do cartão (16 + 1 de borda + 16 de padding); é a geometria real do app.
- `handoff shift: span.ss-roll__item … -0,3px, 0,8×0,1px` (Roll de "1 de 5 propostas enviadas") → beat-enviada-zoom.png → fica: deslocamento subpixel interno do Roll ao terminar a rolagem; não aparece a 1x nem no zoom 4x.
- `layout: div.ol-slot leaves -82px below … inside div.ss-phone__window` → fica: o telefone sangra pela base do estágio de propósito (gold `phone-touch`).
- `incomplete: sampling gap(s) exceeded 27ms` → máquina lenta nas capturas; o `jumps.mjs` com cobertura completa não achou salto.
- Quadro oliva na troca laranja→verde do botão → beat-enviada-zoom.png (0,00 s) → fica: matizes distantes passam pelo "barro" de qualquer jeito (motion.md); a transição do kit é de 160 ms.

Review (olho fresco, subagente com review.md + verify.md + gold) → resposta:
1. "A capa mostra a geladeira com barras cinza" → a capa é o `poster` (estado enviado, olaki-reduced.png); o still de repouso é o início do loop. Mesmo assim troquei as barras da descrição da geladeira por palavras reais ("Pode ser usada, funcionando bem." / "Compradora: Lúcia"); o cartão de preenchimento de baixo segue em barras porque é borda cortada pelo estágio.
2. "Chão colorido, diferente da gold" → proposital: é a faixa laranja-claro do Radar na home do Mercado da Região.
3. "Cartões brancos, mais magros que a gold" → é a densidade real do app (cartão branco sobre #F6F4F7); não inflei o cartão.
4. "Verde fora da paleta" → verde (#12A150) e verde-escuro (#0E7A3D) são os tokens de sucesso do DESIGN-SYSTEM.md; fica.
5. "Oliva na troca laranja→verde" → ver acima; fica.
6. "Rótulo borrado a 0,10 s" → é o crossfade com leve subida do `Roll variant="fade"` do Button do kit (um quadro a meia opacidade); fica.
7. "Fim do loop ≠ início na folha --states" → o quadro `end` cai no meio da 2ª volta (janela de 12 s); o loop termina no repouso (beat-sai-slow.png).
8. "Texto pequeno em 390" → o film.mjs marca texto abaixo de 10 px e não marcou; etiquetas 13 px e horário 14 px dentro do telefone de 326 px.

Assumptions: nomes, cidade (Corrente) e valores são fictícios; o verde de sucesso é o do design system;
a demo entra na home (faixa do Radar) ou fica na página de conferência `/demo/radar`.
Unresolved: contraste do branco sobre verde-escuro no botão "Proposta enviada" (≈5,4:1 por cálculo, não medido em tela).
Checado no projeto Next.js: `tsc --noEmit` passa com React 19 e lucide-react 0.544 (kit e demo em `src/components/demo`).
Not checked: renderização dentro do Next.js (`next dev`/`next build`) — sem chaves do Clerk/Supabase neste ambiente;
Android real; a demo no lugar definitivo da home.
