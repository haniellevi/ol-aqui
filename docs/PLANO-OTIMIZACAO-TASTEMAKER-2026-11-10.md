# Mercado da Região · Plano de otimização (skill tastemaker) · 10/11/2026

Plano feito olhando o site publicado (mercadodaregiao.com.br) e o código. Nada foi alterado no site nem no código. Este arquivo é o único item novo.

## Como foi feito e o que não foi conferido

- Site publicado: página inicial vista no computador (1280 px) e mais 9 páginas lidas pelo HTML (busca, lojas, loja Multi, planos, radar, ajuda, categorias, veículos, demo do Radar).
- Código: varreduras automáticas da skill (anti-slop, movimento, coerência de componentes) e leitura da home, dos tokens e do DESIGN-SYSTEM.
- **Não conferido:** tela de celular (a janela do navegador não reduziu), telas com login (anunciar, minha conta, painel) e velocidade medida (Lighthouse).
- **Atenção:** as varreduras rodaram na pasta local, que está atrasada (ver item A1). Os números de código abaixo precisam ser repetidos na versão principal antes de virar tarefa.
- Não foi feita pesquisa de referências (outros classificados). Entra na Fase 1.

Leitura de design: aplicativo de classificados (tela de dados, não página de venda), público de Corrente e região, celular simples, pouca leitura. Clima "acolhedor". A marca (beringela + laranja, Poppins, logo M com pin) já existe e **fica como está**. Não se gera paleta nova.

---

## A. Problemas graves achados no caminho (antes do visual)

| # | O que é | Prova | Risco |
|---|---|---|---|
| A1 | A pasta local `OLAQUI` está no ramo `codex/visual-compacto-aki`, **66 commits atrás** da versão principal, com **186 arquivos alterados sem salvar no git**. Ainda mostra a marca antiga OLAKI. | `git rev-list` = 0 à frente, 66 atrás; logos locais são `olaki-*`, o site usa `mercado-da-regiao-*` | Trabalhar nessa pasta gera conflito ou perde alteração. Todo trabalho novo deve sair da `main` em pasta separada. |
| A2 | O login do site publicado usa **chave de teste** do Clerk (`pk_test`, endereço `clerk.accounts.dev`). | HTML da página inicial | Ambiente de teste do Clerk não é feito para clientes reais (tem limites e aviso de desenvolvimento). Trocar para o ambiente de produção antes do piloto. |
| A3 | `robots.txt` e `sitemap.xml` **não existem** (erro 404). Não há dados estruturados na home. | Resposta 404 nas duas URLs; também não existem no código | O Google demora mais para achar anúncios e lojas. |
| A4 | A página inicial não usa cache (`no-store`): é montada do zero a cada visita. Carrega 71 scripts. | Cabeçalho da resposta | Mais lento em celular simples e internet fraca, que é o público. Precisa medir antes de mexer. |

## B. Auditoria visual (lista anti-slop da skill)

Graves

1. **A home parece vazia** (regras 1, 40 e 41). Hoje há 0 anúncios e 1 loja sem anúncio. A página mostra três blocos vazios seguidos: uma loja só ("Multi", letra M num círculo), "Seu anúncio pode ser o primeiro" e nada mais. No computador, o conteúdo acaba antes do fim da tela. Quem chega não vê nenhuma foto, nenhum produto, nenhuma prova de que funciona.
2. **Nada mostra, tudo conta** (regra 1). A home não tem nenhuma imagem. O Radar é explicado com um parágrafo, embora já exista uma demonstração animada pronta em `/demo/radar` que não aparece em lugar nenhum da home.

Importantes

