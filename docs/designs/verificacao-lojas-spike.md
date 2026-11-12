# Verificação de lojas: confirmações das APIs de fora (spike)

Feito em 12/11/2026, antes de programar. As Tasks 4–6 seguem **este arquivo**.
Fixture com as chaves reais e valores inventados: `tests/fixtures/receita-cnpj.json`.

## 1. BrasilAPI — consulta de CNPJ

`GET https://brasilapi.com.br/api/cnpj/v1/{14 dígitos, só números}` (sem chave, sem login).
Testado ao vivo com 00000000000191 e mais 4 CNPJs públicos.

### Campos que o projeto vai usar (todos existem, com estes nomes)

| Campo | Tipo | Observação |
|---|---|---|
| `razao_social` | string | caixa alta |
| `nome_fantasia` | string | **vem `""` (vazio) quando não tem**, nunca `null` nos testes |
| `descricao_situacao_cadastral` | string | `"ATIVA"`; vimos também `"BAIXADA"`. Regra: só `"ATIVA"` passa |
| `situacao_cadastral` | number | `2` = ativa (código) |
| `qsa` | array | sócios (ver abaixo) |
| `qsa[].nome_socio` | string | caixa alta |
| `municipio` | string | caixa alta, sem acento (`"BRASILIA"`, `"SAO PAULO"`) |
| `uf` | string | `"DF"`, `"SP"`… |
| `codigo_municipio_ibge` | number | **número**, 7 dígitos (ex. 5300108). Não é string |
| `logradouro` | string | **sem** o tipo: o tipo vem em `descricao_tipo_de_logradouro` ("RUA", "QUADRA") |
| `data_inicio_atividade` | string | `"AAAA-MM-DD"` |

Outros campos úteis: `cnpj` (string, 14 dígitos), `numero`, `bairro`, `cep` (string sem hífen), `complemento`, `porte`, `natureza_juridica`, `cnae_fiscal` (number), `cnae_fiscal_descricao`, `opcao_pelo_mei` (boolean), `data_situacao_cadastral`, `descricao_motivo_situacao_cadastral`.
Atenção: `codigo_municipio` (número, ex. 9701) é o código da **Receita**, diferente de `codigo_municipio_ibge`. Usar o `_ibge`.
`regime_tributario` é uma lista (não objeto). `capital_social` é number.

### Sócios (`qsa`)

- Chaves de cada item: `nome_socio`, `cnpj_cpf_do_socio` (mascarado, ex. `***550179**`), `qualificacao_socio`, `codigo_qualificacao_socio`, `data_entrada_sociedade`, `identificador_de_socio`, `faixa_etaria`, `codigo_faixa_etaria`, `pais`, `codigo_pais`, `cpf_representante_legal`, `nome_representante_legal`, `qualificacao_representante_legal`, `codigo_qualificacao_representante_legal`.
- **Sem sócios = lista vazia `[]`** (confirmado com um CNPJ baixado). Não é `null` e a chave não some. Mesmo assim, o código deve tratar `qsa` ausente/`null` como `[]` por segurança.
- O CPF vem mascarado: não dá para comparar CPF, só **nome**. Comparar nomes sem acento e sem caixa.

### Valores vazios / nulos

- `nome_fantasia`, `complemento`, `ddd_telefone_2`, `situacao_especial` vêm `""`.
- `email`, `pais`, `codigo_pais`, `data_situacao_especial` vêm `null`.
- `codigo_municipio_ibge`: veio preenchido em todos os 5 CNPJs testados. **NÃO CONFIRMADO** como ele vem quando faltar (provável `null`/`0`). Padrão seguro: se não for número maior que 0, tratar como "sem código" e não bloquear só por isso.

### Erros

| Situação | HTTP | Corpo |
|---|---|---|
| CNPJ com dígito verificador errado ou tamanho errado | 400 | `{"message":"CNPJ 123 inválido.","type":"bad_request","name":"BadRequestError"}` |
| CNPJ válido que não existe | 404 | `{"message":"CNPJ 99.988.877/0001-08 não encontrado.","type":"not_found","name":"NotFoundError"}` |

