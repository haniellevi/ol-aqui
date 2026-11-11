# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dois públicos com o mesmo peso. Cada tela decide pelo público dela (confirmado pelo Raniel em 10/11/2026).

- **Comprador da região:** gente de Corrente-PI, extremo sul do Piauí e Formosa do Rio Preto-BA, de 16 a 70 anos. Usa quase sempre um celular Android de entrada, muitas vezes com internet fraca. Vive no WhatsApp, lê pouco e manda áudio. Chega pelo WhatsApp ou pelo Google, procurando algo por perto, e quer chegar ao vendedor em poucos toques. Teste de referência: "dona Maria, 62 anos, vendendo uma geladeira com o celular do neto" (docs/USABILIDADE.md).
- **Loja que paga o plano:** comerciante ou autônomo da região, ocupado, com uma mão no balcão. Usa a vitrine e o Radar para achar clientes e paga a mensalidade.
- **Vendedor pessoa física:** vende as próprias coisas com poucos anúncios grátis e anúncio avulso pago.
- **Equipe do painel admin (`/admin`):** modera anúncios, gerencia usuários, lojas, planos, preços e textos.

## Product Purpose

Shopping digital e classificados regionais. A pessoa encontra produtos e serviços perto dela, ou publica o que procura e recebe ofertas das lojas da região. Ver, buscar e chamar no WhatsApp não exigem conta.

Sucesso: diminuir o tempo entre uma necessidade e uma resposta útil. A métrica-chave é a resposta a "vendeu pelo Mercado da Região?" quando o anúncio é marcado como vendido.

## Positioning

Promessa (confirmada em 10/11/2026): **"Encontre o que precisa por perto ou peça e receba ofertas das lojas da sua região."**

Diferencial: o **Radar de Negócios**. OLX e Marketplace do Facebook são passivos, porque o comprador procura. No Radar, a loja vai atrás do comprador. O Radar é o que justifica a mensalidade das lojas.

Ideia da marca (docs/MARCA.md): o site grande de classificados engole cidade pequena; o Mercado da Região é o mercado onde **a sua cidade aparece**. Regional por desenho (multi-tenant por microrregião, franquia por cidade), não nacional.

## Operating Context

- Uso no celular, tela de 360 px, uma mão, muitas vezes no sol e com pacote de dados acabando.
- A negociação acontece no WhatsApp. O site não intermedia pagamento entre comprador e vendedor.
- Entrada com o celular confirmado por código no WhatsApp; não existe senha para lembrar.
- Destaques e planos são pagos com Pix e boleto pelo Asaas.
- Região-piloto: Corrente-PI, extremo sul do Piauí e Formosa do Rio Preto-BA. Região forte em agro (Matopiba).

## Capabilities and Constraints

- **Stack:** Next.js 15, React 19, Tailwind CSS 4, shadcn/ui (Base UI), Clerk (identidade), Supabase (Postgres com RLS e Storage), Evolution API (código pelo WhatsApp), Asaas (cobrança), publicação na Vercel.
- **Funções:** Início com vitrine e o Radar, categorias com filtros, busca, anunciar em passos, página do anúncio, vitrine da loja, Minha conta (anúncios, plano, favoritos, notificações, privacidade), Radar (pedidos e propostas), robô **Merc**, moderação com IA e painel admin.
- **Regra de ouro:** preços, limites, categorias, nomes de planos e textos que mudam com o negócio vêm do painel admin, nunca ficam fixos no código.
- **Contato do comprador no Radar:** só é revelado a loja com plano pago em dia, da mesma região, dentro do limite de propostas. Quem não paga vê só o "gancho" (título, valor, cidade).
- **Termos:** "Entrar", "Anunciar", "Chamar no WhatsApp", "Pedir no Radar", "Destacar", "Meus anúncios". Sem inglês e sem jargão ("lead", "match", "checkout").
- **Nomes internos antigos de propósito:** repositório `ol-aqui`, banco, colunas como `vendido_pelo_olaki`, classes `olaki-*` e a prévia `ol-aqui.vercel.app` continuam com o nome antigo para não quebrar nada (docs/MARCA.md, seção 7).
- **Em aberto:** cobrança real pelo Asaas ainda precisa ser validada antes de cobrar; o nome "Radar" para o comprador ("Pedir ofertas"?) é hipótese a testar no piloto; repasse do franqueado ainda não decidido; domínio mercadodaregiao.com.br só será ligado no lançamento.

