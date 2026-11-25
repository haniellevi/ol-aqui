// Fixture funcional local: componentes cliente reais, fronteiras de servidor sintéticas.
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');

async function main() {
  const out = process.argv[2];
  if (!out) throw Error('Informe o diretório de saída.');
  await fs.mkdir(out, { recursive: true });
  const entry = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { EncerrarAcesso } from '@/components/conta/encerrar-acesso';
    import { FormInformacoes } from '@/components/vitrine/form-informacoes';
    import { RetirarProposta } from '@/components/radar/retirar-proposta';
    import { JanelaConfirmar } from '@/components/ui/confirmar';
    import { Botao } from '@/components/ui/botao';
    window.provas = [];
    const id = '22200000-0000-4000-a000-000000000001';
    const dados = { endereco:'Rua Sintética',lat:null,lng:null,horarios:null,instagram:null,sobre:null,formas_pagamento:[],faz_entrega:false,entrega_obs:null };
    const salvar = async (_, form) => { window.provas.push({acao:'editar_loja_gerenciada',id,endereco:form.get('endereco')}); return {ok:true}; };
    const detalhe = location.pathname === '/minha-conta/lojas/' + id || location.pathname === '/minha-conta/loja';
    createRoot(document.getElementById('root')).render(<main className="p-4">
      <p>Fixture funcional com dados sintéticos</p>
      <h1 className="text-titulo font-semibold">{detalhe ? 'Loja Sintética' : 'Minhas lojas'}</h1>
      {detalhe ? <>
        <Botao href="/minha-conta/lojas" variante="texto">Minhas lojas</Botao>
        <FormInformacoes dados={dados} formasDoPainel={[]} salvarComoGerente={salvar}/>
        <section><h2 className="text-lg font-semibold">Propostas no Radar</h2><p>Oferta sintética existente</p><RetirarProposta id={id}/></section>
      </> : <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Loja Sintética</h2><p>Você é gerente</p>
        <Botao variante="secundario" onClick={()=>window.provas.push({acao:'cuidar_anuncios',id})}>Cuidar dos anúncios</Botao>
        <EncerrarAcesso id={id} gerenciar/>
      </section>}
      <JanelaConfirmar/>
    </main>);
  `;
  const mocks = {
    'next/link': `import React from 'react'; export default React.forwardRef(({children,...props},ref)=><a ref={ref} {...props}>{children}</a>);`,
    'next/navigation': `export const useRouter=()=>({refresh:()=>window.provas.push({acao:'refresh'})});`,
    '@/app/(conta)/minha-conta/lojas/autosservico-actions': `export const sairDaLoja=async id=>{window.provas.push({acao:'sair_da_loja',id});return {ok:true}}; export const descartarLojaIa=async()=>({ok:true});`,
    '@/app/(conta)/_loja/actions': `export const escolherLoja=async form=>{sessionStorage.setItem('escolha',JSON.stringify({id:form.get('loja'),voltar:form.get('voltar')}));location.href=form.get('voltar')};`,
    '@/app/radar/actions': `export const retirarProposta=async id=>{window.provas.push({acao:'retirar_proposta_radar',id});return {ok:true}};`,
    '@/app/(conta)/minha-conta/loja/vitrine-actions': `export const salvarInformacoes=async()=>({ok:true});`,
  };
  await esbuild.build({ stdin: { contents: entry, loader: 'tsx', resolveDir: process.cwd() }, bundle: true,
    outfile: path.join(out, 'app.js'), jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_SITE_URL': '""' },
    plugins: [{ name: 'fronteiras-sinteticas', setup(build) {
      build.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'mock' } : undefined);
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: process.cwd() }));
      build.onResolve({ filter: /^@\// }, args => {
        const base = path.resolve('src', args.path.slice(2));
        return { path: base + (existsSync(base+'.ts') ? '.ts' : '.tsx') };
      });
    } }],
  });
  const css = await require('postcss')([require('@tailwindcss/postcss')()]).process(await fs.readFile('src/app/globals.css','utf8'), { from:path.resolve('src/app/globals.css') });
  await fs.writeFile(path.join(out,'style.css'),css.css);
  await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Percurso do gerente, fixture funcional</title><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
  if (process.argv.includes('--serve')) {
    const server = http.createServer(async (req,res) => {
      const asset = req.url === '/app.js' ? 'app.js' : req.url === '/style.css' ? 'style.css' : 'index.html';
      res.setHeader('Content-Type',asset.endsWith('.js')?'text/javascript':asset.endsWith('.css')?'text/css':'text/html');
      res.end(await fs.readFile(path.join(out,asset)));
    });
    server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port+'/minha-conta/lojas'));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
