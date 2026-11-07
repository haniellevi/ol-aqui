# OLAKI · Arquitetura do projeto · 07/11/2026

**Para o Raniel, em uma frase:** é um site que funciona como aplicativo no celular (dá para "instalar" na tela inicial sem passar pela loja de apps), com um banco de dados na nuvem que guarda tudo e um painel onde você muda preços e regras sem programador.

Este documento junta o que já foi decidido em LEIA-ME.md, PAINEL-ADMIN.md e PRODUTO-CONTAS-ANUNCIOS-ROBO.md e o que a base do app já usa no repositório (branch `claude/painel-admin-base`). Onde eu proponho algo novo, está marcado **(proposta)**.

---

## 1. Visão geral

```
 Celular / computador
 (navegador ou app instalado - PWA)
          │
          ▼
 ┌──────────────────────────────┐        ┌──────────────────────┐
 │  App Next.js (na Vercel)      │──────▶ │  Claude API (Aki)    │
 │  - páginas públicas           │        └──────────────────────┘
 │  - minha conta / anunciar     │        ┌──────────────────────┐
 │  - painel /admin              │──────▶ │  Asaas (Pix, cartão)  │◀── aviso de pagamento (webhook)
 │  - rotas do robô e webhooks   │        └──────────────────────┘
 └──────────────┬───────────────┘        ┌──────────────────────┐
                │                ───────▶ │  WhatsApp/SMS        │ código de acesso e avisos
                ▼                         └──────────────────────┘
 ┌──────────────────────────────┐
 │  Supabase                     │
 │  - Postgres (dados + regras)  │
 │  - Login por celular (OTP)    │
 │  - Storage (fotos)            │
 │  - Tarefas agendadas (cron)   │
 └──────────────────────────────┘
```

| Peça | Escolha | Por quê |
|---|---|---|
| App | **Next.js 15 (App Router) + React 19** | Um código só para site, app instalável e painel. Páginas de anúncio saem prontas do servidor, o que é bom para o Google e para celular fraco |
| Visual | **Tailwind 4 + lucide-react** (shadcn/ui opcional depois) | Ver DESIGN-SYSTEM.md |
| Banco | **Supabase (Postgres 16)** com regras de acesso no próprio banco (RLS) | Segurança não depende da tela; já está nas migrações |
| Hospedagem | **Vercel** | Deploy automático a cada mudança aprovada |
| Pagamentos | **Asaas** | Pix e cartão, assinaturas; já decidido |
| Robô | **Claude API** | Ver seção 8 |
| Mensagens | **WhatsApp (API oficial da Meta) + SMS de reserva** | Código de acesso e avisos |

---

## 2. Pastas do código (como já está e como cresce)

```
src/
  app/
    (publico)/            ← (proposta) tudo que o visitante vê, com a barra de baixo
      page.tsx              Início
      busca/                Resultados
      c/[categoria]/[sub]/  Lista por categoria
      anuncio/[id]-[slug]/  Página do anúncio
      loja/[slug]/          Vitrine da loja           (URL já fixada)
      radar/                Radar de Negócios          (URL já fixada)
      aki/                  Robô em tela cheia
    (conta)/              ← exige login
      anunciar/[passo]/     Cadastro de anúncio (?rascunho=id)
      quero-vender/
      destacar/[anuncioId]/
      minha-conta/{dados,anuncios,plano,radar,favoritos,buscas,notificacoes,privacidade,loja}
    entrar/               Login por celular
    admin/                Painel (URL já fixada; telas 1 a 15)
    api/
      aki/                Conversa com o robô (streaming)
      webhooks/asaas/     Confirmação de pagamento
      webhooks/whatsapp/  (fase 2) mensagens recebidas
  components/{ui,anuncio,busca,radar,aki,admin}
  lib/
    supabase/{server,client}.ts
    config/               ← (proposta) leitura das tabelas planos/configuracoes com cache
    admin/
    aki/                  ferramentas do robô
    asaas/
  middleware.ts           sessão e proteção de /admin e /(conta)
supabase/migrations/
docs/
```

Os nomes de rota foram combinados com a conversa "Desenhar cadastro, produtos, destaques e robô".

---

## 3. Como as páginas são montadas (velocidade no celular)

