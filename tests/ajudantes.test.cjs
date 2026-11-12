const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Etapa P5b-1: ajudante da loja trabalha nos anúncios pelo seletor de loja.
const propria = { id: '57000000-0000-4000-a000-000000000001', nome: 'Minha Loja', dono: true };
const ajudada = { id: '57000000-0000-4000-a000-000000000002', nome: 'Loja do Zé', dono: false };
const id = '57100000-0000-4000-a000-000000000001';

test('seletor de loja: some com uma loja só e mostra "Trabalhando na loja" com várias', () => {
  const { SeletorLoja } = carregar('src/components/conta/seletor-loja.tsx', { '@/app/(conta)/_loja/actions': { escolherLoja() {} } });
  assert.equal(render(React.createElement(SeletorLoja, { lojas: [propria], atual: propria, voltar: '/anunciar' })), '');
  const html = render(React.createElement(SeletorLoja, { lojas: [propria, ajudada], atual: ajudada, voltar: '/anunciar' }));
  assert.match(html, /Trabalhando na loja/);
  assert.match(html, /Loja do Zé/);
  assert.match(html, /\(você ajuda\)/);
  assert.match(html, /Minha Loja \(sua loja\)/);
  assert.match(html, /name="voltar" value="\/anunciar"/);
});

test('trocar de loja só aceita loja que a pessoa cuida e volta para a tela certa', async () => {
  const gravados = [];
  const { escolherLoja } = carregar('src/app/(conta)/_loja/actions.ts', {
    'next/headers': { cookies: async () => ({ set: (...a) => gravados.push(a) }) },
    'next/navigation': { redirect: (u) => { throw Error('redirect:' + u); } },
    'next/cache': { revalidatePath() {} },
    '@/lib/dados/loja-ativa': { COOKIE_LOJA: 'loja_ativa', lojasQueCuido: async () => [propria, ajudada] },
  });
  const form = (loja, voltar) => { const f = new FormData(); f.set('loja', loja); f.set('voltar', voltar); return f; };
  await assert.rejects(escolherLoja(form(ajudada.id, '/anunciar')), /redirect:\/anunciar$/);
  assert.equal(gravados.length, 1);
  assert.equal(gravados[0][0], 'loja_ativa');
  assert.equal(gravados[0][1], ajudada.id);
  assert.equal(gravados[0][2].httpOnly, true);
  await assert.rejects(escolherLoja(form('57000000-0000-4000-a000-000000000099', 'https://fora.test')), /redirect:\/minha-conta\/anuncios$/);
  assert.equal(gravados.length, 1, 'Loja estranha não vira cookie');
});

test('Meus anúncios do ajudante: sem plano, sem Destacar e com aviso para falar com o dono', async () => {
  const recebidos = [];
  const pagina = carregar('src/app/(conta)/minha-conta/anuncios/page.tsx', {
    'next/navigation': { redirect: (d) => { throw Error(`redirect:${d}`); } },
    '@/lib/dados/conta': { contaDaLoja: async () => ({ perfil: { microrregiao_id: 'r' }, vitrine: { tipo: 'loja', id: ajudada.id }, podePublicar: false, ajudante: true }) },
    '@/lib/dados/anuncios': { anunciosDaLoja: async () => [{ id, status: 'ativo', titulo: 'Mesa', fotos: [], atributos: {}, preco_centavos: 100, visualizacoes: 0, cliques_whatsapp: 0, total_favoritos: 0 }] },
    '@/lib/dados/historico': { ultimasMudancas: async () => new Map() },
    '@/lib/dados/loja-ativa': { lojasQueCuido: async () => [propria, ajudada], lojaEscolhida: async () => ajudada },
    '@/components/conta/seletor-loja': { SeletorLoja: ({ atual }) => `SELETOR:${atual.nome}` },
    '@/lib/dados/destaques': { resultadosDestaques: async () => [{ anuncio_id: id, status: 'ativo', tipo_nome: 'Destaque', visualizacoes: 1 }], fraseResultado: () => '' },
    '@/lib/dados/vitrine-completa': { meusFixados: async () => { throw Error('ajudante não lê fixados'); }, meusRecursosVitrine: async () => { throw Error('ajudante não lê recursos'); }, planosPublicos: async () => [] },
    '@/lib/dados/categorias-ia': { minhasSugestoesCategoria: async () => { throw Error('ajudante não lê sugestões'); } },
    '@/components/conta/resumo-plano': { resumoPlano: () => ({ uso: 'USO DO PLANO' }) },
    '@/components/conta/acoes-anuncio': { AcoesAnuncio: (p) => { recebidos.push(p); return null; } },
    '@/components/conta/filtro-meus-anuncios': { FiltroMeusAnuncios: () => null },
    '@/components/conta/foto-meu-anuncio': { FotoMeuAnuncio: () => null },
    '@/components/vitrine/botao-fixar': { BotaoFixar: () => null },
  }).default({ searchParams: Promise.resolve({}) });
  const html = render(await pagina);
  assert.match(html, /SELETOR:Loja do Zé/);
  assert.match(html, /fale com o dono da loja/);
  assert.doesNotMatch(html, /USO DO PLANO/);
  assert.doesNotMatch(html, /Ver planos/);
  assert.doesNotMatch(html, /seu destaque/);
  assert.equal(recebidos[0].podeDestacar, false);
});

