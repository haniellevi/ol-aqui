# Verificação da publicação em produção

Teste autorizado pelo usuário em 10/11/2026, após publicar a regra de moderação do PR #45. Executado no projeto Supabase `ncrbqqdgweuqpsppxwti`, usando a função real `publicar_anuncio` e os gatilhos instalados em produção.

## Primeira etapa: banco com rollback

A sessão disponível no Chrome foi encaminhada de `/anunciar` para `/confirmar-celular`. Não foram enviados códigos, alteradas credenciais ou dispensada a confirmação. Por isso, a verificação foi feita diretamente no banco, dentro de uma transação com `ROLLBACK`.

Foram criados três rascunhos fictícios novos, com dados de categoria/foto da fixture de teste anterior, sem alterar o anúncio original. Todos usaram categoria Casas, finalidade Venda e preço de R$ 1.000,50, também exercitando a retirada do piso de preço da moderação.

As operações usaram `SET LOCAL ROLE authenticated` e identidade simulada de uma conta comum existente, com WhatsApp já confirmado, vitrine ativa e vagas no plano. Asserções confirmaram `e_admin=false`, ausência do papel de moderador e `acesso_sistema=false` antes das operações. A publicação foi chamada pela mesma função utilizada pela ação do aplicativo. Depois, a leitura usou o papel `anon`, sem identidade, pela função `anuncio_publico`.

### Resultados observados no banco

| Caso | Retorno de publicar | Status persistido na transação | Exige equipe | Consulta pública anônima |
| --- | --- | --- | --- | --- |
| Texto comum, sem termo sensível | `ativo` | `ativo` | Não | Retornou o anúncio |
| Palavra `sexual` no título | `em_analise` | `em_analise` | Sim | Não retornou o anúncio |
| Palavra `violência` na descrição | `em_analise` | `em_analise` | Sim | Não retornou o anúncio |

O anúncio comum recebeu data de publicação e ficou sem motivo de análise. Os dois sensíveis receberam o motivo específico `Termo sexual ou violento` com a palavra identificada. Repetir `publicar_anuncio` manteve ambos pendentes.

Identificadores das linhas fictícias revertidas: `a6a0f8d7-4127-453b-bca6-38ba0ee636bb`, `4586c3b2-f6b0-445d-a546-064bb76282c4` e `5d418155-e81c-4c62-a63a-f5fad1b2f173`.

Consulta posterior ao rollback confirmou zero anúncios, zero logs de anúncios e zero entradas de IA para esses IDs. A fixture original permaneceu pausada. O domínio de produção continuava no deployment `dpl_9x66Wss2qFEWFUPLzy2eNVKfumff`, estado `READY`, commit `490e4780a2a43caa71fecbc352f6b040fc0d1d56`.

### Limites da primeira etapa

Esta primeira etapa comprova o comportamento real do banco de produção com identidade simulada. Isoladamente, não comprova autenticação JWT/Clerk, upload novo de foto, execução da Server Action, confirmação visual pela interface ou acesso HTTP à página de um anúncio publicado. A transação foi revertida, portanto suas linhas fictícias não ficaram visíveis fora dela nem foram oferecidas ao público. A etapa seguinte verificou esses caminhos pela interface.

## Segunda etapa: fluxo real pela interface em 10/11/2026

No Chrome autenticado, a conta exibida era **Igreja Filadélfia Corrente**, tipo pessoa física, com vendedor público **Igreja**, sem acesso administrativo. Foram criados três anúncios fictícios pelos seis passos do formulário, incluindo upload de uma foto identificada como **ANUNCIO TESTE SEM OFERTA**. Todos usaram categoria **Outros > Diversos**, cidade **Corrente** e bairro vazio.

| Caso e identificador | Conteúdo e preço | Resultado na interface | Verificação HTTP sem sessão Clerk |
| --- | --- | --- | --- |
| Comum: `e18f8b9c-9a53-4c08-ad39-3c863b47f696` | Título `TESTE TÉCNICO 1011 comum, sem oferta`; R$ 999.999,00 | **Seu anúncio está no ar** | HTTP 200, título presente |
| Sexual: `23dc8799-2692-4b80-adeb-2f4627c366f6` | Título `TESTE TÉCNICO 1011 sexual, sem oferta`; R$ 1,00 | Em análise; motivo `Termo sexual ou violento: "sexual"` | HTTP 404, título ausente |
| Violento: `ec30b732-fbbe-4df7-890f-38379c45686c` | Título `TESTE TÉCNICO 1011 terceiro, sem oferta`; descrição fictícia com `Palavra de teste: violência.`; R$ 1,00 | Em análise; motivo `Termo sexual ou violento: "violência"` | HTTP 404, título ausente |

As consultas HTTP foram realizadas pelo plugin Vercel, sem sessão Clerk. O caso comum confirmou publicação imediata mesmo com preço alto; os termos sensíveis permaneceram fora da página pública.

Ao terminar, os três anúncios foram movidos para a lixeira pela interface. A tela final mostrou **Na lixeira** para todos, com situações anteriores **no ar**, **em análise** e **em análise**. A consulta HTTP pública do anúncio comum passou a retornar **404**, com título ausente, confirmando sua retirada do ar. Os dois rascunhos existentes foram preservados; o painel manteve os totais originais: **Ativos 0, Rascunhos 2, Pausados 1 e Em análise 1**. As linhas desta etapa permanecem na lixeira, diferentemente das linhas revertidas na primeira etapa.

Evidências visuais: [comum publicado](/home/raniel-linux/.codex/visualizations/2026/11/10/01a1c553-b6ab-7953-ad18-5c2698ac615f/moderacao-comum-publicado.jpg), [sexual pendente](/home/raniel-linux/.codex/visualizations/2026/11/10/01a1c553-b6ab-7953-ad18-5c2698ac615f/moderacao-sexual-pendente.jpg) e [violento pendente](/home/raniel-linux/.codex/visualizations/2026/11/10/01a1c553-b6ab-7953-ad18-5c2698ac615f/moderacao-violento-pendente.jpg).

## Máscara do WhatsApp em produção

O PR #46 foi integrado e publicado no commit `a8bc4e55d0d576d17a56dd0b63d4c6a1b7b102f7`, deployment `dpl_6StRrR7xUWTPSnSuLrmvz5onRotp`, estado **READY**. Passaram 264 testes, a checagem de tipos e o lint. No navegador foram conferidos formatação, colagem com `+55`, DDD 55, excesso de dígitos, número estrangeiro e entrada incompleta, sem solicitar ou enviar código OTP.

Evidência: [máscara do WhatsApp em produção](/home/raniel-linux/.codex/visualizations/2026/11/10/01a1c553-b6ab-7953-ad18-5c2698ac615f/mascara-whatsapp-producao.jpg).
