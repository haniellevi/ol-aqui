# Etapa 4 · Ajuda, termos e privacidade com versão, Aki em tela cheia, páginas de erro e textos da home

Nota para o desenvolvedor. Base: TELAS-E-FLUXOS.md (T39 a T44, T13), PAINEL-ADMIN.md (tela 12),
USABILIDADE.md (regras 8, 10 e 11), ARQUITETURA.md (LGPD e Marco Civil) e docs/DESIGN-SYSTEM.md.

Migração: `supabase/migrations/20261108030000_paginas_e_textos.sql` · Testes: `supabase/testes/95_paginas_e_textos.sql`
Tipos: `src/lib/tipos-paginas.ts` · Leituras: `src/lib/dados/paginas.ts` · Ações: `src/app/(publico)/termos/actions.ts`
(aceite) e `src/app/admin/textos/actions.ts` (painel).

## Tabelas novas (todas com RLS)

| Tabela | Para que serve | Quem lê | Quem grava |
|---|---|---|---|
| `documentos_legais` | Termos de uso e política de privacidade, **uma linha por versão**: `tipo` (`termos` ou `privacidade`), `versao` (1, 2, 3...), `titulo`, `conteudo` (markdown simples), `resumo_mudancas`, `revisado_advogado` (falso = RASCUNHO), `ativo`, `publicado_em`, `publicado_por` | todos (versões antigas ficam visíveis, transparência) | só `publicar_documento_legal()` e `marcar_documento_revisado()` (admin). Nenhum INSERT/UPDATE/DELETE direto |
| `aceites` | quem aceitou qual versão: `usuario_id`, `tipo`, `versao`, `documento_id`, `aceito_em`, `criado_ip` | a própria pessoa e o admin (o IP fica fora da API: leitura por coluna, só o servidor lê) | só `aceitar_documentos_legais()` |
| `ajuda_categorias` | grupos da Central de ajuda: `slug`, `nome`, `descricao`, `ordem`, `ativa` | todos (só as ativas; admin vê todas) | admin |
| `ajuda_perguntas` | artigos da ajuda: `categoria` (slug), `pergunta`, `resposta` (markdown simples), `ordem`, `ativo` | todos (só ativos de categoria ativa; admin vê tudo) | admin |
| `home_blocos` | blocos da página inicial que podem mudar de ordem: `chave` (`destaques`, `lojas_destaque`, `radar`, `lojas_regiao`, `recentes`), `nome`, `ordem`, `ativo`, `pode_desligar`, `titulo`, `texto`, `botao` | todos | admin, só UPDATE (os blocos são fixos; o trigger não deixa trocar a chave nem desligar bloco travado) |

Nome `ajuda_perguntas` (e não só `perguntas`) para não confundir com as perguntas da página de planos
(`planos.perguntas_frequentes`).

Toda mudança nessas tabelas cai em `logs_atividade` (trigger `registrar_log`), com quem, IP e valor antigo.

## Funções

| Função | Quem chama | O que faz |
|---|---|---|
| `publicar_documento_legal(tipo, titulo, conteudo, resumo, revisado)` | admin | cria a versão seguinte (máx + 1), desliga a anterior, liga a nova. Texto vazio ou igual à versão atual é recusado |
| `marcar_documento_revisado(id, revisado)` | admin | liga/desliga o selo "revisado por advogado" de uma versão (fica no log) |
| `termos_pendentes()` | pessoa logada | versões ativas que ela ainda não aceitou, com `primeira_vez` (nunca aceitou nenhuma versão daquele tipo) |
| `aceitar_documentos_legais(ids uuid[])` | pessoa logada | grava o aceite das versões que a pessoa **viu**. Se uma delas não está mais ativa (o admin publicou outra no meio), recusa com "Os termos mudaram agora". Repetir não duplica. Atualiza `perfis.aceitou_termos_em` e `perfis.versao_termos` |
| `anuncio_fora_do_ar(id)` | todos | para anúncio pausado ou expirado devolve só a categoria (sem título, sem vendedor), para a página mostrar "saiu do ar" com parecidos em vez de erro |

