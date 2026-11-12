# Hipótese de trabalho: piloto acompanhado do OL-AQUI

Autor: Raniel Levi Lemos Lima.
Data de referência do usuário: 2026-11-09, America/Sao_Paulo.
Status: recorte autorizado para análise; recomendações ainda não aprovadas.

## Problema e resultado esperado

Analisar o projeto existente como um todo, identificar pontos fracos e priorizar o necessário para um piloto pequeno, com compradores e lojistas convidados da região e acompanhamento próximo. O piloto deverá permitir negociações reais e produzir evidências sobre conclusão do fluxo, respostas úteis das lojas e retorno dos participantes.

O usuário autorizou avançar com a análise nesse cenário. A tarefa é avaliar e recomendar; não inclui implementação, publicação, cobrança, convite ou envio de mensagens.

## Limites e critérios

- Examinar experiência de compradores e vendedores, segurança e dados, operação, aquisição inicial, medição, custos, dependências e manutenção.
- Separar constatação atual no código, relato histórico em documentação, hipótese de negócio e comportamento ainda não verificado em produção.
- Distinguir contato iniciado, oferta escolhida, negócio relatado e negócio confirmado pelos participantes. Avaliar ajuda manual e retorno espontâneo separadamente.
- Propor bloqueadores, prioridades durante o piloto e itens adiáveis, com critérios verificáveis de aceitação.
- Evitar assumir que recursos ausentes da documentação antiga continuam ausentes do código.
- O orçamento, a data de abertura, a quantidade de convidados, os segmentos e os responsáveis ainda não foram definidos. Sugerir um experimento pequeno e explicitar números propostos como parâmetros de teste, sem inventar disponibilidade ou resultados.
- A documentação inicial cita Corrente-PI, extremo sul do Piauí e Formosa do Rio Preto-BA. O recorte autorizado agora é apenas um piloto pequeno na região. Não tratar toda essa área histórica como abertura obrigatória.

## Fonte atual e regras de revisão

Repositório: `/home/raniel-linux/workspace/OLAQUI`.
HEAD inicial: `af2d3bf62bed537b7481f3653d6cf9a292a50a65`.
Alterações preexistentes: `supabase/migrations/20261110020853_moderacao_aluguel.sql` modificado e `supabase/.temp/` não versionado. Preservá-las. Não editar código de produto nem executar testes com escrita em serviços externos.

Atualização de fonte durante a revisão: o recorte foi fixado em `2f00c55df54cad2a4a687e4641a821566c800630`, após apenas uma atualização documental e remoção de linha vazia. Posteriormente surgiram alterações concorrentes de moderação por IA e um `concepts_brief.md` na raiz para outro assunto. Preservar esses arquivos e não usar seus pareceres. Nossa entrega fica exclusivamente em `docs/brainstorm-piloto-2026-11-09/concepts_brief.md`. Mudanças posteriores ao recorte não estão cobertas pelos testes já executados; quando um arquivo rastreado mudar, consultar a revisão fixada com `git show`.

Ler o código e as migrações cumulativas quando uma conclusão depender deles. Documentos QA são registros de testes anteriores, não prova automática do estado presente. Não consultar conversas, memórias ou relatórios de outros revisores durante a revisão independente.

## Leitura inicial selecionada

1. `README.md` e `package.json` para orientação, verificando diferenças com a implementação.
2. `docs/CORRECOES-FLUXO-2026-11-09.md`.
3. `docs/QA-RADAR-2026-11-09.md`.
4. `docs/QA-WHATSAPP-2026-11-09.md`.
5. `docs/QA-MEU-PLANO-2026-11-09.md`.
6. `docs/etapa5/relatorios.md` e `docs/etapa4/paginas.md`.

A revisão `docs/REVISAO-PRODUTO-RISCOS-NOME-2026-11-08.md` contém aviso explícito de desatualização. Não usá-la como lista de defeitos atuais.

## Formato esperado dos pareceres

Português claro, sem travessões. Para cada achado: evidência com caminho e linha, efeito no piloto, prioridade justificada e a menor ação que permita validar ou corrigir. Explicitar o contra-argumento e por que a recomendação continua válida, ou quando deixa de ser necessária. Relatar arquivos realmente lidos e limitações. Não produzir listas genéricas de boas práticas. Uma hipótese ainda não demonstrada deve ser chamada de hipótese.