test('Minhas lojas: ajudante ganha o botão "Cuidar dos anúncios"', async () => {
  const { default: Pagina } = carregar('src/app/(conta)/minha-conta/lojas/page.tsx', {
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => ({ data: [propria, ajudada], error: null }) }) },
    '@/app/(conta)/_loja/actions': { escolherLoja() {} },
  });
  const html = render(await Pagina());
  assert.equal((html.match(/Cuidar dos anúncios/g) || []).length, 1);
  assert.match(html, new RegExp(`name="loja" value="${ajudada.id}"`));
});

test('histórico vazio de anúncio publicado não fala em "depois de publicar"', async () => {
  const pagina = (status) => carregar('src/app/(conta)/minha-conta/anuncios/[id]/historico/page.tsx', {
    'next/navigation': { notFound: () => { throw Error('404'); }, redirect: () => { throw Error('redirect'); } },
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_a' }) },
    '@/lib/dados/anuncios': { anuncioDaLoja: async () => ({ id, status, titulo: 'Mesa' }) },
    '@/lib/dados/historico': { lerHistorico: async () => [] },
  }).default({ params: Promise.resolve({ id }) });
  assert.match(render(await pagina('ativo')), /As próximas mudanças neste anúncio aparecem aqui/);
  assert.match(render(await pagina('rascunho')), /depois que o anúncio for publicado/);
});

test('apagar foto: ajudante apaga só na pasta do dono da loja escolhida', async () => {
  const url = (dono) => `https://abc.supabase.co/storage/v1/object/public/anuncios/${dono}/${id}/1.webp`;
  const rodar = async (dono, loja) => {
    let removidas = 0;
    const q = { select() { return q; }, contains() { return q; }, or() { return q; }, eq() { return q; }, async limit() { return { data: [] }; }, async maybeSingle() { return { data: { id, vitrines_lojas: { dono_id: 'user_dono' } } }; } };
    const { apagarFoto } = carregar('src/lib/dados/fotos.ts', {
      '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_ajudante' }) },
      '@/lib/dados/loja-ativa': { lojaEscolhida: async () => loja },
      '@/lib/supabase/server': { createClient: async () => ({ from: () => q, storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: url(dono) } }), remove: async () => { removidas++; return { error: null }; } }) } }) },
    });
    const r = await apagarFoto(url(dono));
    return { ok: r.ok, removidas };
  };
  assert.deepEqual(await rodar('user_dono', ajudada), { ok: true, removidas: 1 });
  assert.deepEqual(await rodar('user_outro', ajudada), { ok: false, removidas: 0 });
  assert.deepEqual(await rodar('user_dono', propria), { ok: false, removidas: 0 });
});
