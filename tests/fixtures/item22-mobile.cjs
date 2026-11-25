// Renderiza peças reais com dados sintéticos, sem sessão, credenciais ou rede.
const fs = require('node:fs/promises');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { carregar } = require('../carregar.cjs');
const link = { default: ({ children, ...props }) => React.createElement('a', props, children) };
const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, then: r => r({ data: [], error: null }) };
const baseMocks = { 'next/link': link, 'next/navigation': { useRouter: () => ({}), usePathname: () => '/radar/regiao' } };
async function main() {
  const out = process.argv[2];
  if (!out) throw Error('Informe um diretório local de saída.');
  await fs.mkdir(out, { recursive: true });
  const css = await require('postcss')([require('@tailwindcss/postcss')()]).process(await fs.readFile('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') });
  await fs.writeFile(path.join(out, 'style.css'), css.css);
  const { RadarDeNegocios } = carregar('src/components/radar/radar-de-negocios.tsx', baseMocks);
  const radar = renderToStaticMarkup(React.createElement(RadarDeNegocios, {
    pedidos: [{ id: '22200000-0000-4000-a000-000000000001', titulo: 'Procuro sofá para sala pequena', detalhes: null, cidade: 'Corrente', urgencia: 'normal', precoMaxCentavos: 50000, precoMinCentavos: null, totalPropostas: 0, maxPropostas: 3, modoContato: 'propostas_prazo', propostasAte: '2026-12-05T20:00:00Z', criadoEm: new Date().toISOString(), compradorCertificado: false, compradorNome: null, jaPropus: false, souComprador: false, categoriaNome: 'Móveis' }],
    temAcesso: false, propostasRestantes: null, emTeste: false, planos: [], categorias: [], nicho: 'todas', vende: false, textoBusca: null, pagina: 1,
  }));
  const pages = { radar };
  for (const papel of ['administrador', 'moderador']) {
    const p = carregar('src/app/admin/moderacao/page.tsx', {
      ...baseMocks,
      '@/lib/admin/equipe': { exigirTela: async () => ({ papel, supabase: { from: () => q, rpc: async () => ({ data: [], error: null }) } }) },
      './actions': {}, './botao-decisao': {}, './botao-tirar-banner': {}, './radar-moderacao': { RadarModeracao: () => null },
    }).default;
    pages[papel] = `<main class="p-4">${renderToStaticMarkup(await p({ searchParams: Promise.resolve({}) }))}</main>`;
  }
  const config = carregar('src/app/admin/configuracoes/page.tsx', {
    ...baseMocks, '@/lib/admin/auth': { exigirAdmin: async () => ({ supabase: { from: () => q } }) },
    './formularios': {},
  }).default;
  pages.configuracoes = `<main class="p-4">${renderToStaticMarkup(await config({ searchParams: Promise.resolve({}) }))}</main>`;
  const { RetirarProposta } = carregar('src/components/radar/retirar-proposta.tsx', { ...baseMocks, '@/app/radar/actions': {} });
  pages.retirar = `<main class="p-4"><h1>Oferta sintética no Radar</h1>${renderToStaticMarkup(React.createElement(RetirarProposta, { id: '22200000-0000-4000-a000-000000000001' }))}</main>`;
  for (const [name, html] of Object.entries(pages)) await fs.writeFile(path.join(out, `${name}.html`), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css"><title>Fixture D22 ${name}</title><body>${html}</body></html>`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