3. **Tudo tem o mesmo peso** (regras 6 e hierarquia). O título principal (20 a 28 px) é quase do tamanho dos títulos de seção (16 a 18 px). Não há um ponto de destaque nem uma quebra proposital na grade.
4. **Categorias todas iguais** (regra 42 ok, regra 1 fraca). Dez círculos lavanda idênticos. Funciona, mas não ajuda quem lê pouco a diferenciar rápido. Foto real ou cor por grupo ajudaria (decisão de marca: perguntar antes).
5. **Rodapé fraco para um site de compra e venda.** Só três links. Falta quem é o responsável, contato e cidade. Isso pesa na confiança.
6. **Movimento** (regras 27, 32 e 34). Só existe o toque do botão. Faltam as transições de aplicativo: entrada da lista de anúncios, abertura da folha de filtros, troca de estado. Oito arquivos têm movimento sem a versão "movimento reduzido" (número da pasta local).
7. **Valores soltos fora dos tokens** (regra 48). 23 raios de canto e 27 sombras diferentes escritos à mão, 211 tamanhos de letra soltos (ex.: `text-[13px]`) e 16 cores em hexadecimal nos componentes. Parte vem do kit da demonstração. Número da pasta local.

Menores

8. Duas imagens sem texto alternativo: `avatar-vitrine.tsx` e `banner-loja.tsx`.
9. 28 travessões (—) no painel admin. A maioria parece ser marcador de "campo vazio". Trocar por "Sem dado" ou hífen simples.
10. Página `/radar`: os três passos são só texto numerado. Viram três quadros visuais.
11. A skill ainda não tem memória neste projeto (`.tastemaker/` não existe). Sem ela, cada sessão redecide o visual.

O que já está bom e não se mexe: contraste conferido e documentado, botão laranja com texto beringela, "Patrocinado" sempre escrito, área de toque de 44 px, link "Pular para o conteúdo", telas vazias sempre com uma saída, um ícone só (lucide), logo próprio.

Contagem: 2 graves · 5 importantes · 4 menores (mais 4 problemas de base na seção A).

---

## C. Plano em fases

### Fase 0 · Arrumar a base
1. Decidir o destino dos 186 arquivos soltos da pasta local (salvar num ramo de backup ou descartar). **Decisão do Raniel.**
2. Abrir pasta de trabalho nova a partir da `main`.
3. Repetir as três varreduras da skill na `main` e corrigir os números deste plano.
4. Criar `.tastemaker/style-lock.md` copiando o DESIGN-SYSTEM atual (cores, letras, espaços, "não faça") e a matriz de contraste. Sem mudar nenhuma cor.
5. Criar `robots.txt` e `sitemap.xml` (anúncios, lojas, categorias).
6. Trocar o Clerk para produção. **Precisa do Raniel no painel do Clerk.**

### Fase 1 · Home que convence mesmo vazia
1. Pesquisa rápida de referências (2 ou 3 classificados reais) e registro em `.tastemaker/reference-board.md`.
2. "Modo começo": enquanto houver poucos anúncios, a home troca os blocos vazios por um bloco visual de como funciona (anunciar em 3 passos, com quadros e não parágrafo) e pela demonstração do Radar que já existe.
3. Esconder "Lojas da região" quando houver menos de um mínimo de lojas com anúncio (número definido no painel).
4. Título principal maior e um ponto de destaque na primeira tela.
5. Rodapé com responsável, contato e cidade.
6. Montar 2 variações da primeira tela para o Raniel escolher antes de publicar.

Observação honesta: o desenho ajuda, mas a home só deixa de parecer vazia com anúncios reais. Isso depende do piloto com as lojas, não do código.

### Fase 2 · Páginas de entrada
1. `/radar`: três passos em quadros visuais e a demonstração.
2. `/planos`: comparação visual dos planos em vez de listas "Tem / Não tem".
3. Página da loja sem anúncio: convite claro e capa, em vez de "0 anúncios no ar".
4. Dados estruturados (anúncio, loja) para o Google.

### Fase 3 · Acabamento do sistema
1. Levar raios, sombras e tamanhos de letra soltos para os tokens.
2. Movimento de aplicativo: entrada da lista, folha de filtros, troca de estado, sempre com versão reduzida.
3. Textos alternativos e travessões do painel.
4. Conferir estados (carregando, vazio, erro, desativado, foco) nas telas com login.

### Fase 4 · Medir
1. Lighthouse no celular antes e depois.
2. Avaliar cache das páginas públicas (home, categorias, lojas).
3. Conferir tudo no celular real, de 320 px para cima.

---

## D. Memória da skill

- Registro de decisões: não atualizado (nenhuma decisão tomada ainda).
- Style lock: não criado (é o item 4 da Fase 0).
- Perfil pessoal: nada promovido.
