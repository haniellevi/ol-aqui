# Mercado da Região · pacote inicial (07/11/2026)

Domínio oficial: **mercadodaregiao.com.br** (será ligado só no lançamento). O projeto nasceu como OLAKI e mudou de nome em 10/11/2026; o guia da marca está em [MARCA.md](MARCA.md).
O nome diz o que é sem explicação, e a frase da marca é **"aqui a sua cidade aparece"**.

## Arquivos

| Arquivo | O que é |
|---|---|
| `supabase/migrations/20261107000000_olaki_inicial.sql` | Migração inicial, testada em Postgres 16 |
| `supabase/migrations/20261107010000_novos_status.sql` + `20261107010100_painel_admin.sql` | Planos, configurações, pagamentos, moderação e região-piloto (tudo gerenciável pelo painel) |
| `PAINEL-ADMIN.md` | Plano do painel administrativo (telas 1 a 15) |
| `PRODUTO-CONTAS-ANUNCIOS-ROBO.md` | Cadastro, Minha conta, categorias, cadastro de anúncio, vitrine, destaques e o robô Aki |
| `app/radar/page.tsx` | Página do Radar (Server Component, decide o bloqueio no servidor) |
| `app/radar/actions.ts` | Server Action "Propor Produto" → abre WhatsApp |
| `components/radar/radar-de-negocios.tsx` | Componente visual do Radar (mobile-first) |
| `public/logo/*.svg`, `app/icon.svg`, `app/apple-icon.png`, `app/opengraph-image.png`, `public/icone-*.png` | Logo oficial do Mercado da Região: M beringela com o pin laranja, "Mercado" + "da Região" (claro e para fundo escuro) e ícone do app com o M branco no quadrado beringela. Guia em `docs/MARCA.md`, gerador em `docs/marca/`; logos antigos do OLAKI em `docs/logo-opcoes/` |

O código assume Next.js 15 (App Router), Tailwind v4, `lucide-react` e `@supabase/ssr` com um `createClient` em `lib/supabase/server.ts` (padrão da documentação do Supabase).

---

## 1. Análise crítica

**O que é forte**
- O Radar é o diferencial real. OLX e Marketplace do Facebook são passivos: o comprador procura. No Radar, o lojista caça. Isso justifica a mensalidade melhor que "mais espaço para anúncio".
- Não intermediar pagamento elimina risco regulatório (não vira instituição de pagamento) e reduz custo.
- Multi-tenant por microrregião desde o dia 1 deixa a franquia possível sem reescrever.

**Riscos que precisam de resposta**
1. **Ovo e galinha.** O Radar só vale R$ 49,90 se tiver pedidos. Sem compradores no dia 1, o lojista cancela no mês 2. É preciso semear pedidos (equipe local, parcerias, grupos de WhatsApp da cidade).
2. **Spam no WhatsApp do comprador.** Se 30 lojas chamam a mesma pessoa, ela nunca mais usa o Radar. Já coloquei limite de propostas por pedido (padrão 10, uma por loja) e o pedido expira em 15 dias.
3. **Slim e Full custam quase o mesmo para quem tem até 10 itens.** O teste grátis já dá 10 itens; a diferença percebida do Slim é "só" o Radar. Isso é bom (o Radar vira o produto), mas o argumento de venda tem que ser esse.
4. **Pessoa física pagando R$ 49,90 para vender um sofá não acontece.** PF precisa de outro caminho (anúncio avulso barato, ou grátis com limite de 1 a 3 itens).
5. **Selo Negociador Certificado com selfie + documento** é dado sensível pela LGPD (biometria). Precisa de base legal clara (consentimento específico), prazo de retenção e, de preferência, um provedor de KYC (unico, idwall, Serpro Datavalid) em vez de guardar fotos de documento.
6. **Marco Civil, art. 15:** guardar registros de acesso por 6 meses é obrigação. Já está nos logs com IP, user-agent e data. Falta registrar a **porta lógica de origem** (exigida desde a Lei 13.964/19 para identificar usuários atrás de CGNAT, muito comum em internet móvel do interior). A Vercel não repassa a porta; vale avaliar Cloudflare na frente.

