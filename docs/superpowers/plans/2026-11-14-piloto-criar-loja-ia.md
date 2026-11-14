# Cadastro de loja com IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que uma loja convidada gere um rascunho privado, retome a revisão em Minhas lojas e publique a vitrine com uma confirmação.

**Architecture:** O cadastro salva um rascunho por conta e enfileira o trabalho por fonte no Supabase. O processamento usa a rota interna agendada do projeto e grava sugestões com origem, preservando as edições. Uma transação reaproveita a criação existente e publica os campos e as referências das imagens aprovadas.

**Tech Stack:** Next.js, TypeScript, Clerk, Supabase Postgres e Storage, pg_cron, Merc, Evolution, Node Test Runner.

**Spec:** [Desenho aprovado no commit 453b027](../specs/2026-11-14-piloto-criar-loja-ia-design.md).

## Restrições

- Uma conta convidada, escolhida pelo responsável na hora do teste. Cadastro manual disponível para todas as contas elegíveis. Destaque pago e categorias compartilhadas têm entregas próprias.
- Mostrar **Criar com IA**, **Preencher manualmente**, **Agora não**, **Gerar rascunho**, **Me avise quando ficar pronto** e **Criar minha loja** nas etapas indicadas. O botão de gerar é o ponto de partida do processamento.
- Facebook entra como fonte. Site e Instagram podem ser publicados nos campos atuais. Google Maps e avaliações ficam acessíveis por link para conferência no Google. CNPJ serve à consulta privada.
- Um rascunho ativo por conta. Uma vitrine por confirmação e um aviso de conclusão por rascunho. Imagens privadas até a publicação, com acesso público apenas para as selecionadas.
- Usar a instância Evolution existente apenas para leitura autorizada do perfil comercial do próprio número verificado. Reaproveitar a fila de avisos e sua janela de envio.
- Usar a base da branch do piloto e revisar o diff contra a base antes de integrar. Em cada tarefa de banco, atribuir às novas migrações versões posteriores à última migração da branch e registrar os testes em `supabase/testes/automatizados.py`.

## Pontos de revisão

- Duas abas geram rascunho ou tentam confirmar ao mesmo tempo. Tarefas 1 e 5 travam a operação certa e verificam os resultados das duas chamadas.
- Uma fonte termina depois que o lojista corrige ou limpa um campo. Tarefa 2 mantém a edição e registra a sugestão à parte.
- O WhatsApp confirmado muda entre a autorização e a consulta ou entre o pedido de aviso e o envio. Tarefa 3 verifica as duas janelas.
- O processamento de uma imagem falha ou o lojista remove a imagem na última revisão. Tarefas 4 e 5 mantêm a loja privada e publicam somente a seleção final.
- O lojista conclui o fluxo com cadastro manual em outra aba, ou sua conta deixa de estar apta para criar loja. Tarefas 1 e 5 preservam as regras atuais.

---

## Tarefa 1. Rascunho e convite no servidor

**Arquivos:** criar `supabase/migrations/<versão>_loja_ia_rascunhos.sql`, `supabase/testes/880_loja_ia_rascunhos.sql`, `src/lib/loja-ia/tipos.ts`; ajustar `supabase/testes/automatizados.py`.

**Contrato:** `EntradaRascunho` contém `nome`, `cidade`, `site?`, `instagram?`, `facebook?`, `cnpj?`, `descricao?`, `materiais: string[]`, `consultarWhatsapp: boolean` e `avisarWhatsapp: boolean`. `RascunhoLoja` tem `id`, `revisao: number`, `estado: 'coleta' | 'processando' | 'pronto' | 'publicado'`, `entrada`, `fontes`, `campos: CamposRascunho` e `vitrineId: string | null`. `CamposRascunho` mapeia `CampoRascunho` para `nome`, `cidade`, `slug`, `categoria`, `sobre`, `whatsapp`, `endereco`, `site`, `instagram`, `logo` e `capa`. Logo e capa usam IDs privados de materiais. `FonteLoja` admite `site`, `instagram`, `facebook`, `cnpj`, `whatsapp`, `materiais` e `informado`. `CampoRascunho` tem `valor: string | null`, `editado: boolean`, `origem: OrigemCampo | null` e `sugestao: { valor: string; origem: OrigemCampo } | null`. `OrigemCampo` contém `fonte: FonteLoja`, `rotulo: string` e `url?: string`, restrita a referências públicas adequadas ao campo. RPCs `loja_ia_piloto_autorizado()`, `loja_ia_obter()`, `loja_ia_abrir_coleta()` e `loja_ia_salvar_coleta(p_id uuid, p_revisao integer, p_entrada jsonb)`.

