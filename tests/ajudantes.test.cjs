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

test('P5c: Meus anúncios marca o rascunho pronto da loja em montagem', async () => {
  const item = (n, pronto_em) => ({ id: `57100000-0000-4000-a000-00000000000${n}`, status: 'rascunho', titulo: `Produto ${n}`, fotos: [], atributos: {}, preco_centavos: 100, visualizacoes: 0, cliques_whatsapp: 0, total_favoritos: 0, atualizado_em: '2026-11-12T10:00:00Z', pronto_em });
  const pagina = carregar('src/app/(conta)/minha-conta/anuncios/page.tsx', {
    'next/navigation': { redirect: (d) => { throw Error(`redirect:${d}`); } },
    '@/lib/dados/conta': { contaDaLoja: async () => ({ perfil: { microrregiao_id: 'r' }, vitrine: { tipo: 'loja', id: ajudada.id }, podePublicar: false, ajudante: true }) },
    '@/lib/dados/anuncios': { anunciosDaLoja: async () => [item(1, '2026-11-12T10:00:00Z'), item(2, null)] },
    '@/lib/dados/historico': { ultimasMudancas: async () => new Map() },
    '@/lib/dados/loja-ativa': { lojasQueCuido: async () => [propria, ajudada], lojaEscolhida: async () => ajudada },
    '@/components/conta/seletor-loja': { SeletorLoja: () => null },
    '@/lib/dados/destaques': { resultadosDestaques: async () => [], fraseResultado: () => '' },
    '@/lib/dados/vitrine-completa': { meusFixados: async () => [], meusRecursosVitrine: async () => ({}), planosPublicos: async () => [] },
    '@/lib/dados/categorias-ia': { minhasSugestoesCategoria: async () => [] },
    '@/components/conta/resumo-plano': { resumoPlano: () => ({ uso: '' }) },
    '@/components/conta/acoes-anuncio': { AcoesAnuncio: () => null },
    '@/components/conta/filtro-meus-anuncios': { FiltroMeusAnuncios: () => null },
    '@/components/conta/foto-meu-anuncio': { FotoMeuAnuncio: () => null },
    '@/components/vitrine/botao-fixar': { BotaoFixar: () => null },
  }).default({ searchParams: Promise.resolve({ aba: 'rascunhos' }) });
  const html = render(await pagina);
  assert.equal((html.match(/Pronto: vai ao ar quando o dono aceitar/g) || []).length, 1);
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

test('apagar foto: ajudante apaga só na pasta do dono de uma loja que ajuda', async () => {
  const url = (dono) => `https://abc.supabase.co/storage/v1/object/public/anuncios/${dono}/${id}/1.webp`;
  const rodar = async (dono, lojas, equipe = null) => {
    let removidas = 0;
    const q = { select() { return q; }, contains() { return q; }, or() { return q; }, eq() { return q; }, in() { return q; }, async limit() { return { data: [] }; }, async maybeSingle() { return { data: { id, vitrines_lojas: { dono_id: 'user_dono' } } }; } };
    const { apagarFoto } = carregar('src/lib/dados/fotos.ts', {
      '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_ajudante' }) },
      '@/lib/dados/loja-ativa': { lojasQueCuido: async () => lojas },
      '@/lib/dados/edicao-admin': { edicaoAdmin: async () => equipe },
      '@/lib/supabase/server': { createClient: async () => ({ from: () => q, storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: url(dono) } }), remove: async () => { removidas++; return { error: null }; } }) } }) },
    });
    const r = await apagarFoto(url(dono));
    return { ok: r.ok, removidas };
  };
  assert.deepEqual(await rodar('user_dono', [propria, ajudada]), { ok: true, removidas: 1 });
  assert.deepEqual(await rodar('user_outro', [propria, ajudada]), { ok: false, removidas: 0 });
  assert.deepEqual(await rodar('user_dono', [propria]), { ok: false, removidas: 0 });
  // P5b-2a: super admin com a edição aberta apaga na pasta do dono do anúncio.
  assert.deepEqual(await rodar('user_dono', [propria], { motivo: 'Ajuste', expira_em: '2026-11-14T15:00:00Z' }), { ok: true, removidas: 1 });
  assert.deepEqual(await rodar('user_outro', [propria], { motivo: 'Ajuste', expira_em: '2026-11-14T15:00:00Z' }), { ok: false, removidas: 0 });
});

