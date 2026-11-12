// Ensaio da busca que entende: roda 20 buscas na JEV e imprime uma tabela. Nunca mostra a chave.
// A chave vem só de process.env.TYPESAFE_API_KEY. Uso (a partir da pasta do projeto):
//   node scripts/ensaio-busca-entende.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const require = createRequire(import.meta.url);
const { carregar } = require('../tests/carregar.cjs');
const lib = carregar('src/lib/busca-entendida.ts');
if (!process.env.TYPESAFE_API_KEY) { console.error('Faltou TYPESAFE_API_KEY no ambiente.'); process.exit(1); }

const { categorias } = JSON.parse(readFileSync(resolve(raiz, 'scripts/ensaio-arvore.json'), 'utf8'));
const por = (pai) => categorias.filter((c) => c.pai === pai && c.ativa !== false)
  .map((c) => ({ id: c.slug, slug: c.slug, nome: c.nome, icone: '', filhas: por(c.slug) }));
const arvore = por(null);
const nomes = new Map(categorias.map((c) => [c.slug, c.nome]));

const buscas = ['geladeira usada até 800', 'moto honda 150 barata', 'ração de gato', 'aluguel casa 2 quartos',
  'sofá 3 lugares novo até 1.500', 'celular samsung usado até 600 reais', 'bicicleta aro 26 por no máximo 400',
  'vaga de motorista', 'faço unha em domicílio', 'iphone 11 seminovo', 'casa para alugar até 1 mil', 'fogão 4 bocas',
  'cachorro poodle filhote', 'pedreiro', 'carro uno 2010 até 15 mil', 'notebook dell i5', 'ar condicionado split 12000 btu',
  'barato', 'tv 50 polegadas usada até 1500', 'colchão queen novo'];

const linhas = [];
for (const b of buscas) {
  const t = Date.now();
  const e = await lib.entenderBusca(arvore, b);
  const ms = Date.now() - t;
  const cat = e?.categoriaSlug ?? '-';
  linhas.push({
    busca: b,
    categoria: e ? cat : '(IA não respondeu)',
    condicao: e?.estado ?? '-',
    'preco máx (R$)': e?.precoMaxReais ?? '-',
    sobra: e ? lib.textoRestante(b, { estado: e.estado, numero: e.numero }, e.categoriaSlug ? lib.frasesDaCategoria(nomes.get(cat) ?? cat, cat) : []) || '-' : '-',
    'tempo (ms)': ms,
  });
}
console.table(linhas);