- [ ] Criar casos SQL para conta sem convite, outro dono tentando ler e gravar por ID, perda de elegibilidade, versão desatualizada e duas aberturas concorrentes retornando o mesmo rascunho. Rodar `npm run test:db` e confirmar a falha pela ausência das RPCs.
- [ ] Implementar a lista privada de convites operada pela equipe, sem interface administrativa própria para uma conta. Criar as RPCs, vincular o dono a `usuario_id()`, aplicar RLS e limitar a escrita às operações autorizadas. Garantir unicidade ativa no banco e usar revisão ao gravar. Permitir a conversão de vendedor avulso e identificar loja já criada. Reutilizar a elegibilidade do cadastro de loja e da conta autenticada. Guardar o número confirmado apenas no servidor quando o lojista autorizar o uso correspondente.
- [ ] Rodar `npm run test:db` e `npm run typecheck`. Commit `feat: guarda rascunhos privados de loja com IA`.

## Tarefa 2. Processamento em segundo plano e fontes

**Arquivos:** criar `supabase/migrations/<versão>_loja_ia_processamento.sql`, `supabase/testes/881_loja_ia_processamento.sql`, `src/app/api/interno/loja-ia/route.ts`, `src/lib/loja-ia/fontes.ts`, `src/lib/loja-ia/processar.ts` e `tests/loja-ia-processamento.test.cjs`. Reutilizar `src/lib/aki/lojista.ts` e `src/lib/verificacao-loja/receita.ts` onde indicado.

**Contrato:** `loja_ia_iniciar(p_id uuid, p_revisao integer)` muda de coleta para processamento e cria trabalhos numa transação. `loja_ia_pegar(p_limite integer)` retorna trabalhos com ID e token da tentativa. `loja_ia_concluir_fonte(p_trabalho uuid, p_tentativa uuid, p_resultado jsonb)` vincula o resultado à tentativa atual. `loja_ia_retentar_fonte(p_id uuid, p_fonte text)` reabre uma fonte falha. `loja_ia_salvar_revisao(p_id uuid, p_revisao integer, p_edicoes jsonb)` grava apenas campos enviados, incluindo remoções explícitas. A finalização lê a revisão atual e aplica a mescla sob trava. `coletarFonte(trabalho: TrabalhoFonte): Promise<ResultadoFonte>` retorna evidências de campos ou `indisponivel`, com motivo legível. `mesclarSugestoes(campos: CamposRascunho, sugestoes: SugestaoCampo[]): CamposRascunho` mantém valores editados e origem validada.

