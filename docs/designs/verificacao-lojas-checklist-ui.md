# Verificação de lojas — checklist de interface (Tarefa 8)

Feito à mão, lendo as telas vizinhas, antes de escrever o código da página `/minha-conta/loja/verificar`.
Telas estudadas: `minha-conta/verificacao/page.tsx` e `form-verificacao-vendedor.tsx` (verificação da pessoa física),
`minha-conta/loja/page.tsx` (bloco de verificação), `radar/form-pedido.tsx` e `passos-pedido.ts` da branch `claude/radar-v2`
(modelo de uma pergunta por tela), `ui/campo-arquivo.tsx`, `ui/botao.tsx`, `ui/campo.tsx`, `conta/aviso.tsx`, `conta/topo-conta.tsx`.

## Peças que a página reaproveita (nada novo de prateleira)
- Moldura: `PaginaConta` + `TopoConta` (`voltar="/minha-conta/loja"`, `textoVoltar="Minha loja"`), igual às outras telas da conta.
- Cartão de conteúdo: `<section className="space-y-3 rounded-card bg-cartao p-5 shadow-1">` (mesmo da verificação do vendedor).
- Avisos: `Aviso` (`tipo="atencao"` para correção/recusa e para o ajudante, `ok` para loja verificada). `Vazio` + `Botao` quando não há loja.
- Botões: `Botao` (primário laranja com texto beringela; `secundario` para Voltar; `texto` para "Não tenho CNPJ" e "Alterar").
- Campos: `Campo` (rótulo sempre visível, erro embaixo em `role="alert"`, dica) e `CampoArquivo` (botão de verdade, aviso "Escolhido: …").
- Máscara do documento: `mascaraDocumento` e validação `cnpjValido` de `@/lib/cpf-cnpj` (a mesma que a rota usa).
- Link de volta/“porta” do WhatsApp: `Botao href={"/confirmar-celular?destino=" + encodeURIComponent(destino)}`, como na verificação do vendedor.

## Modo fácil (vale para toda tela nova desta feature)
- Texto 18px: token `text-facil`; título de passo `text-3xl` como no Radar (`text-facil-titulo` fica para títulos de página, não usado aqui).
- Botões e campos: `tamanho="grande"` (48px, letra 18px, não encolhe com mouse). `Botao` e `Campo` já ganham a variante (mesmo diff
  da branch `claude/radar-v2`, para o merge ficar limpo); `CampoArquivo` ganha a variante `tamanho="grande"` aqui. O padrão das outras telas não muda.
- Uma pergunta por tela, indicador "Passo N de 4 · Nome" com barrinhas, nenhum ícone sem texto.
- Ao trocar de passo o foco vai para o `h2` (`tabIndex={-1}`); com erro, o foco vai para o campo do erro ou para o `role="alert"`.
- "Pular" só no passo opcional (fachada).

## Tema (só tokens do projeto)
`bg-cartao`, `rounded-card`, `shadow-1`, `text-texto`, `text-texto-suave`, `text-perigo` (erro), `text-verde-escuro` (ok), `text-beringela` (título),
`bg-laranja` / `bg-borda` (barrinhas do passo). Nenhuma cor ou tamanho solto.

## Erros e validação (igual às vizinhas)
- Cliente: confere antes de avançar (`erroDoPasso`); o servidor repete tudo (a rota já valida CNPJ, tamanho e tipo).
- CPF digitado: "Esse número é de CPF. O selo de loja pede CNPJ." (a mesma frase da rota, para a pessoa ver igual nos dois lugares).
- Erro do servidor: a mensagem da rota aparece em `role="alert"`; no 409 (já tem envio) a tela dá `router.refresh()` para mostrar o estado novo.
- Falha de rede: "Não conseguimos confirmar o envio. Atualize a página para consultar a situação antes de tentar novamente." (texto do form do vendedor).
- Sucesso: `router.refresh()` — a página volta como "Conferindo seus dados…".
- Duplo toque: trava em `useRef` (uma requisição só) + espera de 600 ms depois de chegar ao passo 4 (o segundo toque em "Continuar" não envia).

## Estados da página (como as vizinhas: um `section`, cada estado com seu texto)
| `status` | Tela |
|---|---|
| `nao_enviada`, `correcao`, `recusada`, `obsoleta` | Assistente de 4 passos; motivo (se houver) em `Aviso` acima |
| `conferindo` | `role="status"`: "Conferindo seus dados… Isso leva poucos minutos." |
| `equipe` | "Com a equipe. Respondemos em até 1 dia útil." |
| `aprovada` | `Aviso ok`: "Loja verificada." |
Antes disso: sem loja → `Vazio`; ajudante → `Aviso` "Só quem criou a loja pode pedir a verificação."; dono pessoa física →
`redirect(LINK_VERIFICACAO_VENDEDOR)`; WhatsApp não confirmado (só nos estados do assistente) → `Botao` "Confirmar meu celular";
consulta falhou → `role="alert"` "Não foi possível consultar…".

