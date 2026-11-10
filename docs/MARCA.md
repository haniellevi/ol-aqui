# Mercado da Região · Guia da marca · 10/11/2026

O projeto, que nasceu como OLAKI, agora se chama **Mercado da Região**. Decisão do Raniel em 10/11/2026.
Endereço oficial: **mercadodaregiao.com.br** (ainda não ligado; o site segue na prévia até o lançamento).

Este guia é a fonte da marca. As medidas de tela (tamanhos de letra, botões, espaços) ficam no [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

## 1. A ideia

O site grande de classificados engole cidade pequena: o anúncio de Corrente some no meio de uma região enorme.
O Mercado da Região é o contrário. É o mercado onde **a sua cidade aparece**, com as lojas e as pessoas que você conhece.

- **Nome:** diz o que é sem explicação. "Mercado" = compra e venda. "da Região" = perto de você.
- **Frase:** **aqui a sua cidade aparece.**
- **Frases de apoio:** "Compre, venda e peça perto de casa." · "O que a região tem, está aqui." · "Negócio fechado com quem é daqui."
- **Sensação:** achado esperto, perto de casa, gente conhecida.

## 2. O símbolo

Um **M** de Mercado segurando o **pin** da Região. O pin laranja já era da marca antiga e foi mantido de propósito: quem conheceu o OLAKI reconhece.

| Versão | Arquivo | Onde usar |
|---|---|---|
| Logo completo, com a frase | `public/logo/mercado-da-regiao-logo.svg` | Tela de entrar, materiais, capa de rede social |
| Logo completo, fundo escuro | `public/logo/mercado-da-regiao-logo-fundo-escuro.svg` | Sobre beringela ou foto escura |
| Marca (sem a frase) | `public/logo/mercado-da-regiao-marca.svg` | Cabeçalho do site e do painel, tamanhos pequenos |
| Marca, fundo escuro | `public/logo/mercado-da-regiao-marca-fundo-escuro.svg` | Rodapé escuro |
| Marca em uma linha | `public/logo/mercado-da-regiao-linha.svg` | Assinatura de e-mail, rodapé, documento |
| Só o símbolo | `public/logo/mercado-da-regiao-simbolo.svg` | Selo, marca d'água, espaço quadrado |
| Ícone do app | `public/logo/mercado-da-regiao-icone-app.svg`, `public/icone-192.png`, `public/icone-512.png`, `src/app/apple-icon.png` | Tela inicial do celular |
| Ícone do site (favicon) | `src/app/icon.svg` | Aba do navegador |
| Imagem de compartilhar | `src/app/opengraph-image.png` (1200 × 630) | Link colado no WhatsApp e redes |
| Franquia (exemplo) | `docs/marca/mercado-da-regiao-franquia-corrente.svg` | Material da unidade de cada cidade |

Mais variações (ícone laranja, símbolo e linha em fundo escuro) e a prévia geral ficam em `docs/marca/`.
Todos os arquivos saem do gerador `docs/marca/gerar-logos.mjs` (letras viram desenho, então não dependem de fonte instalada).

### Regras do logo

- "Mercado" em **beringela** (branco no fundo escuro) e "da Região" em **laranja**. Sempre nessa ordem, sempre em Poppins Bold.
- Escreve-se **Mercado da Região**, com M e R maiúsculos e "da" minúsculo. Nunca "MERCADO DA REGIÃO" em texto corrido, nunca "Mercado Região", nunca sigla "MR" ou "MdR" para o público.
- Área livre em volta: a largura de uma perna do M.
- Tamanho mínimo: marca com 24 px de altura na tela. Abaixo disso, só o símbolo ou o ícone.
- Não esticar, não inclinar, não trocar as cores, não pôr sombra, não tirar o pin.
- Em foto ou fundo colorido, usar a versão de fundo escuro sobre uma faixa beringela.

### Franquias por cidade

O nome da cidade entra **embaixo do logo**, em Poppins SemiBold, maiúsculas espaçadas, com um fio fino separando: `Mercado da Região` + `CORRENTE`.
No texto corrido: "Mercado da Região de Corrente". A unidade nunca cria logo próprio nem muda cor.

## 3. Cores

As mesmas de antes. Valores e contraste completos no DESIGN-SYSTEM.md, seção 1.

| Cor | Valor | Papel na marca |
|---|---|---|
| Beringela | `#4B1248` | "Mercado", o M, textos de título, fundo do ícone |
| Laranja | `#FF6A13` | "da Região", o pin, botão principal |
| Branco | `#FFFFFF` | M e "Mercado" no fundo escuro |
| Fundo | `#F7F8FA` | Fundo das telas |

- Botão principal: **laranja com texto beringela** (branco no laranja reprova no contraste).
- Nunca usar roxo violeta vivo: lembra o concorrente.

## 4. Letras

**Poppins** em tudo (logo, site, materiais). Bold no logo e em títulos fortes, SemiBold em títulos de tela e botões, Regular no texto.

## 5. Tom de voz

Fala como um vizinho que entende de negócio: direto, simples, bem-humorado, do interior com orgulho.

| Fazemos | Não fazemos |
|---|---|
| "Achou? Chama no WhatsApp." | "Entre em contato com o anunciante através do canal disponibilizado." |
| "Aqui a sua cidade aparece." | Citar o nome do concorrente em peça oficial |
| "Anuncie em 2 minutos." | Prometer venda garantida |
| Frases curtas, palavras do dia a dia | Termos em inglês e jargão ("lead", "match", "checkout") |
| Tratar por "você" | "Prezado usuário" |

- A provocação ao site grande é sempre pela ideia ("lá sua cidade some, aqui ela aparece"), nunca pelo nome dele.
- No site, o nome completo aparece uma vez por tela no máximo. Depois, "aqui", "o site" ou "a gente".
- Nas mensagens automáticas: "Mercado da Região" por extenso, para a pessoa saber quem está falando.

## 6. O robô Aki

O ajudante continua se chamando **Aki** e continua sendo o balão laranja com dois olhinhos. Ele é o mascote, não o logo.
Apresentação: "Oi! Eu sou o Aki, o ajudante do Mercado da Região."

## 7. O que continua com o nome antigo (de propósito)

Nomes internos que ninguém de fora vê não foram trocados, para não quebrar nada: o repositório `ol-aqui`, o projeto na Vercel, o banco no Supabase,
colunas como `vendido_pelo_olaki`, a flag `olaki.sistema`, os jobs `olaki-*` do cron, classes de estilo `olaki-*` e o endereço de prévia `ol-aqui.vercel.app`.
Os logos antigos seguem em `docs/logo-opcoes/` como histórico.

## 8. Pendências da marca

- Ligar o domínio mercadodaregiao.com.br (só no lançamento, decisão do Raniel).
- Registro da marca no INPI: adiado pelo Raniel.
- Contas de rede social com o nome novo.
