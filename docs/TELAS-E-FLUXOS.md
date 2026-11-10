# Mercado da Região · Mapa de telas e caminhos do usuário · 07/11/2026

Este é o mapa do **app público** (o que comprador, vendedor e loja veem). O painel administrativo está em PAINEL-ADMIN.md. As regras de cadastro, anúncio, destaques e Aki estão em PRODUTO-CONTAS-ANUNCIOS-ROBO.md; aqui só organizo as telas e o caminho entre elas. Visual em DESIGN-SYSTEM.md, regras de uso em USABILIDADE.md, ideias de outros apps em PESQUISA-MERCADO.md.

**Fase 1** = lançamento do piloto em Corrente. **Fase 2** = depois.

---

## 1. Estrutura geral

Sempre visível no celular, embaixo: **Início · Buscar · [+ Anunciar] · Radar · Conta**
Sempre visível no topo: logo, cidade escolhida ("Corrente ▾"), e o balão do **Aki** flutuando no canto.

```
INÍCIO ─┬─ Busca / Categoria ── Página do anúncio ── WhatsApp do vendedor
        │                              └── Vitrine da loja
        ├─ Radar ── Fazer pedido / Ver propostas (comprador)
        │        └── Pedidos da região / Propor (loja)
        ├─ + Anunciar ── 6 passos ── "Está no ar!" ── Destacar
        ├─ Conta ── Minha conta (abas)
        └─ Aki (balão em todas as telas; tela cheia em /aki)
```

---

## 2. Lista de telas

| # | Tela | Endereço | Quem vê | Fase |
|---|---|---|---|---|
| T1 | Escolher cidade (1ª visita) | folha sobre o Início | todos | 1 |
| T2 | **Início** | `/` | todos | 1 |
| T3 | Todas as categorias | `/categorias` | todos | 1 |
| T4 | Lista da categoria | `/c/[categoria]/[sub]` | todos | 1 |
| T5 | **Resultado da busca** | `/busca?q=` | todos | 1 |
| T6 | Filtros | folha sobre T4/T5 | todos | 1 |
| T7 | **Página do anúncio** | `/anuncio/[id]-[slug]` | todos | 1 |
| T8 | Galeria de fotos em tela cheia | sobre T7 | todos | 1 |
| T9 | Denunciar anúncio | folha sobre T7 | todos | 1 |
| T10 | **Vitrine da loja** | `/loja/[slug]` | todos | 1 |
| T11 | Perfil do vendedor PF | `/vendedor/[id]` | todos | 1 |
| T12 | **Entrar** (celular → código) | `/entrar` | todos | 1 |
| T13 | Completar perfil (nome, cidade, termos) | `/entrar/perfil` | novo usuário | 1 |
| T14 | **Quero vender** (minhas coisas / tenho loja) | `/quero-vender` | logado | 1 |
| T15 | Dados da loja | `/quero-vender/loja` | quem escolheu loja | 1 |
| T16 | Limite atingido (avulso ou trocar plano) | antes do passo 1 | vendedor | 1 |
| T17–T22 | **Anunciar: fotos, categoria, detalhes, preço, local, revisar** | `/anunciar/[passo]?rascunho=id` | vendedor | 1 |
| T23 | **"Seu anúncio está no ar"** | `/anunciar/pronto` | vendedor | 1 |
| T24 | **Destacar** (escolher tipo) | `/destacar/[anuncioId]` | vendedor | 1 |
| T25 | Pagar com Pix (QR + copia e cola) | `/pagar/[cobranca]` | vendedor | 1 |
| T26 | **Radar: início** (comprador e loja) | `/radar` | todos | 1 |
| T27 | Fazer pedido no Radar | `/radar/pedir` | todos (código no celular) | 1 |
| T28 | Meu pedido e propostas recebidas | `/radar/pedido/[id]` | comprador | 1 |
| T29 | Pedido visto pela loja + Propor | `/radar/[id]` | loja | 1 |
| T30 | Enviar proposta (preço, foto, anúncio) | folha sobre T29 | loja com plano | 1 |
| T31 | **Minha conta** (abas) | `/minha-conta/...` | logado | 1 |
| T32 | Meus anúncios | `/minha-conta/anuncios` | vendedor | 1 |
| T33 | Meu plano e faturas | `/minha-conta/plano` | loja | 1 |
| T34 | Favoritos | `/minha-conta/favoritos` | logado | 1 |
| T35 | Buscas salvas | `/minha-conta/buscas` | logado | 2 |
| T36 | Notificações | `/minha-conta/notificacoes` | logado | 1 |
| T37 | Privacidade (baixar dados, excluir conta) | `/minha-conta/privacidade` | logado | 1 |
| T38 | Minha loja (capa, logo, horário) | `/minha-conta/loja` | loja | 1 |
| T39 | **Aki** em tela cheia | `/aki` | todos | 1 |
| T40 | Ajuda e dicas de segurança | `/ajuda` | todos | 1 |
| T41 | Termos e privacidade | `/termos`, `/privacidade` | todos | 1 |
| T42 | Planos e preços (para lojas) | `/planos` | todos | 1 |
| T43 | Sem internet | automática | todos | 1 |
| T44 | Página não encontrada / anúncio vendido | automática | todos | 1 |