test('apagar foto: ajudante apaga logo e capa antigas só na pasta da loja que ajuda (P5b-2b)', async () => {
  const url = (dono, pasta) => `https://abc.supabase.co/storage/v1/object/public/anuncios/${dono}/${pasta}/logo-1.webp`;
  const rodar = async (dono, pasta, lojas) => {
    let removidas = 0;
    const consulta = (tabela) => {
      const f = {};
      const q = { select() { return q; }, contains() { return q; }, or() { f.or = true; return q; }, eq(c, v) { f[c] = v; return q; }, in(c, v) { f[c] = v; return q; },
        async limit() {
          // Só a busca "loja que ajudo com este dono" acha algo; as buscas de foto em uso voltam vazias.
          const achou = tabela === 'vitrines_lojas' && !f.or && f.dono_id === 'user_dono' && Array.isArray(f.id) && f.id.includes(ajudada.id) && !f.id.includes(propria.id);
          return { data: achou ? [{ id: ajudada.id }] : [], error: null };
        },
        async maybeSingle() { return { data: null }; } };
      return q;
    };
    const { apagarFoto } = carregar('src/lib/dados/fotos.ts', {
      '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_ajudante' }) },
      '@/lib/dados/loja-ativa': { lojasQueCuido: async () => lojas },
      '@/lib/dados/edicao-admin': { edicaoAdmin: async () => null },
      '@/lib/supabase/server': { createClient: async () => ({ from: consulta, storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: url(dono, pasta) } }), remove: async () => { removidas++; return { error: null }; } }) } }) },
    });
    const r = await apagarFoto(url(dono, pasta));
    return { ok: r.ok, removidas };
  };
  assert.deepEqual(await rodar('user_dono', 'loja', [propria, ajudada]), { ok: true, removidas: 1 });
  assert.deepEqual(await rodar('user_dono', 'vitrine', [propria, ajudada]), { ok: true, removidas: 1 });
  assert.deepEqual(await rodar('user_outro', 'loja', [propria, ajudada]), { ok: false, removidas: 0 });
  assert.deepEqual(await rodar('user_dono', 'loja', [propria]), { ok: false, removidas: 0 });
  assert.deepEqual(await rodar('user_dono', 'outra', [propria, ajudada]), { ok: false, removidas: 0 });
});

test('passo do anúncio usa a loja do próprio anúncio (rascunho do Merc com outra loja escolhida)', async () => {
  const pedidas = [];
  const contaDe = (loja, ajudante) => ({ perfil: {}, vitrine: { id: loja, tipo: 'loja', microrregiao_id: 'r' }, podePublicar: true, ...(ajudante ? { ajudante: true } : {}) });
  const { carregarPasso } = carregar('src/app/(conta)/anunciar/_carregar.ts', {
    'next/navigation': { notFound: () => { throw Error('404'); }, redirect: (u) => { throw Error('redirect:' + u); } },
    '@/lib/dados/conta': { contaDaLoja: async (_e, loja) => { pedidas.push(loja); return loja ? contaDe(loja, false) : contaDe(ajudada.id, true); } },
    '@/lib/dados/anuncios': { anuncioDaLoja: async () => ({ id, status: 'rascunho', vitrine_id: propria.id, fotos: [] }) },
  });
  const r = await carregarPasso(Promise.resolve({ rascunho: id }));
  assert.equal(r.conta.vitrine.id, propria.id);
  assert.equal(r.conta.ajudante, undefined);
  assert.deepEqual(pedidas, [undefined, propria.id]);
});