- [ ] Escrever `lease expirado pode ser retomado`, `resultado atrasado não sobrescreve edição nem campo limpo`, `retentativa processa só a fonte escolhida` e `falha de todos os provedores permite revisar dados informados`. Cobrir coleta sem fonte ou descrição, clique repetido, domínio não público e redirecionamento recusado com fixtures locais. Rodar `node --test tests/loja-ia-processamento.test.cjs` e `npm run test:db` para ver as falhas.
- [ ] Implementar a rota seguindo `src/app/api/interno/verificacao-loja/route.ts` e a autenticação do cron existente. Reservar trabalhos com `FOR UPDATE SKIP LOCKED`, prazo de reserva e limite por chamada. Uma tentativa vencida perde o direito de gravar. Quando todas as fontes solicitadas tiverem resultado, inclusive indisponível, montar a revisão e marcá-la como pronta. Limitar tentativas, tempo e tamanho. Retentar uma fonte mantém a revisão aberta e não refaz as fontes concluídas. Um resultado que chega após a publicação não altera a vitrine.
- [ ] Usar site, Instagram e Facebook fornecidos pelo lojista, incluindo nomes de perfil que possam ser normalizados. Ler somente dados públicos acessíveis por meios autorizados, com destino HTTPS público validado em cada conexão e redirecionamento. Se a fonte exigir login ou acesso indisponível, registrar a falha. Consultar CNPJ pelo adaptador existente apenas se o provedor e o uso estiverem autorizados para o piloto. Filtrar dados pessoais desnecessários antes de chamar a IA. Montar o link do Maps com nome e cidade ou endereço informado. A IA recebe evidências delimitadas, usa as cotas do Merc e devolve sugestões estruturadas vinculadas a evidências conhecidas. Deixar em branco os dados incertos. Se a IA falhar, abrir a revisão com os dados informados.
- [ ] Rodar `node --test tests/loja-ia-processamento.test.cjs`, `npm run test:db` e `npm run typecheck`. Commit `feat: processa fontes do rascunho em segundo plano`.

## Tarefa 3. Perfil comercial e aviso no WhatsApp

**Arquivos:** criar `infra/whatsapp/perfil-loja.py`, `src/lib/loja-ia/whatsapp.ts`, `supabase/migrations/<versão>_loja_ia_whatsapp.sql`, `supabase/testes/882_loja_ia_whatsapp.sql` e `tests/loja-ia-whatsapp.test.cjs`; ajustar `infra/whatsapp/nginx.conf`, `infra/whatsapp/README.md` e `src/lib/loja-ia/processar.ts`. Criar `src/app/api/interno/loja-ia/perfil-whatsapp/route.ts` para resgatar o ticket.

**Contrato:** `consultarPerfilComercial(trabalho: TrabalhoFonte): Promise<ResultadoFonte>`. O serviço intermediário no VPS aceita apenas um ticket específico de consulta. A rota interna da aplicação resgata o ticket uma vez com autenticação de serviço, valida a tentativa atual, consentimento, dono e número confirmado, e devolve o número para a chamada local. `loja_ia_enfileirar_aviso(p_id uuid)` emite a chave `loja_ia_pronta:<id>` para a fila existente.

- [ ] Testar ticket expirado ou reapresentado, troca de número após o consentimento, ausência de perfil comercial, fornecedor fora do ar, aviso sem solicitação, autorização retirada e conclusão duplicada. Simular troca de número após enfileirar e antes do envio. Rodar `node --test tests/loja-ia-whatsapp.test.cjs` e `npm run test:db`.
- [ ] Fixar a instância e a operação `fetchProfile` no VPS. Autenticar ambas as chamadas de serviço, colocar limite de prazo e requisições e limitar a resposta a nome comercial, descrição e site disponíveis. A consulta usa o endereço local da Evolution. Se o intermediário estiver desativado, o perfil não for comercial ou a consulta falhar, marcar a fonte como indisponível e seguir. Manter o fluxo vigente de verificação para número comercial diferente.
- [ ] Enfileirar o aviso deduplicado na primeira revisão pronta, inclusive parcial, com link autenticado para o rascunho. Comparar número e verificação com a autorização ao enfileirar e em `whatsapp_fila_confirmar_envio`, no ramo da chave do piloto. Reutilizar a janela e os estados da fila. Uma falha transitória ao enfileirar pode ser retomada pela rotina interna sem mudar o estado do rascunho. Conservar o acesso por **Minhas lojas** se a mensagem falhar. O 200 da Evolution indica aceitação do envio, e a confirmação de chegada será feita com o lojista.
- [ ] Rodar `node --test tests/loja-ia-whatsapp.test.cjs tests/whatsapp-envio.test.cjs`, `npm run test:db` e `npm run typecheck`. Commit `feat: consulta perfil comercial e avisa sobre rascunho`.

## Tarefa 4. Imagens privadas e capa do Merc