---

## 3. Como é cada tela principal

### T2 · Início
1. Topo: logo, cidade ("Corrente ▾"), sino de avisos
2. **Busca grande** "O que você procura?" com microfone e botão do Aki
3. Categorias em ícones (rolagem para o lado): Veículos, Agro, Imóveis, Casa, Eletrônicos, Moda, Serviços, Empregos, Doação, Mais
4. **Destaques perto de você** (carrossel, cada card com "Patrocinado"; vagas limitadas)
5. **Faixa do Radar** (fundo laranja-claro): "Não achou? Diga o que procura e as lojas da região te chamam." → Pedir no Radar
6. Lojas da região (logo redondo + nome + selo)
7. **Mais recentes em Corrente e região** (grade de 2 colunas, rolagem infinita)

Textos e ordem dos blocos vêm do painel (tela 12).

### T5 · Resultado da busca
- Campo de busca no topo com o que foi digitado
- Chips: **Filtros (n)**, Cidade, Preço, Categoria, Ordenar
- Linha: "128 anúncios em Corrente e região" + **Salvar busca** (sino)
- Grade de cards; a cada 10 cards, no máximo 2 patrocinados
- **Nada encontrado:** "Não achamos 'trator 75cv' por aqui ainda." Botões: **Pedir no Radar** (já preenchido) e **Perguntar ao Aki**. Embaixo: parecidos em cidades vizinhas.

### T7 · Página do anúncio
1. Galeria (deslizar), contador "1/8", coração, compartilhar
2. **Preço grande**, "aceita troca" / "a combinar" se marcado
3. Título, cidade e bairro, "publicado há 2 dias", etiqueta Reservado se for o caso
4. **Detalhes** em lista de 2 colunas (ano, km, horas, raça...)
5. Descrição (corta em 5 linhas, "ver mais")
6. **Caixa de segurança**: "Nunca pague nada antes de ver o produto. Desconfie de preço muito baixo." + link Dicas
7. Cartão do vendedor (foto, nome, selo, "no Mercado da Região desde", tempo de resposta) → vitrine ou perfil
8. Parecidos na região
9. Denunciar (texto pequeno, no fim)
10. **Barra fixa embaixo:** botão verde **Chamar no WhatsApp** (largura grande) + coração

### T17–T22 · Anunciar (6 passos)
Barra "Passo 2 de 6", botão **Voltar** e **Salvar e sair** sempre visíveis. Botão principal fixo embaixo ("Continuar").
- **Fotos:** botões grandes "Tirar foto" e "Escolher da galeria"; miniaturas com arrastar para ordenar; o Aki sugere título e categoria ("Parece uma **moto Honda Titan**. Está certo?" Sim / Não, escolher)
- **Categoria:** a sugestão do Aki em cima; lista com ícones embaixo
- **Detalhes:** só os campos da categoria; escolha por botões grandes
- **Preço:** teclado de número, "R$" fixo; dica "Parecidos na região: R$ 8 mil a R$ 11 mil"; caixas "A combinar" e "Aceito troca"
- **Local:** cidade e bairro já preenchidos do perfil
- **Revisar:** o card exatamente como vai aparecer + **Publicar**

### T26 · Radar
Abas no topo conforme quem é:
- **Comprador:** "Meus pedidos" + botão **Pedir no Radar**. Cada pedido mostra "3 propostas" e o prazo.
- **Loja:** "Pedidos na região" (cards com o que a pessoa quer, faixa de preço, cidade, prazo) e "Minhas propostas" (usadas no mês: "2 de 3").
- Visitante vê a explicação em 3 desenhos: **Você pede → as lojas oferecem → você escolhe**.

### T31 · Minha conta
Lista simples (não abas escondidas) com ícone + nome: Meus anúncios, Meu plano, Minha loja, Radar, Favoritos, Buscas salvas, Notificações, Meus dados, Privacidade, Ajuda, Sair. Itens de vendedor só aparecem para quem vende. No topo, cartão com nome, selo e, para loja, "Plano Teste grátis · faltam 12 dias · 7 de 10 anúncios".