test('passo Fotos: ajudante não vê "Cadastrar com o Merc pela foto"', async () => {
  const pagina = (ajudante) => carregar('src/app/(conta)/anunciar/fotos/page.tsx', {
    '../_carregar': { carregarPasso: async () => ({ anuncio: { id, fotos: [] }, editar: false, conta: { vitrine: { tipo: 'loja', microrregiao_id: 'r' }, ...(ajudante ? { ajudante: true } : {}) } }) },
    '@/lib/dados/config': { lerConfigNumero: async () => 1 },
    '@/components/anunciar/cabecalho-passo': { CabecalhoPasso: () => null },
    '@/components/anunciar/barra-continuar': { CorpoPasso: ({ children }) => React.createElement('div', null, children) },
    '@/components/anunciar/envio-fotos': { EnvioFotos: () => null },
    '@/components/aki/botao-abrir-aki': { BotaoAbrirAki: ({ children }) => React.createElement('button', null, children) },
  }).default({ searchParams: Promise.resolve({}) });
  assert.match(render(await pagina(false)), /Cadastrar com o Merc/);
  assert.doesNotMatch(render(await pagina(true)), /Cadastrar com o Merc/);
});

// Etapa P5b-2a: super admin edita o anúncio de outra pessoa.
const edicao = { motivo: 'Preço errado', expira_em: '2026-11-14T15:30:00Z' };

test('passo do anúncio da equipe traz motivo e prazo; sem edição aberta é 404', async () => {
  const montar = (aberta) => carregar('src/app/(conta)/anunciar/_carregar.ts', {
    'next/navigation': { notFound: () => { throw Error('404'); }, redirect: (u) => { throw Error('redirect:' + u); } },
    '@/lib/dados/conta': { contaDaLoja: async (_e, loja) => loja ? { perfil: {}, vitrine: { id: loja, tipo: 'loja', microrregiao_id: 'r' }, podePublicar: true, ajudante: true, equipe: true } : { perfil: {}, vitrine: { id: propria.id, tipo: 'loja' }, podePublicar: true } },
    '@/lib/dados/anuncios': { anuncioDaLoja: async () => ({ id, status: 'ativo', vitrine_id: '57000000-0000-4000-a000-000000000077', fotos: ['f'] }) },
    '@/lib/dados/edicao-admin': { edicaoAdmin: async () => aberta },
  }).carregarPasso(Promise.resolve({ rascunho: id, editar: '1' }));
  const r = await montar(edicao);
  assert.deepEqual(r.equipe, edicao);
  assert.equal(r.conta.ajudante, true);
  await assert.rejects(montar(null), /404/);
});

