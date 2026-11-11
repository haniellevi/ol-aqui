# Verificação complementar do piloto

Data de referência: 2026-11-09, America/Sao_Paulo. Avaliação do repositório e de superfícies publicadas, sem modificar a aplicação nem enviar mensagens.

## Recorte e mudanças concorrentes

O início da análise usou o HEAD `af2d3bf62bed537b7481f3653d6cf9a292a50a65` com uma alteração preexistente na migração de moderação. Durante a análise o HEAD passou a `2f00c55df54cad2a4a687e4641a821566c800630`. A diferença foi a inclusão de `docs/QA-CADASTRO-INICIO-2026-11-09.md` e a remoção de uma linha vazia na migração. Não houve mudança funcional nesse intervalo que justificasse repetir os testes concluídos. Nenhuma dessas alterações foi feita por esta análise.

Depois desses testes surgiram arquivos e alterações concorrentes de moderação por IA, incluindo uma migração nova, uma rota interna, um módulo e `.env.example`. Também apareceu `concepts_brief.md` na raiz, pertencente a outro brainstorm. Esses arquivos foram preservados e não integram a certificação dos testes acima. A análise fixa o código em `2f00c55df54cad2a4a687e4641a821566c800630` e grava sua síntese somente nesta pasta. A prontidão de uma versão futura exige conferir a diferença e seus próprios testes.

## Verificações executadas nesta sessão

| Verificação | Resultado | Limite da evidência |
| --- | --- | --- |
| `npm test` | 191 aprovados, zero falhas | Testes de aplicação; não reproduzem todos os serviços publicados. [Log](./node-tests.log). |
| `npm run test:db` | Todas as verificações passaram, incluindo permissões, concorrência, OTP, Radar, planos, anúncios e moderação de aluguel | PostgreSQL 17 descartável, sem rede e sem credenciais externas. Não confirma migrações, backups ou agendamentos de produção. [Log](./db-tests.log). |
| `npm run typecheck` | Aprovado | Análise estática. [Log](./typecheck.log). |
| `npm run lint` | Zero erros; dez avisos em componentes de demonstração | Os avisos não impedem a checagem. [Log](./lint.log). |
| `npm run build` | Falhou na pré-renderização de `/aki` por ausência da chave pública do Clerk neste ambiente | A sessão local não recebeu variáveis do projeto. Não atribuir a falha a um defeito de produção nem declarar build local aprovado. [Log](./build.log). |
| `npm audit --omit=dev --json` | Três pacotes sinalizados: duas severidades altas e uma moderada | Contagem de pacotes, não três explorações comprovadas. Requer triagem de alcance e correção compatível. [Resultado integral](./npm-audit.json). |

## Superfícies publicadas observadas

Consultas Vercel feitas pelo conector oficial. Navegação somente de leitura pelo navegador integrado.