---

## 4. Caminhos (fluxos) principais

### F1 · Visitante encontra e chama no WhatsApp (o mais importante)
Abre o link (veio do WhatsApp ou Google) → escolhe a cidade (só na 1ª vez) → busca ou toca na categoria → toca no card → vê fotos e preço → **Chamar no WhatsApp** → o WhatsApp abre com "Olá! Vi seu anúncio *Moto Titan 2015* no Mercado da Região: mercadodaregiao.com.br/anuncio/..."
**Sem pedir conta em nenhum momento.** Meta: 3 toques do Início até o WhatsApp.

### F2 · Pessoa vende uma coisa pela primeira vez
Toca **+ Anunciar** → Entrar (celular → código) → nome e cidade → "Quero vender: Vender minhas coisas" → Passo 1 Fotos → ... → Passo 6 Publicar → "Está no ar!" com **Compartilhar no WhatsApp** (status e grupos) e **Destacar**.
Se o filtro segurar o anúncio: "Seu anúncio está em análise, avisamos em até X horas" (prazo do painel).

### F3 · Loja entra no Mercado da Região
**+ Anunciar** ou página **Planos** → Entrar → "Tenho uma loja" → nome, link, WhatsApp da loja, logo (opcional) → teste grátis começa → "Sua vitrine: mercadodaregiao.com.br/loja/nome" com Compartilhar → primeiro anúncio → aviso do Radar ("Há 5 pedidos na região agora").

### F4 · Comprador pede no Radar
Busca sem resultado (ou aba Radar) → **Pedir no Radar** (texto já vem da busca) → o que quer, faixa de preço, cidade, prazo → escolhe **"Podem me chamar no WhatsApp"** ou **"Quero receber propostas aqui até [data]"** → confirma o celular com código → "Pedido no ar! Avisamos quando chegar proposta."

### F5 · Loja responde ao Radar
Aviso no WhatsApp/celular "Novo pedido: geladeira até R$ 2 mil em Corrente" → abre o pedido → **Propor** → escolhe um anúncio da vitrine ou manda foto e preço → envia. Sem plano pago e sem propostas grátis restantes: mostra o plano com o preço do painel.

### F6 · Vendedor destaca um anúncio
"Está no ar!" ou Meus anúncios → **Destacar** → escolhe tipo (Subir, Destaque na busca...) com preço e o que acontece → Pix (QR e copia-e-cola) → tela espera e confirma sozinha quando o Asaas avisa → depois mostra "340 visualizações, 12 cliques no WhatsApp".

### F7 · Conversar com o Aki
Balão → "O que você procura? Pode escrever ou falar." → a pessoa escreve → o Aki mostra cards reais dentro da conversa → se não tiver: oferece o Radar já preenchido → a pessoa toca **Confirmar**. Para vender: manda foto → Aki pergunta só o que falta → mostra o card pronto → pessoa toca **Publicar**.

### F8 · Marcar como vendido
Meus anúncios → **Vendi** → "Vendeu pelo Mercado da Região?" Sim / Não → o anúncio sai da busca e mostra "Vendido" para quem tinha o link (com parecidos embaixo, em vez de página de erro).

### F9 · Denunciar
Página do anúncio → Denunciar → motivos prontos em botões ("Pediu pagamento antecipado", "Produto falso", "Preço enganoso", "Ofensivo", "Outro") → enviado. Com 3 denúncias o anúncio sai do ar até revisão (regra já decidida).

---

## 5. Avisos que o sistema manda (por WhatsApp e/ou notificação)

| Quando | Para quem | Texto (exemplo; texto final no painel, tela 13) |
|---|---|---|
| Anúncio publicado | vendedor | "Seu anúncio *X* está no ar. Compartilhe: [link]" |
| Anúncio em análise / liberado / recusado | vendedor | "...liberado!" / "...precisa de ajuste: [motivo]" |
| Anúncio vai vencer | vendedor | "Seu anúncio vence em 3 dias. Renovar: [link]" |
| Proposta nova no Radar | comprador | "Chegou 1 proposta para *geladeira*. Ver: [link]" |
| Prazo do pedido acabou | comprador | "Você recebeu 6 propostas, a menor é R$ 1.850. Escolha: [link]" |
| Pedido novo que combina | loja | "Novo pedido em Corrente: *geladeira até R$ 2 mil*" |
| Teste grátis acabando | loja | "Faltam 3 dias do seu teste grátis." |
| Pagamento confirmado | quem pagou | "Pix recebido! Seu destaque já está valendo." |
| Busca salva (fase 2) | comprador | Resumo diário "3 motos novas até R$ 10 mil" |