`perfis.aceitou_termos_em` e `perfis.versao_termos` passam a ser protegidos (trigger novo): a pessoa não forja
o aceite editando o próprio perfil; só a função grava.

## Configurações novas (grupo `geral`, públicas)

| Chave | Padrão | Uso |
|---|---|---|
| `contato.email_suporte` | `null` | e-mail da equipe na Central de ajuda (o WhatsApp já existia: `contato.whatsapp_suporte`) |
| `ajuda.texto_contato` | texto simples | frase acima dos botões de contato |
| `termos.aviso_titulo` / `termos.aviso_texto` | textos simples | faixa "Atualizamos os termos" |

## Rotas e telas

| Rota | Tela | Notas |
|---|---|---|
| `/termos`, `/privacidade` | T41 | versão ativa em markdown seguro (sem HTML: cada trecho vira elemento React, links só `http(s)`, `mailto:` e caminho interno). `?versao=N` mostra uma versão antiga, com aviso |
| `/ajuda` | T40 | dicas de segurança primeiro (golpes do sinal, do link falso, do código), depois vender, comprar, Radar, destaques e planos (com preços lidos de `destaque_tipos` e `planos`, nunca escritos no texto), conta. Contato da equipe pelo painel. Busca simples na página |
| `/aki` | T39 | o mesmo componente do balão (`BalaoAki` em `modo="pagina"`), mesma API `/api/aki`, mesmas regras. Fora do layout público para o campo de texto ficar embaixo, sem a barra de navegação |
| `/entrar/perfil` | T13 (parte dos termos) | quem cria conta cai aqui (`signUpFallbackRedirectUrl`) e aceita as versões ativas; quem já aceitou segue direto |
| `not-found` | T44 | busca, Início, Radar e Aki |
| página do anúncio | T44 | vendido já existia; pausado/expirado agora mostra "Este anúncio saiu do ar" com parecidos da categoria |
| faixa "Sem internet" | T43 | `navigator.onLine` + eventos `online`/`offline`, no layout raiz. Sem service worker (ver decisões) |
| faixa "Atualizamos os termos" | — | no layout público e da conta, só para quem está logado e tem versão pendente. Não bloqueia: Aceitar, Ler e Agora não (esconde até o próximo carregamento) |
| `/admin/textos` | tela 12 | abas Ajuda, Termos e privacidade, Página inicial |

## Como cada regra é garantida

- **Nada fixo no código:** textos legais, perguntas da ajuda, contato, títulos e ordem dos blocos da home vêm das tabelas acima ou de `configuracoes`. Preços na ajuda vêm de `planos` e `destaque_tipos`.
- **Versão dos termos:** só a função cria versão; o número é sempre o próximo; uma versão ativa por tipo (índice único parcial). Aceite amarrado ao `documento_id` que a pessoa leu.
- **Rascunho honesto:** a semente sai com `revisado_advogado = false`, e o painel mostra "RASCUNHO: um advogado precisa revisar". O texto não diz em lugar nenhum que foi revisado.
- **Não forjar:** aceite, versão e selo de revisão só por funções SECURITY DEFINER que conferem `usuario_id()` / `e_admin()`. IP do aceite não sai pela API.
- **Home:** os blocos pagos (`destaques`, `lojas_destaque`) e o `recentes` não podem ser desligados (`pode_desligar = false`), só mudar de lugar: quem pagou destaque continua aparecendo. "Patrocinado" continua nos cards.
- **LGPD:** aceites entram no "Baixar meus dados" e somem com a conta (`on delete cascade`).
- **Markdown seguro:** nada de `dangerouslySetInnerHTML`; HTML digitado aparece como texto.
