// Componentes e CSS reais, somente dados sintéticos e servidor local.
const fs = require('node:fs/promises');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { carregar } = require('../carregar.cjs');
async function main() {
  const out = process.argv[2];
  await fs.mkdir(out,{recursive:true});
  const css = await require('postcss')([require('@tailwindcss/postcss')()]).process(await fs.readFile('src/app/globals.css','utf8'),{from:path.resolve('src/app/globals.css')});
  await fs.writeFile(path.join(out,'style.css'),css.css);
  const { RevisaoRetencao } = carregar('src/app/admin/compliance/retencoes.tsx',{'./retencoes-actions':{registrarRetencao:async()=>null}});
  const item = {tipo:'anuncio',id:'26000000-0000-4000-b000-000000000001',titulo:'Prova sintética com título longo para conferir a quebra no celular',estado_comercial:'excluido',estado:'revisao_manual_pendente',motivo:'Ofício sintético encerrado. Destino depende de decisão manual.',autor:'user_sintetico26',criado_em:'2026-11-25T12:00:00Z',ultima_revisao:null};
  const body = renderToStaticMarkup(React.createElement(RevisaoRetencao,{item,consulta:item.id}));
  await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><title>Revisão sintética</title><body><main class="p-4"><h1 class="mb-4 text-titulo font-semibold">Revisão manual</h1>${body}</main></body></html>`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
