const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Etapa P6: "Descartar rascunho" no fim de cada passo do Anunciar e "Excluir anúncio" no fim da edição.
const id = '60000000-0000-4000-a000-000000000001';
const acoes = {
  '@/app/(conta)/minha-conta/anuncios/actions': { moverParaLixeira: async () => ({ ok: true, dados: 'excluido' }) },
  'next/navigation': { useRouter: () => ({ replace() {} }) },
};
const { DescartarAnuncio } = carregar('src/components/anunciar/descartar-anuncio.tsx', acoes);
const desenhar = (props) => render(React.createElement(DescartarAnuncio, { id, ...props }));

test('rascunho: botão vermelho "Descartar rascunho" e diálogo que avisa da lixeira', () => {
  const html = desenhar({ titulo: 'Panela de pressão', rascunho: true });
  assert.match(html, /class="[^"]*text-perigo[^"]*"[^>]*>.*Descartar rascunho/);
  assert.match(html, /<dialog[^>]*role="alertdialog"[^>]*aria-labelledby="descartar-60000000-0000-4000-a000-000000000001"/);
  assert.match(html, /Descartar este rascunho\?/);
  assert.match(html, /Panela de pressão/);
  assert.match(html, /As fotos ficam guardadas por 30 dias e você pode restaurá-lo na aba Lixeira\./);
  assert.match(html, />Cancelar</);
  assert.doesNotMatch(html, /não cancela pagamentos/);
});

test('rascunho sem título mostra "Rascunho sem título"', () => {
  assert.match(desenhar({ titulo: '  ', rascunho: true }), /Rascunho sem título/);
});

test('publicado: "Excluir anúncio" com o mesmo texto do menu Mais e o aviso de pagamento', () => {
  const html = desenhar({ titulo: 'Bicicleta aro 29', rascunho: false, temPagamento: true });
  assert.match(html, /Excluir anúncio/);
  assert.doesNotMatch(html, /Descartar/);
  assert.match(html, /Mover para a lixeira\?/);
  assert.match(html, /O anúncio ficará oculto\. As fotos e o histórico serão guardados/);
  assert.match(html, /Esta ação não cancela pagamentos/);
});

// Os passos: o botão aparece no rascunho, some na edição de publicado (menos no Revisar) e no modo equipe.
const corpo = { CorpoPasso: ({ children }) => React.createElement('main', null, children) };
const marcador = { DescartarAnuncio: (p) => React.createElement('i', { 'data-descartar': p.rascunho ? 'rascunho' : 'excluir', 'data-pagamento': String(Boolean(p.temPagamento)) }) };
const base = (anuncio, equipe = null, editar = false) => ({
  '../_carregar': { carregarPasso: async () => ({ anuncio: { id, titulo: 'Teste', fotos: [], ...anuncio }, editar, equipe, conta: { perfil: { cidade: null, bairro: null }, vitrine: { tipo: 'loja', microrregiao_id: 'r', status: 'ativa', cidade: 'Corrente' }, podePublicar: true } }) },
  '@/components/anunciar/cabecalho-passo': { CabecalhoPasso: () => null },
  '@/components/anunciar/barra-continuar': corpo,
  '@/components/anunciar/descartar-anuncio': marcador,
});
const passos = {
  fotos: { '@/lib/dados/config': { lerConfigNumero: async () => 1 }, '@/components/anunciar/envio-fotos': { EnvioFotos: () => null },
    '@/components/aki/botao-abrir-aki': { BotaoAbrirAki: () => null } },
  categoria: { '@/lib/dados/categorias': { listarCategorias: async () => [] }, '@/lib/dados/sugestoes-categoria': { minhaSugestaoCategoria: async () => null },
    '@/components/anunciar/escolha-categoria': { EscolhaCategoria: () => null }, '@/components/anunciar/sugestao-pendente': { SugestaoPendente: () => null } },
  preco: { '@/lib/dados/anuncios': { faixaPreco: async () => null }, '@/components/anunciar/form-preco': { FormPreco: () => null } },
  local: { '@/lib/dados/regiao': { listarCidades: async () => [] }, '@/components/anunciar/form-local': { FormLocal: () => null } },
};

async function abrirPasso(passo, anuncio, equipe, editar) {
  const mod = carregar(`src/app/(conta)/anunciar/${passo}/page.tsx`, { ...base(anuncio, equipe, editar), ...passos[passo] });
  return render(await mod.default({ searchParams: Promise.resolve({ rascunho: id }) }));
}

test('passos Fotos, Categoria, Preço e Local: "Descartar rascunho" só no rascunho e nunca para a equipe', async () => {
  for (const passo of Object.keys(passos)) {
    assert.match(await abrirPasso(passo, { status: 'rascunho' }), /data-descartar="rascunho"/, passo);
    assert.doesNotMatch(await abrirPasso(passo, { status: 'ativo' }, null, true), /data-descartar/, `${passo} publicado`);
    assert.doesNotMatch(await abrirPasso(passo, { status: 'rascunho' }, { motivo: 'Preço errado', expira_em: '2026-11-14T15:30:00Z' }), /data-descartar/, `${passo} equipe`);
  }
});

const revisar = {
  '@/lib/dados/anuncios': { anuncioPublico: async () => null },
  '@/lib/dados/categorias': { categoriaDoAnuncio: async () => null, categoriaPorId: async () => null },
  '@/lib/categorias-arvore': { nomeCaminho: () => '' },
  '@/lib/dados/config': { lerConfigNumero: async () => 0 },
  '@/lib/dados/cobranca': { avulsoParaMim: async () => null },
  '@/components/anuncio/card-anuncio': { CardAnuncio: () => null },
  '@/components/anunciar/botao-publicar': { BotaoPublicar: () => null },
};
async function abrirRevisar(anuncio, equipe = null) {
  const mod = carregar('src/app/(conta)/anunciar/revisar/page.tsx', { ...base({ fotos: [], categoria_id: null, publicado_em: null, pago_ate: null, ...anuncio }, equipe, anuncio.status !== 'rascunho'), ...revisar });
  return render(await mod.default({ searchParams: Promise.resolve({ rascunho: id }) }));
}

test('passo Revisar: rascunho descarta; publicado exclui (com aviso de pagamento); equipe não vê', async () => {
  assert.match(await abrirRevisar({ status: 'rascunho' }), /data-descartar="rascunho"/);
  const futuro = new Date(Date.now() + 86400000).toISOString();
  const publicado = await abrirRevisar({ status: 'ativo', publicado_em: '2026-11-01T10:00:00Z', pago_ate: futuro });
  assert.match(publicado, /data-descartar="excluir" data-pagamento="true"/);
  assert.match(await abrirRevisar({ status: 'pausado', publicado_em: '2026-11-01T10:00:00Z' }), /data-descartar="excluir" data-pagamento="false"/);
  assert.doesNotMatch(await abrirRevisar({ status: 'ativo', publicado_em: '2026-11-01T10:00:00Z' }, { motivo: 'Preço errado', expira_em: futuro }), /data-descartar/);
});