Limite de uso e erro 429/5xx: **NÃO CONFIRMADO** (não forçamos). Padrão seguro: timeout curto (ex. 10 s), e qualquer falha de rede/5xx/429 vira "não deu para consultar agora" (tentar de novo depois), nunca "reprovado".

## 2. OpenRouter — PDF e ZDR

Fonte: documentação oficial (`/docs/guides/overview/multimodal/pdfs` e `/docs/guides/features/zdr`), lidas em 12/11/2026.

- PDF vai no chat completions como `{"type":"file","file":{"filename":"x.pdf","file_data":"data:application/pdf;base64,..."}}`.
- Motores (`plugins: [{id:"file-parser", pdf:{engine}}]`): `mistral-ocr` (a Mistral processa o arquivo, US$ 2 por 1.000 páginas), `cloudflare-ai` (Cloudflare Workers AI converte, grátis), `native` (vai direto ao modelo, cobra tokens). **Sem motor definido, o OpenRouter usa o nativo se o modelo suportar, senão `mistral-ocr`.**
- **Cada motor externo é outro processador de dados** (Mistral ou Cloudflare). Risco de LGPD.
- A página do ZDR diz que a trava `zdr: true` vale **só para a escolha do provedor de inferência**, e que **plugins e ferramentas "podem ser operados por terceiros com política de retenção própria"**. Ou seja, `zdr: true` **não garante** nada sobre o motor de PDF.
- A página de PDF não menciona ZDR. **Não está confirmado** que o PDF nativo respeite ZDR.

### Decisão

**Extrair o texto do PDF no nosso servidor com `unpdf` e mandar só texto à IA.** Nenhum PDF/arquivo vai ao OpenRouter, então nenhum motor de PDF de terceiros entra. A documentação não mostrou que o nativo respeita ZDR, então a decisão padrão se mantém.

Configuração da chamada (igual a `src/lib/moderacao-ia.ts`): `provider: { data_collection: "deny", zdr: true, allow_fallbacks: false, require_parameters: true }`, modelo `openai/gpt-4.1-mini`, só mensagens de texto.
Efeito colateral: PDF **escaneado (só imagem)** devolve texto vazio. Regra: texto vazio ou muito curto (menos de 40 caracteres úteis) devolve `pdf_sem_texto` **sem chamar a IA**, e a loja é pedida a enviar um arquivo NOVO (`pedir_novo` / `arquivo_ilegivel`). Não vai para a equipe e não é reprovação.
Se `zdr: true` não achar provedor para o modelo, a chamada falha (`allow_fallbacks:false`): tratar como falha temporária. Não testamos chamada real (sem chave neste ambiente).

## 3. `unpdf` — extração de texto

- Instalado: `unpdf@1.9.1` (entrou em `package.json` e `package-lock.json`).
- Roda no Node 22.23.2 deste ambiente **sem `canvas`** (nada de `canvas`/binário nativo em `node_modules`).
- Prova: um PDF mínimo escrito à mão numa string (sem dependência de PDF) com a linha "Contrato Social OLAKI Teste LTDA". Resultado impresso: `{"totalPages":1,"text":"Contrato Social OLAKI Teste LTDA"}`.
- Uso que funcionou:
  ```js
  import { extractText, getDocumentProxy } from "unpdf";
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(doc, { mergePages: true });
  ```
- **Atenção:** `unpdf` declara `engines.node >= 22`, mas o `package.json` do projeto diz `>=20.9.0`. O `engines.node` do projeto foi subido para `>=22` (Task 5). **Conferir que o projeto na Vercel está em Node 22 antes de publicar.**

## 4. Linha de base de testes (antes de qualquer código)

- `npm ci`: ok (611 pacotes).
- `npm run typecheck`: passa, sem erros.
- `npm test`: 482 testes, 472 passam, **10 falham** (todos da página inicial, "início ...", numerados 168–177 nesta execução; a numeração do brief era 156–165, mudou porque entraram testes novos na main). São as falhas antigas esperadas; nada além delas falhou.