| Tipo de página | Como | Efeito |
|---|---|---|
| Início, categoria, anúncio, loja | Montadas no servidor e guardadas por pouco tempo (revalidação a cada 60s, e na hora quando o anúncio muda) | Abre rápido mesmo em 3G, o Google lê tudo |
| Busca | Montada no servidor a cada pedido | Resultado sempre atual |
| Minha conta, anunciar, painel | Montadas no servidor com a sessão da pessoa, nunca guardadas | Dado de uma pessoa nunca aparece para outra |
| Favoritar, pausar, publicar | Server Actions (o botão fala direto com o servidor) | Menos código no celular |

**Orçamento de peso (proposta):** primeira tela com menos de **200 KB de JavaScript** e menos de **1 MB no total**, abrindo em até **3 segundos num 3G** (celular Android de entrada). Medido no Lighthouse em modo "celular lento" antes de cada entrega grande.

**App instalável (PWA):** ícone na tela inicial, abre sem barra do navegador, guarda as últimas páginas vistas e os rascunhos para funcionar com internet caindo. Não precisa publicar na Play Store no começo (economiza taxa e aprovação). Notificação no celular pelo navegador é possível no Android; no iPhone só com o app instalado.

---

## 4. Dados

As tabelas já existem nas migrações: `perfis`, `vitrines_lojas`, `anuncios`, `favoritos`, `radar_pedidos`, `radar_propostas`, `planos`, `configuracoes`, `microrregioes`, `cidades`, `pagamentos`, `denuncias`, `perfis_verificacoes`, `logs_atividade`.

A conversa de produto propõe as próximas: `categorias` (com campos em JSON), tipos de destaque, `robo_conversas`, `robo_mensagens`, `robo_avaliacoes`. **(proposta)** desta conversa: `buscas_salvas` e `eventos_anuncio` (visualização, clique no WhatsApp, compartilhamento), para mostrar ao vendedor "340 visualizações, 12 cliques" e para os relatórios do painel.

**Região (franquia):** todo anúncio, loja e pedido pertence a uma `microrregiao`. Uma microrregião pode ter cidades de estados diferentes (Corrente-PI e Formosa do Rio Preto-BA). O visitante escolhe a cidade uma vez (guardada no aparelho) e tudo é filtrado por ela. Franqueado só enxerga a própria região, e isso é garantido no banco.

**Nada fixo no código:** preços, limites, textos da home e regras saem de `planos` e `configuracoes`. **(proposta)** O app lê essas tabelas por um único módulo `lib/config` com cache de 60 segundos e limpa o cache quando o painel salva, para não consultar o banco a cada clique.

---

## 5. Login

- Celular + código de 6 dígitos (Supabase Auth com telefone). Envio pelo WhatsApp e, se falhar, SMS. Limite de tentativas por número e por IP vem do painel.
- Sessão longa (a pessoa não precisa entrar toda hora); "sair de todos os aparelhos" em Minha conta.
- Visitante não precisa de conta para ver e chamar no WhatsApp. O login só aparece quando a pessoa tenta favoritar, anunciar ou pedir no Radar, e depois ela volta exatamente para onde estava.

---

## 6. Fotos

- O celular reduz a foto **antes** de enviar (lado maior 1600px, JPEG/WebP ~80%). Uma foto de 4 MB vira uns 300 KB: muito mais rápido no 4G fraco da região e mais barato de guardar.
- Envio direto para o Supabase Storage com link assinado, uma foto por vez, com barra de progresso e nova tentativa automática se cair.
- Na hora de mostrar, o app pede o tamanho certo (card pequeno, galeria grande) pelo otimizador de imagem. Fotos fora do ar quando o anúncio é excluído.
- Moderação: as fotos passam pelo mesmo filtro dos anúncios; a fase 2 pode usar o Aki para identificar foto proibida.

---

## 7. Busca

- Começa no próprio Postgres, que já tem busca tolerante a acento e a erro de digitação (`unaccent`, `pg_trgm`, índices prontos). Para o volume de uma microrregião isso aguenta folgado e não custa nada a mais.
- Filtros pelos campos da categoria (ano, km, quartos, hectares) usando o índice de atributos que já existe.
- Ordem: destaques pagos em rodízio justo, depois relevância e data.
- **Quando trocar:** se passar de algumas centenas de milhares de anúncios ou várias regiões, avaliar um serviço de busca separado (Typesense ou Meilisearch). Não precisa agora.