test('cabeçalho da equipe avisa que o anúncio é de outra pessoa e sai para o painel', () => {
  const { CabecalhoPasso } = carregar('src/components/anunciar/cabecalho-passo.tsx', {});
  const html = render(React.createElement(CabecalhoPasso, { passo: 'fotos', id, editar: true, titulo: 'Fotos', equipe: edicao }));
  assert.match(html, /Este anúncio é de outra pessoa/);
  assert.match(html, /Motivo: Preço errado/);
  assert.match(html, /Vale até 12:30/);
  assert.match(html, new RegExp(`href="/admin/anuncios/${id}"`));
  const dono = render(React.createElement(CabecalhoPasso, { passo: 'fotos', id, editar: true, titulo: 'Fotos' }));
  assert.doesNotMatch(dono, /outra pessoa/);
  assert.doesNotMatch(dono, /\/admin\//);
});

test('botão Editar anúncio do painel: motivo obrigatório e abre a edição pelo banco', async () => {
  const chamadas = [];
  const { editarComoEquipe } = carregar('src/app/admin/anuncios/[id]/actions.ts', {
    'next/navigation': { notFound: () => { throw Error('404'); }, redirect: (u) => { throw Error('redirect:' + u); } },
    'next/cache': { revalidatePath() {} },
    '@/lib/admin/equipe': { exigirTela: async () => ({ supabase: { rpc: async (n, a) => { chamadas.push([n, a]); return { data: edicao.expira_em, error: null }; } } }) },
  });
  const form = (m) => { const f = new FormData(); f.set('motivo', m); return f; };
  await assert.rejects(editarComoEquipe(id, form(' x ')), /redirect:\/admin\/anuncios\/[^?]+\?erro=/);
  assert.equal(chamadas.length, 0);
  await assert.rejects(editarComoEquipe(id, form('  Preço   errado ')), new RegExp(`redirect:/anunciar/fotos\\?rascunho=${id}&editar=1`));
  assert.deepEqual(chamadas, [['admin_abrir_edicao_anuncio', { p_anuncio: id, p_motivo: 'Preço errado' }]]);
});

test('super admin sem loja própria abre o passo do anúncio com a edição aberta', async () => {
  const montar = (anuncio) => carregar('src/app/(conta)/anunciar/_carregar.ts', {
    'next/navigation': { notFound: () => { throw Error('404'); }, redirect: (u) => { throw Error('redirect:' + u); } },
    '@/lib/dados/conta': { contaDaLoja: async (_e, loja) => loja ? { perfil: {}, vitrine: { id: loja, tipo: 'loja' }, podePublicar: true, ajudante: true, equipe: true } : { perfil: {}, vitrine: null, podePublicar: false } },
    '@/lib/dados/anuncios': { anuncioDaLoja: async () => anuncio },
    '@/lib/dados/edicao-admin': { edicaoAdmin: async () => edicao },
  }).carregarPasso(Promise.resolve({ rascunho: id, editar: '1' }));
  const r = await montar({ id, status: 'em_analise', vitrine_id: ajudada.id, fotos: [] });
  assert.equal(r.conta.vitrine.id, ajudada.id);
  assert.deepEqual(r.equipe, edicao);
  await assert.rejects(montar(null), /redirect:\/quero-vender/);
});

// Etapa P5b-2b: a Minha loja vista pelo ajudante.
test('Minha loja do ajudante: sem verificação, Destacar, exclusão nem IA; nome e WhatsApp só leitura', async () => {
  const props = [];
  const Form = (p) => { props.push(p); return null; };
  const pagina = (ajudante, extra = {}, sp = {}, prontos = 0) => carregar('src/app/(conta)/minha-conta/loja/page.tsx', {
    '@/lib/dados/regiao': { listarCidades: async () => [] },
    '@/lib/dados/vitrine-completa': {
      minhaVitrineCompleta: async () => ({ id: ajudada.id, dono_id: 'user_dono', ajudante, tipo: 'loja', status: 'ativa', slug: 'loja-do-ze', nome: 'Loja do Zé', whatsapp: '5589999990001', cidade: 'Corrente', bairro: null, logo_url: null, microrregiao_id: 'r', banner_tipo: 'modelo', banner_url: null, banner_modelo: 'liso', banner_cor: '#4B1248', ...extra }),
      meusRecursosVitrine: async () => ({ foto_fachada: true, secoes_max: 3, fixados_max: 3, secoes_total: 0, fixados_total: 0, banner_moderado_motivo: null }),
      planosPublicos: async () => [],
      vitrineNovaAtiva: async () => true,
    },
    '@/lib/dados/categorias-ia': { minhasSugestoesCategoria: async () => { if (ajudante) throw Error('ajudante não lê sugestões da IA'); return []; } },
    '@/lib/dados/historico': { lerHistorico: async () => [] },
    '@/lib/dados/destaques': { resultadosDestaques: async () => { if (ajudante) throw Error('ajudante não lê destaques'); return []; } },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (n) => { if (ajudante) throw Error('ajudante não chama ' + n); return { data: n === 'minha_loja_exclusao' ? { na_lixeira: false, tem_pagamentos: false } : [{ estado: 'aprovada', motivo: null }], error: null }; } }) },
    '@/lib/dados/loja-ativa': { lojasQueCuido: async () => [propria, ajudada], lojaEscolhida: async () => ajudada },
    '@/components/conta/seletor-loja': { SeletorLoja: ({ atual, voltar }) => `SELETOR:${atual.nome}:${voltar}` },
    '@/components/conta/form-minha-loja': { FormMinhaLoja: Form },
    '@/components/destaques/destaques-ativos': { DestaquesAtivos: () => null },
    '@/components/vitrine/banner-loja': { BannerLoja: () => null },
    '@/components/conta/excluir-loja': { ExcluirLoja: () => 'EXCLUIR LOJA', LojaNaLixeira: () => null },
    '@/app/receber-loja/form-receber': { FormTerminarRecebimento: ({ loja }) => `TERMINAR:${loja}` },
    '@/lib/dados/montagem': { prontosPendentes: async () => { if (ajudante) throw Error('ajudante não confere prontos'); return prontos; } },
  }).default({ searchParams: Promise.resolve(sp) });
  const arvore = await pagina(true);
  const html = render(arvore);
  // Trocar de loja no seletor recria o formulário (sem levar dados da loja anterior).
  const achar = (no) => {
    if (!no || typeof no !== 'object') return null;
    if (Array.isArray(no)) { for (const x of no) { const r = achar(x); if (r) return r; } return null; }
    return no.type === Form ? no : achar(no.props?.children);
  };
  assert.equal(achar(arvore)?.key, ajudada.id);
  assert.match(html, /SELETOR:Loja do Zé:\/minha-conta\/loja/);
  assert.match(html, /Você ajuda nesta loja/);
  assert.doesNotMatch(html, /Destacar minha loja|EXCLUIR LOJA|Loja verificada|Revise suas categorias/);
  assert.match(html, /Seções próprias/);
  assert.match(html, /Desempenho da loja/);
  assert.equal(props[0].ajudante, true);
  const dono = render(await pagina(false));
  assert.match(dono, /Destacar minha loja/);
  assert.match(dono, /EXCLUIR LOJA/);
  assert.match(dono, /Revise suas categorias/);
  assert.equal(props[1].ajudante, false);

  // P5c: super admin na loja em montagem, dono com fotos pendentes e dono que acabou de receber.
  const montagem = render(await pagina(true, { status: 'montagem' }));
  assert.match(montagem, /Loja em montagem: só a equipe vê/);
  assert.doesNotMatch(montagem, /Você ajuda nesta loja|pagamento atrasado/);
  const pendente = render(await pagina(false, { pasta_montagem: 'user_montagem' + 'a'.repeat(32) }));
  assert.match(pendente, /Falta terminar de receber a loja/);
  assert.match(pendente, new RegExp(`TERMINAR:${ajudada.id}`));
  const soProntos = render(await pagina(false, {}, {}, 2));
  assert.match(soProntos, /os produtos prontos ainda não foram publicados/);
  assert.match(soProntos, new RegExp(`TERMINAR:${ajudada.id}`));
  assert.doesNotMatch(render(await pagina(false)), /Falta terminar/);
  const recebida = render(await pagina(false, {}, { recebida: '3-1-0' }));
  assert.match(recebida, /Loja recebida\. Ela é sua e já está no ar\. 3 produtos foram ao ar, 1 está em análise\./);
  assert.doesNotMatch(render(await pagina(false, {}, { recebida: 'x' })), /Loja recebida/);
  assert.doesNotMatch(render(await pagina(true, {}, { recebida: '1-0-0' })), /Loja recebida/, 'Ajudante não vê o aviso do dono');
});
