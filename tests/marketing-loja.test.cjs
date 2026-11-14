const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');
const LOJA = '71000000-0000-4000-a000-000000000001';
const PRODUTO = '71000000-0000-4000-a000-000000000002';
const CATEGORIA = '71000000-0000-4000-a000-000000000003';
const loja = { id: LOJA, tipo: 'loja', status: 'ativa', nome: 'Loja do Centro', slug: 'loja-centro', microrregiao_id: 'regiao' };
const vazio = { dias: 30, nicho_definido: true, regiao_nome: 'Corrente', total_buscas: 0, criativos: [], oportunidades: [] };
const sugestao = { termo: 'Ventilador', categoria_id: CATEGORIA, categoria_slug: 'eletro', categoria_nome: 'Eletrodomésticos', buscas: 3, pedidos: 1, sem_resultado: 2 };
const produto = { id: PRODUTO, titulo: 'Liquidificador', foto: 'https://abc.supabase.co/storage/v1/object/public/anuncios/foto.webp', preco_centavos: 9900, preco_antes_centavos: null, visualizacoes: 20, cliques: 3, favoritos: 2, motivos: ['Recebeu contatos pelo WhatsApp'] };

test('marketing lê só a loja solicitada, valida resposta e distingue erro de vazio', async () => {
  const chamadas = [];
  let resposta = { data: vazio, error: null };
  const { meuMarketingLoja } = carregar('src/lib/dados/marketing-loja.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (...args) => { chamadas.push(args); return resposta; } }) },
  });
  assert.equal(await meuMarketingLoja('invalido'), null);
  assert.equal(chamadas.length, 0);
  assert.deepEqual(await meuMarketingLoja(LOJA), vazio);
  assert.deepEqual(chamadas[0], ['meu_marketing_loja', { p_vitrine: LOJA }]);
  resposta = { data: { ...vazio, criativos: [produto], oportunidades: [sugestao] }, error: null };
  assert.equal((await meuMarketingLoja(LOJA)).criativos[0].id, PRODUTO);
  resposta = { data: { ...vazio, total_buscas: -1 }, error: null };
  assert.equal(await meuMarketingLoja(LOJA), null);
  resposta = { data: { ...vazio, criativos: [{ ...produto, foto: 'javascript:alert(1)' }] }, error: null };
  assert.equal(await meuMarketingLoja(LOJA), null);
  resposta = { data: vazio, error: { message: 'sem acesso' } };
  assert.equal(await meuMarketingLoja(LOJA), null);
});

async function tela(op = {}) {
  let leituras = 0;
  const { default: Page } = carregar('src/app/(conta)/minha-conta/loja/marketing/page.tsx', {
    '@/lib/dados/vitrine-completa': { minhaVitrineCompleta: async () => op.loja === undefined ? loja : op.loja, vitrineNovaAtiva: async () => true },
    '@/lib/dados/marketing-loja': { meuMarketingLoja: async id => { assert.equal(id, LOJA); leituras++; return op.dados === undefined ? vazio : op.dados; } },
    '@/lib/dados/painel-loja': { minhasDicasLoja: async () => [] },
    '@/lib/dados/categorias-ia': { minhaSugestaoNicho: async () => ({ nicho_id: null }), nichosDisponiveis: async () => [{ id: CATEGORIA, nome: 'Casa' }] },
    '@/components/conta/revisar-categorias': { EscolherNicho: () => require('react').createElement('span', null, 'Escolher nicho') },
    '@/components/anunciar/botao-novo-rascunho': { BotaoNovoRascunho: ({ sugestao }) => require('react').createElement('button', { 'data-loja': sugestao?.vitrineId }, 'Cadastrar ' + sugestao?.titulo) },
    '@/components/marketing/copiar-legenda': { CopiarLegenda: () => null },
  });
  return { html: render(await Page()), leituras };
}
test('marketing mostra estados próprios para loja ausente, inativa, base vazia e falha', async () => {
  assert.equal((await tela({ loja: null })).leituras, 0);
  assert.equal((await tela({ loja: { ...loja, status: 'suspensa' } })).leituras, 0);
  assert.match((await tela({ dados: null })).html, /Não conseguimos carregar/);
  const { html } = await tela();
  assert.match(html, /Meu Marketing/);
  assert.match(html, /Publique um anúncio com foto/);
  assert.match(html, /Ainda não há/);
});
test('marketing mostra razões, downloads e contagens de buscas sem apresentá-las como pessoas', async () => {
  const { html } = await tela({ dados: { ...vazio, total_buscas: 3, criativos: [produto], oportunidades: [sugestao] } });
  assert.match(html, /Recebeu contatos pelo WhatsApp/);
  assert.match(html, /formato=feed/);
  assert.match(html, /formato=stories/);
  assert.match(html, /3 buscas/);
  assert.match(html, /1 pedido/);
  assert.match(html, /Cadastrar Ventilador/);
  assert.match(html, new RegExp('data-loja="' + LOJA));
  assert.doesNotMatch(html, /3 pessoas/);
});
test('marketing permite definir nicho sem depender da vitrine piloto e orienta ajudante', async () => {
  assert.match((await tela({ dados: { ...vazio, nicho_definido: false } })).html, /Escolher nicho/);
  assert.match((await tela({ loja: { ...loja, ajudante: true }, dados: { ...vazio, nicho_definido: false } })).html, /dono/);
});
