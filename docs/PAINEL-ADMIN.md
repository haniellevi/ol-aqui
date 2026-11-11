# Mercado da Região · Plano do Painel Administrativo

Endereço: `mercadodaregiao.com.br/admin` (mesmo app Next.js, rotas protegidas).
Regra de ouro: **nenhum preço, limite ou regra fica no código.** Tudo sai das tabelas `planos`, `configuracoes`, `microrregioes` e `cidades`, e cada mudança fica gravada em `logs_atividade` com quem mudou, IP e data.

## Quem entra

| Papel | Como | Vê |
|---|---|---|
| Administrador | `perfis.e_admin = true` (só você liga, pelo Supabase) | Tudo, todas as regiões |
| Franqueado (futuro) | `microrregioes.franqueado_id` | Só a região dele, sem mexer em preços globais |

A checagem é feita no banco (função `e_admin()` nas regras de RLS). Esconder o menu na tela é só conforto; mesmo que alguém ache a URL, o banco recusa.

## Telas (em ordem de construção)

### 1. Início (resumo)
- Vitrines ativas, em teste, pagantes por plano
- Receita do mês (pagamentos `pago`), inadimplentes
- Pedidos no Radar abertos, propostas enviadas, taxa de pedidos com resposta
- Fila: anúncios em análise e denúncias abertas (com número em vermelho)

### 2. Planos e preços
Tabela `planos`. Para cada plano: nome, preço, dias, limite de anúncios (vazio = ilimitado), tem Radar?, propostas por mês (vazio = ilimitado), para PF/PJ/todos, ativo.
Planos iniciais: Teste grátis (30 dias, 10 anúncios, 3 propostas), Grátis PF (3 anúncios), Slim (R$ 49,90, 10 anúncios, Radar), Full (R$ 99,00, ilimitado, Radar).
Ao mudar o preço: vale para novas assinaturas; quem já assina no Asaas continua no valor antigo até você escolher "aplicar aos atuais" (o painel atualiza as assinaturas no Asaas).

### 3. Configurações
Tabela `configuracoes`, uma aba por grupo. Cada valor pode ter **exceção por região** (ex.: anúncio avulso mais barato em Corrente no lançamento).
- **Planos:** dias de teste, plano da PF depois do teste, preço e dias do anúncio avulso, preço e dias do destaque
- **Radar:** máximo de propostas por pedido, dias que o pedido fica aberto, prazos que o comprador pode escolher (24h, 3 dias, 7 dias)
- **Moderação:** palavras bloqueadas, preço máximo e mínimo por categoria, quantas denúncias tiram do ar
- **Cobrança:** Asaas sandbox ou produção (a chave da API fica nas variáveis de ambiente da Vercel, nunca no banco)
- **Geral:** WhatsApp do suporte, e-mail do Compliance

### 4. Moderação
- Fila "Em análise": anúncio, motivo (palavra, preço, denúncias), botões **Aprovar**, **Recusar**, **Congelar (Compliance)**
- Denúncias: agrupadas por anúncio, marcar procedente/improcedente
- Busca de qualquer anúncio, pedido ou vitrine por texto, telefone ou CNPJ

### 5. Lojistas e vitrines
- Lista com plano, vencimento, anúncios ativos, propostas usadas
- Ações: dar dias de cortesia, trocar plano, suspender, conceder **Selo Loja Verificada**
- Verificações pendentes (documento, selfie, CNPJ): aprovar ou recusar com motivo. As imagens abrem por link temporário do bucket privado, nunca ficam públicas.

### 6. Pagamentos (Asaas)
- Lista por status, filtro por região e período
- Reenviar link de cobrança pelo WhatsApp
- Exportar CSV (para contabilidade e futuro repasse de franquia)

### 7. Regiões e cidades
- Criar microrregião, escolher sede, adicionar cidades de qualquer estado (Corrente-PI e Formosa do Rio Preto-BA na mesma região)
- Campo de repasse do franqueado (fica vazio até o modelo de franquia ser decidido)

### 8. Compliance Jurídico
- Busca por usuário, telefone ou anúncio
- Botão **Gerar relatório de logs** (cadastro, IPs, datas, alterações) em PDF para atender ordem judicial ou requisição policial
- Todo acesso a esta tela também fica registrado

## Como os dados entram

