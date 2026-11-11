# Style lock — Mercado da Região

Established: 2026-11-10. Source: user-specified. Copiado de `docs/DESIGN-SYSTEM.md`, `docs/MARCA.md` e `src/app/globals.css` (ramo main, commit 0ec8b4f). Nenhuma cor, letra ou medida foi criada aqui. Se este arquivo e o `globals.css` divergirem, vale o `globals.css` e este arquivo deve ser corrigido.

## Palette
- Background: #f7f8fa (`fundo`, fundo das telas)
- Surface: #ffffff (`cartao`, cards, folhas, formulários)
- Primary: #ff6a13 (`laranja`, botão principal, pin, etiquetas)
- Accent: #c2410c (`laranja-escuro`, links e texto laranja sobre claro, foco)
- Brand dark: #4b1248 (`beringela`, títulos, marca, ícones, fundo escuro)
- Text primary: #342b3b (`texto`) — contraste sobre o fundo: 12,71 (AA passa)
- Text muted: #5e5266 (`texto-suave`)
- Button label color: beringela #4b1248 — contraste sobre Primary: 4,95. Branco sobre o laranja reprova (2,87).
- Semânticas: verde #12a150 (só ícone e selo), verde-escuro #0e7a3d (WhatsApp, sucesso), perigo #b91c1c, aviso #b45309, borda #e6e0e9 (decorativa), borda-campo #968b9e, selecao #f0eaf5.
- Dark mode: not needed for this project — single mode only (modo escuro é fase 2 no DESIGN-SYSTEM).

## Color contract

Matriz de `scripts/check_contrast.py --matrix text=#342b3b bg=#f7f8fa surface=#ffffff primary=#ff6a13 accent=#c2410c border=#968b9e on-primary=#4b1248`, rodada em 2026-11-10:

- Text-safe (>=4.5): beringela/cartao 14,20 · texto/cartao 13,51 · beringela/fundo 13,36 · texto/fundo 12,71 · laranja-escuro/cartao 5,18 · beringela/laranja 4,95 · laranja-escuro/fundo 4,87 · texto/laranja 4,71
- UI-safe (>=3.0 e <4.5): borda-campo/beringela 4,38 · borda-campo/texto 4,17 · borda-campo/cartao 3,24 · borda-campo/fundo 3,05
- Decorative (<3.0): laranja/cartao 2,87 · laranja/fundo 2,70 · laranja-escuro/beringela 2,74 · laranja-escuro/texto 2,61 · laranja/laranja-escuro 1,81

Fora da matriz, conferidos no DESIGN-SYSTEM: branco/laranja-escuro 5,2 · branco/verde-escuro 5,4 · branco/verde 3,4 (só ícone) · texto-suave/branco 7,3 · perigo/perigo-fundo 5,9 · verde-escuro/sucesso-fundo 5,0. Laranja-escuro sobre `selecao` não chega a 4,5: usar beringela.

A matriz não cobriu `selecao`, `aviso-fundo` e `patrocinado-fundo` como fundo. Rodar de novo antes de criar par novo com eles.

## Typography
- Família única: Poppins (a do logo), pesos 400, 600 e 700, via `next/font`.
- Escala em `globals.css` (rem): 11 legenda · 12 apoio, botões e rótulos · 13 texto · 14 título de card · 15 seção · 16 e 18 título da tela · 20 `text-3xl`.
- Campos ficam em 16 px no toque (evita zoom do iPhone).
- Título da vitrine: `text-vitrine`, 22 px no celular até 32 px no computador, só no h1 do Início (criado em 2026-11-10 com a home "Duas portas").

## Shape language
- Corner radius: 8 px campos, chips e botões (`radius-campo`) · 10 px cards (`radius-card`) · 20 px folhas (`radius-folha`) · cheio em selos e avatar.
- Shadow depth: quase plano. `shadow-1` em card público que precisa separar, `shadow-2` em folhas e barras fixas.
- Border usage: borda discreta de 1 px antes de sombra.

## Density & spacing
- Base unit: 4px. Em uso: 4, 8, 12, 16, 24, 32, 48. Margem lateral das telas: 16.
- Compact/dense card internal padding: 12 px (10 px no card de anúncio).
- Controles: 44 px no toque, 40 px com mouse, 32 px em ações dentro de cards e tabelas.
- Overall density: compacta, tela de dados.
- Section separation: espaço fixo entre seções, sem faixa colorida nem divisória.

## Structure
Omitido: projeto de aplicativo (cabeçalho + barra de baixo). A forma das telas segue `docs/TELAS-E-FLUXOS.md`.

## Reference intelligence
- Reference board: `.tastemaker/reference-board.md` (fontes vistas: OLX, OfferUp, GetNinjas).
- Design read: aplicativo de classificados para moradores e lojas de Corrente e região, modo Operate, visual simples e da região.
- Foundation: stack do próprio repositório (Tailwind v4 + shadcn + lucide-react).
- Anti-references: roxo violeta do OLX (#6E0AD6), imagem de banco de imagens na home.

## Taste memory
- Profile priors used: none (`~/.tastemaker/profile.md` não existe).
- Decision log: `.tastemaker/decisions.log`
- Last resolved decisions: 2026-11-10 kept — home "no começo" na variação 2 "Duas portas"; rejected — variação 1 "Três passos". As decisões anteriores do Raniel estão no DESIGN-SYSTEM e viraram a lista "Do not" abaixo.
- Pending review: ver `decisions.log`.
- Profile promotion: none.

## Navigation chrome
- Celular: barra de baixo fixa com Início · Buscar · [+ Anunciar] · Radar · Conta, ícone e nome sempre.
- Computador: cabeçalho com logo, cidade, Buscar, Radar, Anunciar (laranja), avisos e Conta.
- Item ativo: fundo `selecao` com texto beringela.

## Mood descriptors
Simples, confiável, da região.

## Assets
- Anchor asset: `public/logo/mercado-da-regiao-marca.svg`
- Asset style: ícones lucide-react, traço 2 px, sempre com palavra ao lado nos menus.
- Illustration vs. photography split: fotos reais dos produtos e das lojas. Nenhuma ilustração em uso.
- Logo: `public/logo/mercado-da-regiao-*.svg` — marca existente preservada (M beringela segurando o pin laranja), Poppins Bold.

## Motion
- Feel: rápido e contido.
- Curves: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
- Durations: pressão 120 ms, cor 150 ms.
- Screen tracks: aplicativo. Sem animação de entrada de página nem movimento contínuo.
- Reduced motion: o deslocamento de 1 px some; cores continuam.
- Verified by: `scripts/audit_motion.py src/app src/components` em 2026-11-10 — 1 HIGH (`ease-in` em `src/components/ui/sheet.tsx:56`) e arquivos de `components/ui` sem ramo de movimento reduzido. Pendente (Fase 3).

## Do not
- Texto branco sobre o laranja #ff6a13.
- Roxo violeta vivo. O beringela puxa para o vinho.
- Bege ou `laranja-claro` na interface.
- Dois botões laranja na mesma tela.
- Ícone sozinho para ação importante.
- Destaque pago sem a palavra "Patrocinado".
- Imagem de banco de imagens na home.
- Trocar ou recolorir o logo.