**Arquivos:** criar `supabase/migrations/<versão>_loja_ia_imagens.sql`, `supabase/testes/883_loja_ia_imagens.sql`, `src/lib/loja-ia/imagens.ts`, `src/app/api/loja/imagem/[id]/route.ts` e `tests/loja-ia-imagens.test.cjs`; ajustar `src/app/api/aki/lojista/route.ts`, `src/lib/dados/fotos.ts`, `src/app/(conta)/minha-conta/loja/actions.ts`, `src/app/(conta)/minha-conta/loja/vitrine-actions.ts` e a rota interna da tarefa 2.

**Contrato:** `prepararMaterial(rascunhoId: string, arquivo: MetadadosImagem): Promise<EnvioMaterial>` emite URL de envio para um registro privado do próprio rascunho. `prepararImagemPublicacao(rascunhoId: string, materialId: string, uso: 'logo' | 'capa'): Promise<ImagemPronta>` valida o arquivo e devolve uma versão imutável, ainda privada. `/api/loja/imagem/[id]` só serve conteúdo público se houver associação vigente com a vitrine publicável. Revisão autenticada usa URL assinada de curta duração.

- [ ] Testar material de outro dono, tipo real incompatível com extensão, tamanho excedido, arquivo substituído entre revisão e confirmação, acesso anônimo antes do commit, capa rejeitada e limpeza concorrente com publicação. Rodar `node --test tests/loja-ia-imagens.test.cjs` e `npm run test:db`.
- [ ] Guardar fotos, logo e capas em bucket privado. Validar metadados e conteúdo, aplicar os limites e a política de moderação atuais. Usar imagens fornecidas ou autorizadas explicitamente. Extrair apenas a geração de arte comum da rota do Merc para gravar uma capa privada com cota e origem “Gerada pelo Merc”. Controle de acesso à imagem pública pelo ID vinculado na transação da tarefa 5, sem tornar o bucket público. Voltar 404 e não armazenar resposta em cache quando o acesso não estiver autorizado.
- [ ] Usar a limpeza agendada para descartar uploads sem função, rejeitados e sobras após publicação. Registrar descarte no banco antes da remoção física, somente para imagens que perderam a função e estão fora de uso. Serializar limpeza e confirmação pela referência do arquivo. Repetir falha de Storage com segurança. Ajustar a limpeza e o editor existentes para reconhecer imagens do piloto quando a loja trocar logo ou capa depois de publicada.
- [ ] Rodar `node --test tests/loja-ia-imagens.test.cjs`, `npm run test:db` e `npm run typecheck`. Commit `feat: prepara imagens privadas para revisão e publicação`.

## Tarefa 5. Cadastro, revisão e confirmação

**Arquivos:** criar `src/app/(conta)/quero-vender/loja/criar-com-ia/page.tsx`, `src/app/(conta)/quero-vender/loja/criar-com-ia/actions.ts`, `src/components/anunciar/form-loja-ia.tsx`, `supabase/migrations/<versão>_loja_ia_publicacao.sql`, `supabase/testes/884_loja_ia_publicacao.sql` e `tests/loja-ia-cadastro.test.cjs`; ajustar `src/app/(conta)/quero-vender/loja/page.tsx`, `src/app/(conta)/quero-vender/actions.ts`, `src/components/anunciar/form-loja.tsx` e `src/app/(conta)/minha-conta/lojas/page.tsx`.

**Contrato:** `confirmarLojaIa(rascunhoId: string, revisao: number, form: FormData): Promise<EstadoLoja>`. `loja_ia_publicar(p_id uuid, p_revisao integer, p_campos jsonb, p_imagens jsonb)` recebe o mapa opcional `{ logo?: string; capa?: string }` com IDs preparados no servidor e devolve o resumo da mesma vitrine quando a confirmação já foi aplicada. O resultado é compatível com o retorno de `quero_vender_com_descricao`.