## Página Minha loja
O botão "Verificar minha loja" (`Botao href={LINK_LOJA_VERIFICAR}`, tamanho normal como os outros botões da página) entra dentro do `Aviso`
de `pendente` sem envio em andamento, de `correcao` e de `recusada`. Não aparece em `aprovada` nem com envio `conferindo`/`equipe`.
O motivo vem de `textoMotivoVerificacaoLoja` (substitui o mapa `ORIENTACOES_VERIFICACAO`, que mandava “falar com a equipe” para o que agora se corrige reenviando).

## Painel da equipe (Tarefa 10)

Lido: `admin/lojas/page.tsx` (fila-pf, `PainelRevisaoLoja`), `formularios.tsx`, `actions.ts`, `lib/admin/hoje.ts`, `admin/hoje/page.tsx` e `botoes.tsx`,
`components/admin/ui.tsx`, `ui/badge.tsx`, `ui/botao.tsx`. O painel NÃO é Modo fácil: zero usos de `tamanho="grande"`/`text-facil` em `src/app/admin`. Use o tamanho normal.

Estrutura (copiar a fila-pf):
- [ ] `{!franqueado && (<section id="fila-lojas" aria-labelledby="fila-lojas" className="mb-6 space-y-3">` — lojas/page.tsx:249-250 (o `id` da section é o do `h2`; o link de /admin/hoje usa `#fila-lojas`, como `#fila-pf` em hoje.ts:152). Pôr logo depois da fila-pf (linha 270).
- [ ] Título: `h2` com `text-sm font-semibold uppercase tracking-wide text-texto-suave` — page.tsx:251. Sem `h3`; o nome da loja é `<p>`.
- [ ] Ordem dos estados: erro → vazio → lista — page.tsx:252-254. Erro: `Aviso tipo="erro"` "Não foi possível carregar…" (:252). Vazio: `<p className="text-sm text-texto-suave">` "Nenhum … aguardando …" (:253), não `Vazio`/ícone (`Vazio` só em páginas inteiras, hoje/page.tsx:27).
- [ ] Lista: `<ul className="grid gap-3 md:grid-cols-2">` + `<li key>` + `<Cartao>` — :254-257. Se o cartão ficar largo (veredito + 2 formulários), `grid gap-3` de 1 coluna é aceitável; decidir e dizer.
- [ ] Dentro do cartão: nome `<p className="font-semibold text-beringela">`; cidade/CNPJ/prazo em `<p className="text-sm text-texto-suave">` com " · " — :258-259. Data com `quando()` de `@/lib/admin/formato` (dd/mm/aaaa hh:mm, fuso Fortaleza) — formato.ts:7. Não usar `toLocaleDateString` solto.
- [ ] Links de arquivo: `<a href=… download className={estiloBotaoSec}>` dentro de `<div className="my-2 flex flex-wrap gap-3">` — :260-263. Rótulos "Baixar comprovante" / "Ver fachada" no mesmo tom. Não montar URL na mão: usar constante (como `API_VERIFICACAO_VENDEDOR`, :1).
- [ ] "Atrasada": `<Badge variant="destructive">` (ui/badge.tsx:17-18, usado em page.tsx:345 e hoje/page.tsx:40). Sem classe de cor solta. Ao lado do nome, como `className="ml-2"` (page.tsx:337).
- [ ] Veredito da IA: `<ul>` de `<li>` com texto + ✓/✗ (o painel não tem ícone padrão para isso; usar texto "✓"/"✗" mais a palavra, ex. "✓ CNPJ ativo", nunca só símbolo). Cor: `text-verde-escuro` (ok) e `text-perigo` (falha), tokens de ui/badge.tsx:16,18. Texto `text-sm`. Marcar o símbolo `aria-hidden` e deixar a palavra dizer o resultado.
- [ ] Motivos em português: mapa `Record` com rótulos, como `MOTIVOS_REVISAO` (page.tsx:58-64) e `MOTIVOS_VERIFICACAO_PF` (formularios.tsx:7). Nunca mostrar o código do motivo cru.

