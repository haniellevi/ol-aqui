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

Diferencial: o **Radar de Negócios**. OLX e Marketplace do Facebook são passivos, porque o comprador procura. No Radar, a loja vai atrás do comprador. O Radar é o que justifica a mensalidade das lojas. O produto é regional (multi-tenant por microrregião), não nacional.

## Operating Context

- Uso no celular, tela de 360 px, uma mão, muitas vezes no sol e com pacote de dados acabando.
- A negociação acontece no WhatsApp. O site não intermedia pagamento entre comprador e vendedor.
- Entrada com o celular confirmado por código no WhatsApp; não existe senha para lembrar.
- Destaques e planos são pagos com Pix e boleto pelo Asaas.
- Região-piloto: Corrente-PI, extremo sul do Piauí e Formosa do Rio Preto-BA. Região forte em agro (Matopiba).

## Capabilities and Constraints

- **Stack:** Next.js 15, React 19, Tailwind CSS 4, Clerk (identidade), Supabase (Postgres com RLS e Storage), Evolution API (código pelo WhatsApp), Asaas (cobrança), publicação na Vercel.
- **Funções:** home de classificados com o Radar como segundo destaque, categorias com filtros, busca, anunciar em passos, página do anúncio, vitrine da loja, Minha conta (anúncios, plano, favoritos, notificações, privacidade), Radar (pedidos e propostas), robô **Aki**, moderação com IA e painel admin.
- **Regra de ouro:** preços, limites, categorias, nomes de planos e textos que mudam com o negócio vêm do painel admin, nunca ficam fixos no código.
- **Contato do comprador no Radar:** só é revelado a loja com plano pago em dia, da mesma região, dentro do limite de propostas. Quem não paga vê só o "gancho" (título, valor, cidade).
- **Termos:** "Entrar", "Anunciar", "Chamar no WhatsApp", "Pedir no Radar", "Destacar", "Meus anúncios". Sem inglês (ver docs/USABILIDADE.md).
- **Em aberto:** cobrança real pelo Asaas ainda precisa ser validada antes de cobrar; o percurso completo do comprador no Radar (pedir, acompanhar, escolher proposta) está em construção; o nome "Radar" para o comprador ("Pedir ofertas"?) é hipótese a testar no piloto; repasse do franqueado ainda não decidido.

## Brand Commitments

- **Nome da marca: Mercado da Região** (confirmado em 10/11/2026). Endereço: `mercadodaregiao.com.br`. O nome antigo **OLAKI saiu**; o robô continua se chamando **Aki**.
- Tagline em uso: "olha aqui o que você procura".
- Tom: simples, confiável e da região. Frases curtas, palavras do dia a dia, números como as pessoas falam ("R$ 8 mil", "há 2 dias").
- **Logo oficial (confirmado em 10/11/2026):** o selo "M" laranja com o nome "Mercado / da Região" (`src/components/ui/marca.tsx`). Detalhes visuais em `DESIGN.md`.
- Ícones do site e do app e a imagem de compartilhamento já usam o selo "M" (10/11/2026).

## Evidence on Hand

- Guia de usabilidade com 12 regras: `docs/USABILIDADE.md`.
- Sistema visual atual (cores, componentes, hierarquia do admin): `docs/DESIGN-SYSTEM.md`.
- Telas e fluxos: `docs/TELAS-E-FLUXOS.md`; produto e contas: `docs/PRODUTO-CONTAS-ANUNCIOS-ROBO.md`; painel: `docs/PAINEL-ADMIN.md`.
- Registros de QA e validação de cada fluxo: `docs/QA-*.md` e `docs/VALIDACAO-*.md` (históricos).
- Demo animada do Radar (lado da loja): `/demo/radar`.
- **Não existem ainda:** depoimentos de clientes, números de uso, lojas parceiras confirmadas publicamente ou casos de sucesso. Não inventar nenhum deles.

## Product Principles

1. **Do anúncio ao WhatsApp em poucos toques.** Nada pode ficar entre o comprador e o vendedor sem motivo.
2. **Buscar e pedir são um só caminho.** Se a busca não acha, ela vira um pedido no Radar sem redigitar nada.
3. **O comprador controla o contato.** O número só sai quando ele escolhe; existe limite de propostas, prazo e denúncia.
4. **Confiança visível e honesta.** "Patrocinado" sempre escrito, selos dizem o que verificaram, aviso de nunca pagar antes de ver.
5. **Funciona no pior celular, na pior internet.** Leve, tolerante a queda, sem animação pesada.

## Accessibility & Inclusion

- Texto mínimo 16 px, legenda mínima 13 px; respeitar a letra grande do celular.
- Contraste forte, legível no sol (nada de branco sobre laranja, nada de cinza clarinho).
- Toque mínimo de 48 × 48 px com 8 px de espaço; nenhum gesto escondido como único caminho.
- Ícone sempre com palavra, exceto lupa, coração, X e voltar.
- Público com leitura lenta: escrever o mínimo, preferir botões a digitação, foto e voz antes de texto.
