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