## 2. Três ideias de marketplaces do mundo para o Radar

**1) Thumbtack / Bark (EUA e Reino Unido): créditos por lead, não acesso ilimitado.**
Lá o profissional paga por cada contato que abre, e o pedido some depois de 5 respostas. Adaptação: o plano inclui X "Propor Produto" por mês (ex.: Slim 20, Full ilimitado) e vende pacotes avulsos de créditos. Isso cria uma segunda receita e deixa o lojista escolher bem onde gastar, o que protege o comprador de spam. A tabela `radar_propostas` já registra cada lead, então dá para cobrar por uso sem mudar o banco.

**2) Leilão reverso com prazo (Alibaba RFQ / plataformas B2B europeias): "Pedido com relógio".**
O comprador define um prazo curto (24h, 3 dias) e recebe as ofertas organizadas, sem ficar exposto. Adaptação: em vez de abrir o WhatsApp do comprador na hora, o lojista envia uma proposta (preço + foto + link do anúncio) e o comprador recebe **um resumo no WhatsApp** quando o prazo acaba ("Você recebeu 6 ofertas, a menor é R$ 92 mil"). O comprador escolhe com quem falar. Menos spam, mais confiança, e o comprador volta ao Mercado da Região para comparar.

**3) Nextdoor + Carousell "Buyer Requests": prova social local e alerta automático.**
Quando um pedido entra no Radar, o sistema cruza com o estoque das vitrines (busca de texto já indexada) e avisa o lojista que tem algo parecido: "3 clientes procuram moto até R$ 15 mil e você tem 2". Do outro lado, o comprador vê "4 lojas da sua cidade têm algo parecido" antes mesmo de postar. Isso transforma o Radar em notificação ativa (o lojista abre o app porque recebeu um alerta), e é o melhor argumento de retenção do plano.

---

## 3. Como o bloqueio do Radar funciona (segurança em 3 camadas)

1. **Banco:** o WhatsApp do comprador não pode ser lido por SELECT nenhum (grant de coluna revogado). Só sai pela função `revelar_contato_radar`, que confere plano pago em dia, mesma região, limite de propostas, e grava o lead.
2. **Servidor:** a página só envia `detalhes` e nome do comprador para quem paga. Quem não paga recebe `null`.
3. **Tela:** quem não paga vê o título, valor e cidade (o "gancho"), e um bloco borrado com **texto falso**. Nem inspecionando o HTML dá para achar o dado real.

Testes feitos na migração: lojista em teste não consegue revelar contato, não consegue se promover a Full sozinho, não passa de 10 anúncios; loja paga revela, a proposta conta 1 vez só; anônimo não vê o Radar; imóvel sem "finalidade" é recusado; busca "sofa" acha "Sofá"; logs gravam IP e user-agent.

---

## 4. Decisões da entrevista (07/11/2026)

1. Teste grátis tem algumas propostas no Radar (padrão 3, muda no painel)
2. Pessoa física: poucos anúncios grátis + anúncio avulso pago
3. No pedido, o comprador escolhe: WhatsApp direto ou propostas com prazo
4. Comprador posta no Radar só confirmando o celular por código
5. Cobrança pelo Asaas
6. Piloto: Corrente-PI + extremo sul do Piauí + Formosa do Rio Preto-BA
7. Repasse do franqueado: decidir depois
8. Moderação: publica na hora + filtro automático + denúncias
9. Logo: opções 1 (pin no "i") e 2 (balão "ol")

Preços, limites e regras ficam no painel administrativo. Ver [PAINEL-ADMIN.md](PAINEL-ADMIN.md) e a migração `20261107010100_painel_admin.sql`.