## Brand Commitments

- **Nome:** Mercado da Região (decidido pelo Raniel em 10/11/2026). Escreve-se com M e R maiúsculos e "da" minúsculo; nunca sigla para o público. O robô se chama **Merc** (decidido em 11/11/2026; antes era Aki).
- **Logo oficial:** o "M" de Mercado segurando o pin laranja da Região, com "Mercado" em beringela e "da Região" em laranja, em Poppins Bold. Arquivos em `public/logo/` e `docs/marca/`, gerados por `docs/marca/gerar-logos.mjs`. Regras completas em `docs/MARCA.md`.
- **Frase:** "aqui a sua cidade aparece." Frases de apoio: "Compre, venda e peça perto de casa." · "O que a região tem, está aqui." · "Negócio fechado com quem é daqui."
- **Tom:** fala como um vizinho que entende de negócio: direto, simples, bem-humorado, do interior com orgulho. Trata por "você". Provoca o site grande pela ideia, nunca pelo nome. Não promete venda garantida.

## Evidence on Hand

- Guia da marca: `docs/MARCA.md`. Guia de usabilidade com 12 regras: `docs/USABILIDADE.md`.
- Sistema visual detalhado: `docs/DESIGN-SYSTEM.md`; resumo para quem desenha: `DESIGN.md`. Peças do shadcn em uso: `/admin/pecas`.
- Telas e fluxos: `docs/TELAS-E-FLUXOS.md`; produto e contas: `docs/PRODUTO-CONTAS-ANUNCIOS-ROBO.md`; painel: `docs/PAINEL-ADMIN.md`.
- Registros de QA e validação: `docs/QA-*.md` e `docs/VALIDACAO-*.md` (históricos).
- Demo animada do Radar (lado da loja): `/demo/radar`.
- **Não existem ainda:** depoimentos de clientes, números de uso, lojas parceiras confirmadas publicamente ou casos de sucesso. Não inventar nenhum deles. Quadros ilustrativos levam sempre a etiqueta "Exemplo".

## Product Principles

1. **Do anúncio ao WhatsApp em poucos toques.** Nada pode ficar entre o comprador e o vendedor sem motivo.
2. **Buscar e pedir são um só caminho.** Se a busca não acha, ela vira um pedido no Radar sem redigitar nada.
3. **O comprador controla o contato.** O número só sai quando ele escolhe; existe limite de propostas, prazo e denúncia.
4. **Confiança visível e honesta.** "Patrocinado" sempre escrito, selos dizem o que verificaram, aviso de nunca pagar antes de ver.
5. **Funciona no pior celular, na pior internet.** Leve, tolerante a queda, sem animação pesada.

## Accessibility & Inclusion

- Contraste forte, legível no sol (nada de branco sobre laranja, nada de cinza clarinho).
- Respeitar a letra grande do celular: tamanhos em rem, zoom nunca travado.
- Ícone sempre com palavra, exceto lupa, coração, X e voltar. Nenhum gesto escondido como único caminho.
- Público com leitura lenta: escrever o mínimo, preferir botões a digitação, foto e voz antes de texto.
- Movimento desligado com `prefers-reduced-motion`; barras translúcidas viram sólidas com `prefers-reduced-transparency` e `prefers-contrast`.
- **Conflito em aberto:** `docs/USABILIDADE.md` pede texto mínimo de 16 px, legenda de 13 px e toque de 48 px. A escala compacta decidida em 10/11/2026 (DESIGN-SYSTEM.md, 4ª passada) usa texto de 13 px, legenda de 11 px e controles de 40 px (32 px nos botões pequenos). Validar com pessoas do piloto, em especial as mais velhas.