---

## 8. Robô Aki

- Rota `api/aki` chama a Claude API com streaming e as ferramentas descritas em PRODUTO-CONTAS-ANUNCIOS-ROBO.md (`buscar_anuncios`, `salvar_rascunho_anuncio`, `criar_pedido_radar`...).
- Cada ferramenta usa **a sessão da própria pessoa** no Supabase, então o robô nunca vê mais do que ela veria.
- Modelo, limite diário por pessoa e orçamento mensal em reais ficam no painel (tela 11). Se o orçamento acabar, o balão avisa e o resto do site segue normal.
- Publicar, pagar e apagar só com toque num botão do card que o robô mostra.

---

## 9. Pagamentos

1. Pessoa escolhe plano ou destaque → app cria a cobrança no Asaas e mostra o **Pix copia-e-cola e o QR code** na própria tela.
2. Asaas avisa o app (`api/webhooks/asaas`) quando o pagamento cai → o app confere a assinatura do aviso, grava em `pagamentos` e liga o plano ou destaque.
3. O mesmo aviso nunca é processado duas vezes (guarda o id do evento).
4. Tarefa diária confere pagamentos que ficaram sem aviso.

O OLAKI nunca guarda dados de cartão (fica tudo no Asaas).

---

## 10. Tarefas automáticas (todo dia / toda hora)

Pelo agendador do Supabase (pg_cron) ou da Vercel:
- Expirar anúncios e pedidos do Radar vencidos e avisar o dono antes.
- Terminar destaques no prazo.
- Avisar teste grátis acabando (3 dias antes).
- Enviar alertas de buscas salvas e "pedido no Radar combina com seu estoque" (fase 2).
- Apagar registros de acesso com mais de 6 meses (Marco Civil) e rascunhos abandonados.

---

## 11. Segurança e lei

- **RLS no banco** em todas as tabelas; o painel admin confere `e_admin()` no banco, não só na tela.
- **Marco Civil art. 15:** guardar IP, data e **porta de origem** por 6 meses. A Vercel não repassa a porta; **(proposta)** colocar a **Cloudflare** na frente do domínio (plano grátis serve) para registrar a porta, e de quebra ganhar proteção contra ataque e cache de imagens.
- **LGPD:** baixar meus dados e excluir conta em Minha conta; endereço exato de pessoa física nunca aparece; verificação de documento por provedor de KYC (sem guardar foto de documento).
- Limite de requisições em login, Aki e envio de anúncio (evita robô e golpe em massa).
- Segredos (chaves do Asaas, Claude, WhatsApp) só nas variáveis de ambiente da Vercel, nunca no código.

---

## 12. Ambientes e entrega

| Ambiente | Para quê |
|---|---|
| Local | Desenvolvedor, com Supabase local |
| **Prévia** | Cada mudança proposta (PR) ganha um link próprio da Vercel para você testar no celular antes de aprovar |
| Produção | olaki.com.br (olaqui.com.br redireciona) |

Fluxo: mudança no GitHub → link de prévia → você testa → aprova → vai para produção sozinho. Migrações do banco rodam antes da publicação. **(proposta)** Testes automáticos mínimos: regras de acesso do banco (quem vê o quê), cadastro de anúncio do início ao fim e o aviso de pagamento do Asaas.

---

## 13. Medir para decidir (proposta)

- **Vercel Analytics** (visitas e velocidade real nos celulares da região).
- **Sentry** (plano grátis) para ver erros que acontecem no celular das pessoas.
- Eventos próprios em `eventos_anuncio` e no painel: anúncios publicados por dia, cliques no WhatsApp, pedidos no Radar com resposta, "vendeu pelo OLAKI?".

---

## 14. Custos mensais estimados no piloto

| Serviço | Começo |
|---|---|
| Vercel | grátis (Hobby) só nos testes, porque ele não permite uso comercial; Pro ~US$ 20 no lançamento |
| Supabase | grátis no teste; Pro ~US$ 25 no lançamento (backup diário) |
| Cloudflare | grátis |
| Asaas | só taxa por cobrança paga |
| WhatsApp/SMS | por mensagem enviada (código e avisos) |
| Claude API (Aki) | conforme uso, com teto mensal no painel (estimativa no doc de produto) |

Valores de tabela pública dos fornecedores, sujeitos a mudança; confirmar na contratação.