- Ler e salvar: Server Actions do Next.js usando a sessão do admin (RLS valida `e_admin()`).
- Webhook do Asaas: rota `app/api/asaas/webhook/route.ts`, confere o token do Asaas, usa a chave `service_role` e chama `confirmar_pagamento()`. A função ignora o mesmo aviso repetido.
- Rotina diária (pg_cron): `expirar_rotina()` encerra pedidos vencidos e pausa anúncios de quem não renovou. Uma segunda rotina, `radar_avisar_prazos()` (pg_cron a cada 10 min, nome `olaki-radar-prazos`), manda o resumo das propostas ao comprador dentro do app quando o prazo acaba (pelo WhatsApp fica para a fase 2).

## Já pronto no banco (migração `20261107010100_painel_admin.sql`, testada)

- Tabelas `planos`, `configuracoes` (com exceção por região), `cidades`, `pagamentos`, `denuncias`
- Teste grátis com 3 propostas no Radar; a 4ª é recusada
- PF: 3 anúncios grátis depois do teste; anúncio avulso pago não conta no limite
- Pedido do Radar com modo **WhatsApp direto** ou **propostas com prazo** (no prazo, o lojista manda preço e mensagem, e o comprador escolhe a loja e recebe o WhatsApp dela)
- Comprador só posta no Radar com o celular confirmado por código
- Filtro automático: palavra proibida ou preço fora do normal vai para "em análise"; 3 denúncias tiram do ar; o dono não consegue tirar da análise sozinho
- Só admin altera planos e configurações, e cada alteração fica no log
- Região-piloto criada com Corrente e 16 cidades (15 do PI + Formosa do Rio Preto-BA). A lista é um ponto de partida para conferir no painel.

## Próximo passo sugerido

Montar o projeto Next.js de verdade (repositório no GitHub + Supabase + Vercel) e construir as telas 1 a 4 primeiro: são as que você vai usar desde o primeiro dia do piloto.

---

## Telas novas (07/11/2026, ver PRODUTO-CONTAS-ANUNCIOS-ROBO.md)

As telas 1 a 8 continuam iguais. A tela 5 passa a se chamar **Contas e vitrines** e lista todas as contas (comprador, pessoa, loja), não só lojistas, com: bloquear, trocar celular, ver anúncios, ver conversas com o robô (se a pessoa pedir suporte), exportar ou apagar dados (LGPD).

### 9. Categorias e campos
Árvore de categorias (criar, renomear, mover, esconder, reordenar, ícone). Para cada uma, os campos do anúncio: nome, tipo (texto, número, lista, sim/não), obrigatório?, vira filtro na busca?, opções da lista. Preço mínimo e máximo por categoria (usado pela moderação) fica aqui também.

### 10. Destaques
Tipos de destaque (Subir, Destaque na busca, Vitrine da home, Loja em destaque): preço, dias, vagas por região, ativo. Créditos incluídos em cada plano. Lista de destaques ativos com resultado (visualizações, cliques). Dar destaque de cortesia.

### 11. Robô Merc
Ligar e desligar (geral e por região). Modelo da IA, limite de mensagens por pessoa por dia, **orçamento mensal em R$** com alerta em 80%. Mensagem de boas-vindas e sugestões de perguntas. Temas proibidos. Custo do mês, conversas por dia, avaliações ruins (para melhorar), e as **buscas que não acharam nada** (mostra o que falta na região, ótimo para semear o Radar e atrair lojas).

### 12. Página inicial e textos
Ordem dos blocos da home, banners, textos das telas, termos de uso e política de privacidade com número de versão (quem não aceitou a versão nova é avisado).

### 13. Mensagens automáticas
Modelos das mensagens de WhatsApp, e-mail e notificação (código de acesso, plano vencendo, destaque acabou, proposta nova no Radar). Cada uma pode ser ligada ou desligada.

### 14. Equipe e permissões
Troca o "é admin sim/não" por papéis: **Administrador** (tudo), **Moderador** (tela 4), **Financeiro** (tela 6), **Suporte** (tela 5 sem mexer em plano), **Franqueado** (só a região dele). Tudo continua com registro de quem fez o quê.

### 15. Relatórios
Funil (visitas → buscas → cliques no WhatsApp → "vendi pelo Mercado da Região"), anúncios por categoria e cidade, conversão do teste grátis para plano pago, receita por tipo (plano, avulso, destaque), exportar CSV.

### Desfazer
Como toda mudança de configuração fica no log com o valor antigo, cada linha do histórico tem o botão **Voltar para este valor**.