- [ ] Escrever testes SQL para revisão vencida, perfil revogado, vitrine criada manualmente em paralelo, erro ao preparar imagem, rollback após falha de campo complementar e duas confirmações para o mesmo rascunho. Verificar invariantes de visibilidade, titularidade, vínculo das imagens e início único do teste grátis. Testar navegação com e sem convite, pular redes, geração somente no botão final, edição que sobrevive ao retorno e seleção de imagens. Rodar `node --test tests/loja-ia-cadastro.test.cjs` e `npm run test:db`.
- [ ] Criar as etapas nome e cidade, redes com **Agora não**, materiais opcionais e **Gerar rascunho**. Persistir cada etapa sem disparar processamento. Explicar a alternativa de descrição curta quando faltarem fontes, pedir autorização de perfil separada do opt-in do aviso e mostrar o estado em **Minhas lojas**. Reutilizar o formulário atual na revisão, incluindo edição de todos os campos publicáveis, origem por campo, falhas por fonte, nova sugestão e remoção de imagens. Oferecer o link do Maps durante a revisão. Usar o assistente antigo apenas no caminho manual enquanto o piloto estiver restrito. Deixar a coleta disponível para retomar após atualizar ou fechar a página.
- [ ] Compartilhar validação e tradução de erros com `criarLoja`. Na confirmação, preparar os arquivos aprovados, conferir versão e elegibilidade e travar o rascunho. Dentro de uma transação, usar `quero_vender_com_descricao`, gravar endereço, site e Instagram com as mesmas validações de `vitrine-actions.ts` e do banco, anexar os IDs de logo e capa aprovados e persistir o resultado da publicação. Restringir a aceitação do URL interno de imagem à referência aprovada e pertencente à vitrine, sem relaxar `foto_do_olaki` para URLs arbitrários. Preservar as validações e a moderação existentes. Se o preparo falhar, mostrar o campo que precisa de correção e manter a revisão. Serializar a criação manual e por IA por dono no banco, inclusive sem vitrine prévia. Se o cadastro manual concluir primeiro, levar o lojista à vitrine existente e preservar seus dados. Se a confirmação do rascunho já foi aplicada, devolver seu resultado antes de exigir revisão nova.
- [ ] Rodar `node --test tests/loja-ia-cadastro.test.cjs`, `npm run test:db`, `npm run typecheck` e `npm run lint`. Commit `feat: revisa e publica loja com IA pelo cadastro`.

## Tarefa 6. Validar e abrir para uma loja

**Arquivos:** criar `docs/preparacao-piloto/criar-loja-ia.md` com procedimento, resultados e pendências de fornecedores. Conferir a configuração descrita em `infra/whatsapp/README.md`.

- [ ] Rodar `npm test`, `npm run test:db`, `npm run typecheck`, `npm run lint`, `npm run classes:conferir` e `npm run build`. Validar as migrações, tarefas agendadas e Storage em ambiente de teste. Verificar que falhas e métricas são diagnosticáveis sem registrar tokens, números, CNPJ ou conteúdo privado.
- [ ] No navegador, usar duas contas de teste e um ambiente controlado. Percorrer a coleta com e sem redes, sair durante o processamento, voltar por **Minhas lojas**, revisar um resultado parcial, retentar uma fonte e editar antes de confirmar. Pela sessão visitante, conferir ausência da vitrine e das imagens, inclusive ao acessar o URL direto. Depois de confirmar, conferir dados e imagens escolhidos, retorno para a mesma vitrine ao repetir o envio e cadastro manual na conta sem convite.
- [ ] Quando a entrega estiver pronta para o piloto real, aplicar a configuração com convites vazios, revisar a publicação e convidar somente a conta escolhida pelo responsável. Confirmar com ela o aviso recebido e registrar horário, origem exercitada, bloqueios e eventuais verificações pendentes. Testar a Evolution quando a loja autorizar a consulta para o próprio número confirmado. Distinguir perfil consultado de resposta sem dados comerciais. Se necessário suspender novas coletas, revogar o convite pelo procedimento documentado, preservando dados e vitrines.
- [ ] Registrar no procedimento quais critérios foram comprovados e os que ainda dependem da loja ou de um provedor. Commit `docs: registra validação e operação do piloto de loja com IA`.
