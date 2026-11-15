#!/usr/bin/env node
// Conferidor do design system (docs/design-system/CONFERIDOR.md).
// Acusa, com arquivo e linha, o que foge do DESIGN.md: cor solta, tamanho escrito à mão, letra abaixo de 12px,
// texto branco sobre laranja, laranja como cor de letra, "Carregando…" solto, window.confirm e modo escuro.
//
// Uso:
//   npm run design:conferir                 → falha (código 1) se achar erro novo
//   npm run design:conferir -- --registrar  → regrava a lista de dívidas com a situação atual (só para diminuir)
//
// Dívida: arquivos antigos que já fugiam da regra quando o conferidor nasceu (scripts/conferir-design.divida.json).
// Neles o conferidor só avisa, até o número registrado. Passou do número, ou arquivo novo: erro.
// A lista só pode diminuir: ao arrumar um arquivo, rode com --registrar e faça commit da lista menor.

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = process.cwd();
const PASTA = join(RAIZ, "src");
const ARQUIVO_DIVIDA = join(RAIZ, "scripts", "conferir-design.divida.json");
const REGISTRAR = process.argv.includes("--registrar");

// Pastas e arquivos que nunca são conferidos, cada um com o motivo.
const FORA = [
  ["src/components/demo/", "demonstração animada com CSS próprio"],
];

// Exceções por regra, cada uma com o motivo. Não existe "ignorar esta linha".
const COR_PERMITIDA = [
  ["src/app/globals.css", "é onde os tokens de cor nascem"],
  ["src/app/layout.tsx", "o tema do Clerk e a cor da barra do navegador não leem classes do Tailwind"],
  ["src/app/manifest.ts", "cores do aplicativo instalado no celular"],
  ["opengraph-image", "imagem de compartilhar é desenhada fora do navegador"],
  ["/imagem/route.tsx", "imagem gerada no servidor, sem CSS"],
  ["/criativo/[id]/route.tsx", "imagem gerada no servidor, sem CSS"],
];

const REGRAS = [
  {
    id: "cor-solta",
    texto: "cor escrita à mão; use um token (bg-laranja, text-beringela, bg-primary...)",
    padrao: /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])|\b(?:rgba?|hsla?)\(/g,
    pular: (arq) => COR_PERMITIDA.some(([p]) => arq.includes(p)),
  },
  {
    id: "cor-arbitraria",
    texto: "classe de cor arbitrária; use um token",
    padrao: /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|shadow)-\[(?:#|rgb|hsl|color-mix|oklch)/g,
  },
  {
    id: "paleta-tailwind",
    texto: "cor da paleta padrão do Tailwind; use os tokens da marca",
    padrao: /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration)-(?:gray|slate|zinc|neutral|stone|red|green|blue|purple|orange|yellow|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|pink|rose)-\d{2,3}\b/g,
  },
  {
    id: "tamanho-a-mao",
    texto: "tamanho escrito à mão; use a régua (text-base, min-h-controle, h-toque...)",
    padrao: /\b(?:text|h|min-h|max-h|size)-\[\d+(?:\.\d+)?(?:px|rem)\]/g,
  },
  {
    id: "letra-pequena",
    texto: "letra abaixo de 12px (piso do site)",
    padrao: /font-size:\s*(?:0\.(?:[0-6]\d*|7[0-4]\d*)rem|(?:[0-9]|1[01])(?:\.\d+)?px)/g,
  },
  {
    id: "branco-sobre-laranja",
    texto: "texto branco sobre laranja reprova no contraste (2,87:1); use text-beringela",
    linha: (l) => /\bbg-laranja(?![-\w])/.test(l) && /\btext-white\b/.test(l),
  },
  {
    id: "laranja-letra",
    texto: "laranja #ff6a13 não é cor de letra; use text-laranja-escuro",
    padrao: /\btext-laranja(?![-\w])/g,
  },
  {
    id: "carregando-solto",
    texto: "\"Carregando…\" solto; use Skeleton ou carregando.tsx",
    padrao: />\s*Carregando(?:…|\.\.\.)\s*</g,
    pular: (arq) => arq.endsWith("src/components/ui/carregando.tsx"),
  },
  {
    id: "confirmacao-nativa",
    texto: "window.confirm; use useConfirmar (confirmar.tsx)",
    padrao: /\bwindow\.confirm\(/g,
    pular: (arq) => arq.endsWith("src/components/ui/confirmar.tsx"),
  },
  {
    id: "modo-escuro",
    texto: "classe de modo escuro; o site é só claro",
    padrao: /(?<![\w-])dark:/g,
    pular: (arq) => arq.startsWith("src/components/ui/"),
  },
];