| Superfície | Observação | Interpretação permitida |
| --- | --- | --- |
| Alias `ol-aqui.vercel.app` | Primeira consulta: deployment `dpl_6KZR1sFqowS5iCMGzt4bMkEn28Cx`, READY, production, SHA `2cd608e68d7455411c0a4f1b23ffc11448ed32b5`. Consulta posterior: `dpl_6z6p1WVUZurepQ2BZmkn5g5GvY92`, READY, production, SHA `2f00c55df54cad2a4a687e4641a821566c800630` | A diferença de revisão foi superada durante a análise: o alias passou ao mesmo commit do recorte. Isso confirma build/deploy da plataforma, sem substituir o ensaio comercial completo. Os dois deployments foram realizados fora desta análise. |
| Domínios do projeto Vercel | A listagem retornou somente `ol-aqui.vercel.app` | Os domínios próprios citados no README não foram demonstrados como ligados a este projeto. Conferir um domínio já controlado e sua configuração no login de produção; não presumir necessidade de comprar outro domínio. |
| [Página inicial](https://ol-aqui.vercel.app/) | Na seção de recentes da região de Corrente apareceu o estado vazio de anúncios | Confirma a experiência observada, sem concluir que todo o banco está vazio. Oferta real precisa estar disponível para os convidados. |
| [Ajuda](https://ol-aqui.vercel.app/ajuda) | A seção de contato exibiu mensagem de contato da equipe ainda indisponível e apontou para o Aki | Falta um canal humano acessível pela página consultada. |
| [Aki](https://ol-aqui.vercel.app/aki) | Exibiu o estado de indisponibilidade | O caminho oferecido como alternativa de atendimento não resolveu a falta de contato humano nessa observação. Ativar IA não é condição para corrigir o atendimento. |
| [Pedir no Radar](https://ol-aqui.vercel.app/radar/pedir) | O formulário carregou. O modo de contato direto por WhatsApp veio selecionado; propostas privadas estavam disponíveis | A revisão não enviou um pedido. A presença do formulário não comprova o ciclo comprador-loja. Explicar os modos e testar a escolha do comprador no ensaio. |
| `/admin/relatorios` | A sessão disponível recebeu a página de não encontrado | Não prova ausência do painel: o código faz controle de acesso. Não houve leitura de métricas administrativas de produção. |
| Autenticação no navegador publicado | Os avisos do Clerk no console indicaram uso de chaves de desenvolvimento e limites de uso. A navegação para `/entrar` retornou à home pela sessão existente | Confirma o ambiente de desenvolvimento usado pelo cliente observado. Não foram extraídas chaves nem encerrada a sessão do usuário. |
| [Privacidade](https://ol-aqui.vercel.app/privacidade) | A página exibiu campos por preencher para identificação do controlador e contato do encarregado | Documento público incompleto na superfície observada. Não é inferência baseada apenas na semente SQL. |
| [Termos](https://ol-aqui.vercel.app/termos) | A seção de identificação do operador exibiu campos por preencher e remeteu à Ajuda | O participante não encontra ali a identificação definida nem um canal humano operacional no destino indicado. |

As tentativas de leitura dos domínios pelo buscador não conseguiram abrir as páginas. Isso não foi tratado como indisponibilidade, pois a navegação no navegador abriu o site. O conector Supabase exigiu um identificador de conexão não disponibilizado nesta sessão. Não foram consultadas tabelas, configurações privadas, migrações aplicadas, cron ou backups do banco publicado. Nenhum segredo foi extraído para contornar essa limitação.

## Conferências no código

1. O contato da ajuda já é configurável: `src/lib/dados/paginas.ts:101` lê `contato.whatsapp_suporte`, `contato.email_suporte` e `ajuda.texto_contato`. `src/app/(publico)/ajuda/page.tsx:97` contém o estado observado. A menor correção é preencher e validar o canal existente e ajustar o encaminhamento quando o Aki estiver desligado.
2. As mensagens comerciais automáticas disponíveis são avisos dentro do site: `src/lib/tipos-relatorios.ts:41`. O envio de código por WhatsApp possui implementação própria; não comprova envio de alertas de propostas pelo mesmo canal. Para o piloto, uma rotina humana consentida pode cobrir o aviso, com registro de quando houve intervenção.
3. O funil administrativo expõe visualizações, cliques, compartilhamentos e anúncios marcados como vendidos: `src/lib/tipos-relatorios.ts:72` e `supabase/migrations/20261108060000_mensagens_relatorios.sql:505`. O agregado não estabelece sequência individual comprador-pedido-resposta-negociação-retorno. Há base para reaproveitar os dados existentes e completar o piloto com um registro simples.
4. `infra/whatsapp/README.md` descreve dependência de uma sessão pareada, recuperação, limites e necessidade de acompanhar entrega real. Os testes de banco não validam a sessão externa. O plano de operação deve conter responsável, alerta de falha e retomada sem marcar telefones como confirmados por fora do processo.

A identificação e os contatos nos termos e na política devem refletir o responsável real pela operação antes de receber os convidados. A ação proposta é preencher/adequar e revisar os textos publicados, com versão coerente no aceite. Esta constatação não determina obrigação jurídica específica de nomear encarregado nem conclui infração legal; essas decisões dependem da operação e de revisão apropriada.

## Alertas de dependências: triagem antes de receber uploads

`npm ls` confirmou `next@15.5.29`, `sharp@0.34.5` e `postcss@8.4.31` dentro do Next. O PostCSS do Tailwind é outra instalação, `8.5.32`; a versão nova na raiz não elimina a cópia vulnerável aninhada. O `sharp` local informa libvips `8.17.3`, libheif `1.20.2` e librsvg `2.61.2`.

O mantenedor do Sharp relaciona versões anteriores a `0.35.0` a falhas na libvips, versões anteriores a `0.35.4` a falhas na libheif e versões anteriores a `0.35.5` a uma falha na librsvg. A exposição depende do formato decodificado e das condições do ambiente. Fontes primárias: [libvips](https://github.com/lovell/sharp/security/advisories/GHSA-f88m-g3jw-g9cj), [libheif](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c), [librsvg](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).

O alerta de leitura de arquivos do PostCSS exige CSS controlado por terceiros alcançar o processador. Não foi demonstrado esse percurso no produto. O projeto processa CSS na construção, portanto é necessário avaliar separadamente o ambiente de construção e o serviço de imagens. [Aviso primário do PostCSS](https://github.com/postcss/postcss/security/advisories/GHSA-6g55-p6wh-862q).

`next.config.ts:16` permite imagens do Storage configurado; `src/lib/fotos.ts:35` converte imagens no fluxo normal do navegador. Essa conversão não basta, sozinha, para declarar que toda entrada externa é inofensiva. Não foi tentado explorar qualquer serviço. Tampouco foi confirmado o pacote nativo usado internamente pelo otimizador gerenciado da Vercel. Portanto, classificar como **alerta confirmado na árvore local, alcance de produção a verificar**, não como comprometimento ou exploração comprovada.

Prioridade sugerida: antes de habilitar uploads dos convidados, verificar o caminho efetivo de imagens e atualizar dependências de forma compatível ou demonstrar mitigação efetiva. Aceite: versões/mitigações registradas, alerta triado com justificativa, construção no ambiente configurado e regressão de publicação/miniaturas aprovadas. Não executar atualização forçada do framework sem avaliar impacto.

## Autenticação de produção antes de admitir contas comerciais

O modo de desenvolvimento foi confirmado pelos avisos do Clerk no navegador publicado, além do QA recente. Consultei a documentação atual pelo Context7 e pelo site oficial. O fornecedor declara que a instância de desenvolvimento não se destina a cargas de produção e que os dados de usuários não podem ser transferidos entre as instâncias. O fluxo de produção exige domínio controlado, chaves próprias e configuração das integrações. [Ambientes do Clerk](https://clerk.com/docs/guides/development/managing-environments), [publicação em produção](https://clerk.com/docs/guides/development/deployment/production).

O impacto específico está na identidade: `supabase/migrations/20261107000000_olaki_inicial.sql:91` usa o ID do Clerk como chave do perfil; lojas e pedidos referenciam esse perfil. `src/lib/perfil.ts:36` procura o perfil por `u.id` e `:43` grava esse ID. Portanto, trocar chaves/instância sem reconciliar os usuários pode desvincular o acesso aos dados já criados. Essa é uma inferência sustentada pelo esquema e pelo sincronizador, não uma perda de dados observada.

Prioridade: antes dos convites comerciais, preparar login de produção no domínio controlado, reconfigurar integração Supabase, webhooks e provedores efetivamente usados, inventariar as contas e dados existentes e definir o tratamento compatível de seus vínculos. Preservar os registros até que esse tratamento tenha sido decidido e testado. Não criar correspondência automática por telefone ou e-mail sem verificar titularidade. Aceite: login e OTP, acesso ao perfil/loja/pedidos corretos, isolamento entre duas contas e eventos de atualização/exclusão validados na instância escolhida. É uma preparação de identidade e ambiente, não um motivo para substituir toda a autenticação.

## Evidências históricas acrescentadas durante a análise

O novo `docs/QA-CADASTRO-INICIO-2026-11-09.md` registra teste autorizado de cadastro, OTP, anúncio fictício publicado e depois pausado, além de correção da moderação de aluguel aplicada no banco publicado. Isso é evidência documental de um percurso real do anunciante, não uma repetição realizada nesta análise. Ainda não demonstra uma negociação comercial entre comprador e lojista nem retorno espontâneo. O mesmo documento registra que a instância Clerk permanece de desenvolvimento; a adequação ao piloto deverá ser confirmada no ambiente escolhido, sem tratar migração de contas como uma troca trivial de chave.

## Consequência para a recomendação

Não há base para declarar o piloto liberado somente pelos testes locais. Os achados sustentam preparação focada: autenticação de produção com tratamento dos vínculos existentes, canal humano real, oferta inicial verificável, ensaio conjunto no endereço correto, triagem de dependências e registro mínimo que distinga ajuda, resposta, contato, negócio e retorno. Novas funções do Aki, expansão e novos painéis devem responder a gargalos observados, preservando as funcionalidades existentes que já passaram pelas verificações.
