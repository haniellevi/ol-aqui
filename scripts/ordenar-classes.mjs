// Ordena as classes Tailwind de className="..." na ordem oficial do Tailwind
// (layout > posição > tamanho > espaçamento > tipografia > cores > estados),
// a mesma do prettier-plugin-tailwindcss. Não muda nada na tela: só a leitura.
// Uso: npm run classes:ordenar            (arruma)
//      npm run classes:conferir           (só avisa)
//      node scripts/ordenar-classes.mjs [--check] [arquivos...]
// Sem arquivos, pega todo src/**/*.tsx menos as peças copiadas do shadcn
// (as que têm data-slot), para não fugir do original delas.
// Classes que o Tailwind não conhece (ex.: olaki-acao) vão na frente, na ordem em que estavam.
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const root = process.cwd();
const req = createRequire(path.join(root,'package.json'));
const { __unstable__loadDesignSystem } = await import(req.resolve('@tailwindcss/node'));
const cssPath = path.join(root,'src/app/globals.css');
const ds = await __unstable__loadDesignSystem(fs.readFileSync(cssPath,'utf8'), { base: path.dirname(cssPath) });
const check = process.argv.includes('--check');
let files = process.argv.slice(2).filter(a=>!a.startsWith('--'));
if (!files.length) files = execSync("git ls-files 'src/*.tsx'",{encoding:'utf8'}).split('\n').filter(Boolean)
  .filter(f=>!fs.readFileSync(f,'utf8').includes('data-slot'));
function sortList(s){
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
  const toks = s.trim().split(/\s+/); if (toks.length<2) return s;
  const order = ds.getClassOrder(toks);
  const known = [], unknown = [];
  order.forEach(([c,o],i)=> (o===null?unknown:known).push([c,o,i]));
  known.sort((a,b)=> a[1]<b[1]?-1:a[1]>b[1]?1:a[2]-b[2]);
  return lead + [...unknown,...known].map(x=>x[0]).join(' ') + trail;
}
let changed=0;
for (const f of files){
  const src = fs.readFileSync(f,'utf8');
  const out = src.replace(/className=(\{?)"([^"\n{}$]*)"/g,(m,b,cls)=> `className=${b}"${sortList(cls)}"`);
  if (out!==src){ changed++; if(check) console.log('fora de ordem:',f); else fs.writeFileSync(f,out); }
}
console.log(`${changed} arquivo(s) ${check?'fora de ordem':'reordenados'}`);
if (check && changed) process.exit(1);