function listar(pasta) {
  const saida = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) saida.push(...listar(caminho));
    else if (/\.(tsx?|css)$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

const achados = [];
for (const caminho of listar(PASTA)) {
  const arq = relative(RAIZ, caminho).split(sep).join("/");
  if (FORA.some(([p]) => arq.startsWith(p))) continue;
  const linhas = readFileSync(caminho, "utf8").split("\n");
  for (const regra of REGRAS) {
    if (regra.pular?.(arq)) continue;
    linhas.forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return; // comentário
      if (regra.linha) {
        if (regra.linha(l)) achados.push({ regra, arq, n: i + 1, trecho: l.trim() });
        return;
      }
      for (const m of l.matchAll(regra.padrao)) achados.push({ regra, arq, n: i + 1, trecho: m[0] });
    });
  }
}

const contagem = {};
for (const a of achados) {
  const chave = `${a.regra.id} ${a.arq}`;
  contagem[chave] = (contagem[chave] ?? 0) + 1;
}

if (REGISTRAR) {
  // A lista só pode diminuir: item novo ou número maior não vira dívida, tem de ser corrigido.
  if (existsSync(ARQUIVO_DIVIDA)) {
    const anterior = JSON.parse(readFileSync(ARQUIVO_DIVIDA, "utf8"));
    const piorou = Object.entries(contagem).filter(([chave, n]) => n > (anterior[chave] ?? 0));
    if (piorou.length) {
      for (const [chave, n] of piorou) console.log(`RECUSADO  ${chave}: ${anterior[chave] ?? 0} → ${n}`);
      console.log("\nA lista de dívidas só pode diminuir. Corrija os itens acima antes de registrar.");
      process.exit(1);
    }
  }
  const ordenado = Object.fromEntries(Object.entries(contagem).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(ARQUIVO_DIVIDA, JSON.stringify(ordenado, null, 2) + "\n");
  console.log(`Lista de dívidas regravada: ${Object.keys(ordenado).length} itens, ${achados.length} ocorrências.`);
  process.exit(0);
}

const divida = existsSync(ARQUIVO_DIVIDA) ? JSON.parse(readFileSync(ARQUIVO_DIVIDA, "utf8")) : {};
let erros = 0;
let avisos = 0;
const jaContado = new Set();
for (const a of achados) {
  const chave = `${a.regra.id} ${a.arq}`;
  const permitido = divida[chave] ?? 0;
  const tipo = contagem[chave] <= permitido ? "aviso" : "ERRO";
  if (tipo === "ERRO") {
    erros++;
    console.log(`ERRO  ${a.arq}:${a.n}  ${a.regra.texto}  →  ${a.trecho.slice(0, 80)}`);
  } else if (!jaContado.has(chave)) {
    jaContado.add(chave);
    avisos += contagem[chave];
  }
}

const diminuiu = Object.entries(divida).filter(([chave, n]) => (contagem[chave] ?? 0) < n);
if (diminuiu.length) {
  console.log(`\nBoa: ${diminuiu.length} dívida(s) diminuíram. Rode "npm run design:conferir -- --registrar" e faça commit da lista menor.`);
}
console.log(`\nConferidor do design system: ${erros} erro(s), ${avisos} aviso(s) de dívida antiga.`);
if (erros) {
  console.log("Regras em DESIGN.md. Exceções e dívidas em scripts/conferir-design.mjs e scripts/conferir-design.divida.json.");
  process.exit(1);
}