Formulários (`formularios.tsx`, `"use client"`):
- [ ] `useActionState(acao, null)` + `Retorno` abaixo dos botões — :12-15, :119, :178. `EstadoForm` = `{ok?, erro?}` de `@/lib/admin/estado`; erro vira `Aviso tipo="erro"` (`role="alert"`), sucesso `Aviso tipo="ok"` (`role="status"`) — ui.tsx:45-50. Reusar `Retorno` (não criar outro).
- [ ] Vários botões, uma ação por botão: padrão `useActionState(acao.bind(null, valor), null)` + `<Botao formAction={…}>` (FormDecidirVerificacaoPf :221-256) OU `name="decisao" value=… ` (FormRevisaoLoja :161-176, com `carregando={pendente && decisao === "x"} textoCarregando="Salvando..."`). Escolher o segundo (uma action, `decisao` no servidor, como `revisarLoja` actions.ts:72-73).
- [ ] Botões: `Botao` de `@/components/ui/botao`, tamanho normal. Aprovar/confirmar = primário (sem `variante`) — :161, :255; correção / "tirar selo" mais leve = `variante="secundario"` — :167; recusar = `variante="perigo"` — :172. `<div className="flex flex-wrap gap-2">` — :159. `disabled={pendente || <condição>}` — :162, :168.
- [ ] "Conferi" para aprovar: `<fieldset>` + `<legend className="font-semibold">Conferências para aprovar</legend>` + `<label className="flex items-start gap-2 text-sm">` + `<input type="checkbox" name=… className="mt-0.5 size-5 shrink-0 accent-laranja-escuro">` — :134-146, :235-245. Aprovar fica `disabled` até marcar (:162); o servidor repete a checagem (`=== "on"`, actions.ts:76-79).
- [ ] Motivo obrigatório: `<label className="text-sm font-medium">Motivo…<select name="motivo" className={estiloCampo}>` com `<option value="">Selecione o motivo</option>` — :152-158. Recusar/correção/tirar_selo ficam `disabled={!motivo}` (:168, :173).
- [ ] Servidor: copiar `decidirVerificacaoPf`/`revisarLoja` (actions.ts:65-98, 129-146): `exigirTela("lojas")`, bloquear papel ≠ administrador/suporte ("Seu papel não pode …"), `ehUuid`, validar motivo contra `Set`, `supabase.rpc`, `traduzirErro(error).mensagem`, `atualizar()` (revalidatePath, :28-31), `{ ok: "Frase curta." }`. Usar `try/catch` com `unstable_rethrow(e)` (:59-62, :94-97) se algo puder lançar. Mensagens de erro em pt-BR, curtas, com o que fazer ("Atualize a página.").
- [ ] Botão aprovar só aparece/valendo no status "equipe"; no status "revisao_amostra" mostrar só "Confirmar" e "Tirar selo" (motivo obrigatório só no segundo). Esconder (não só desabilitar) o que não vale para o status — como `!aprovada &&` em :133, :160.

Avisos ("Visto"):
- [ ] Lista abaixo da fila na mesma `section` (ou `section` irmã com `aria-labelledby` próprio e o mesmo `h2`); cada item `<li>` num `Cartao` ou linha simples com `text-sm`, data com `quando()`. Botão "Visto": mesmo formato do `BotaoFeito` — form com `<input type="hidden">`, `Botao variante="texto" tamanho="pequeno" carregando={pendente}`, erro em `<p role="alert" className="mt-1 text-legenda text-perigo">` — hoje/botoes.tsx:8-22. `pequeno` só aqui e em /admin/hoje; os botões de decisão ficam normais.

/admin/hoje (`lib/admin/hoje.ts`):
- [ ] Novo tipo: somar a `TipoTarefa` (:8) e a `NOME_TIPO` (:24) — rótulo curto de 1-2 palavras ("Lojas", como "Documentos" :27). A tela já renderiza qualquer `Tarefa` igual (hoje/page.tsx:36-62): `Badge` do tipo, `titulo` em `text-lg`, `detalhe` em `text-sm`, `Botao variante="secundario" tamanho="pequeno"` com `acao.href`.
- [ ] Copiar a tarefa de documentos (hoje.ts:150-154): uma tarefa só com o total, `alvo: dia`, `adiavel: false`, `acao: { rotulo: "Conferir lojas", href: "/admin/lojas#fila-lojas" }`; `urgente: true` se houver atrasada (vira `Badge destructive`, hoje/page.tsx:40). Título com singular/plural como :137 (`${n} ${n === 1 ? … : …}`).
- [ ] Falha de fonte: acrescentar o par `["Lojas em verificação", erro]` em `fontes` (:121-126) e a consulta no `Promise.all` (:99-119); o aviso de erro já é montado em hoje/page.tsx:24. Atenção: hoje.ts:125 lê `documentosR.error`, ok.
- [ ] Prazo/atraso: mostrar em texto ("Atrasada") + `Badge destructive`, não só cor; o funil usa `text-perigo` + a palavra "Atrasado" (funil/page.tsx:134) — mesmo princípio. Tempo relativo com as helpers `quandoAcaba`/`hojeLocal` (hoje.ts:73-80), fuso America/Fortaleza.

Decisões a dizer ao entregar: (1) painel não é Modo fácil, por isso tamanho normal; (2) fila de 1 ou 2 colunas; (3) ✓/✗ sem componente existente, só texto+token; (4) texto novo ("Visto", "Atrasada", rótulos de motivo) é cópia nova para revisão.
