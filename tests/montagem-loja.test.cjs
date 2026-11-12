const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Etapa P5c: o super admin monta a loja escondida e o dono recebe pelo convite.
const loja = '59000000-0000-4000-a000-000000000001';
const token = '59100000-0000-4000-a000-000000000001';
const pasta = 'user_montagem' + 'a'.repeat(32);
const redirecionar = { redirect: (u) => { throw Error('redirect:' + u); }, unstable_rethrow: (e) => { if (String(e?.message).startsWith('redirect:')) throw e; } };

function baldeFalso(erros = {}) {
  const feito = { copias: [], removidos: [] };
  return {
    feito,
    copy: async (de, para) => { feito.copias.push([de, para]); return { error: erros[de] ? { message: erros[de] } : null }; },
    remove: async (lista) => { feito.removidos.push(...lista); return { error: null }; },
  };
}

function montagem({ mudanca, erros, prontos = { publicados: 2, em_analise: 1, rascunhos: 0 }, trocaErro = null }) {
  const chamadas = [];
  const balde = baldeFalso(erros);
  const admin = {
    rpc: (nome, args) => {
      chamadas.push(['admin', nome, args]);
      if (nome === 'fotos_mudanca_loja') return { maybeSingle: async () => ({ data: mudanca, error: null }) };
      return Promise.resolve({ data: true, error: trocaErro });
    },
    storage: { from: (b) => { assert.equal(b, 'anuncios'); return balde; } },
  };
  const usuario = {
    rpc: (nome, args) => { chamadas.push(['usuario', nome, args]); return { maybeSingle: async () => ({ data: prontos, error: null }) }; },
  };
  const mod = carregar('src/lib/dados/montagem.ts', {
    '@/lib/supabase/admin': { supabaseAdmin: () => admin },
    '@/lib/supabase/server': { createClient: async () => usuario },
  });
  return { ...mod, chamadas, balde };
}

test('receber a loja: fotos vão para a pasta do dono, endereços mudam e os prontos são publicados como o dono', async () => {
  const caminhos = [`${pasta}/${loja}/a.webp`, `${pasta}/loja/logo.webp`];
  const m = montagem({ mudanca: { de: pasta, para: 'user_dono1', caminhos }, erros: { [caminhos[1]]: 'The resource already exists' } });
  assert.deepEqual(await m.concluirMudancaLoja(loja), { publicados: 2, em_analise: 1, rascunhos: 0 });
  assert.deepEqual(m.balde.feito.copias, [
    [caminhos[0], `user_dono1/${loja}/a.webp`],
    [caminhos[1], 'user_dono1/loja/logo.webp'],
  ]);
  assert.deepEqual(m.chamadas.map((c) => c[0] + ':' + c[1]), ['admin:fotos_mudanca_loja', 'admin:trocar_pasta_loja', 'usuario:publicar_prontos_loja']);
  assert.deepEqual(m.balde.feito.removidos, caminhos, 'Apaga as fotos antigas depois de trocar os endereços');
});

test('receber a loja: erro ao copiar ou pasta estranha para tudo antes de trocar os endereços', async () => {
  const caminhos = [`${pasta}/${loja}/a.webp`];
  const falha = montagem({ mudanca: { de: pasta, para: 'user_dono1', caminhos }, erros: { [caminhos[0]]: 'Internal error' } });
  assert.equal(await falha.concluirMudancaLoja(loja), null);
  assert.ok(!falha.chamadas.some((c) => c[1] === 'trocar_pasta_loja'));
  assert.equal(falha.balde.feito.removidos.length, 0);

  const estranha = montagem({ mudanca: { de: pasta, para: 'user_dono1', caminhos: ['user_outro/x.webp'] } });
  assert.equal(await estranha.concluirMudancaLoja(loja), null);
  assert.equal(estranha.balde.feito.copias.length, 0);

  const semPasta = montagem({ mudanca: { de: 'user_dono9', para: 'user_dono1', caminhos: [] } });
  assert.equal(await semPasta.concluirMudancaLoja(loja), null, 'Só sai de pasta de montagem');

  const nada = montagem({ mudanca: null });
  assert.deepEqual(await nada.concluirMudancaLoja(loja), { publicados: 2, em_analise: 1, rascunhos: 0 }, 'Sem fotos a mudar: só publica');
  assert.equal(await nada.concluirMudancaLoja('x'), null);
});

function acoesReceber({ resposta, concluir = async () => ({ publicados: 1, em_analise: 0, rascunhos: 2 }), linhaDono = { id: loja, pasta_montagem: pasta }, prontos = 0 }) {
  const chamadas = [];
  const cookies = [];
  const db = {
    rpc: (nome, args) => { chamadas.push([nome, args]); return { maybeSingle: async () => resposta }; },
    from: () => {
      const q = { select: () => q, eq: (c, v) => { chamadas.push(['eq', c, v]); return q; }, not: () => q, maybeSingle: async () => ({ data: linhaDono, error: null }) };
      return q;
    },
  };
  const mod = carregar('src/app/receber-loja/actions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_dono1' }) },
    'next/headers': { cookies: async () => ({ set: (...a) => cookies.push(a) }) },
    'next/cache': { revalidatePath() {} },
    'next/navigation': redirecionar,
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/dados/montagem': { concluirMudancaLoja: async (id) => { chamadas.push(['concluir', id]); return concluir(id); }, prontosPendentes: async () => prontos },
  });
  return { ...mod, chamadas, cookies };
}

test('aceitar a loja: guarda a escolha da equipe, muda as fotos, escolhe a loja e volta com o resultado', async () => {
  const a = acoesReceber({ resposta: { data: { loja_id: loja, aceito: true }, error: null } });
  const form = new FormData();
  form.set('manter_equipe', 'on');
  await assert.rejects(a.aceitarLoja(token, null, form), /redirect:\/minha-conta\/loja\?recebida=1-0-2$/);
  assert.deepEqual(a.chamadas[0], ['convite_dono_loja', { p_token: token, p_aceitar: true, p_manter_equipe: true }]);
  assert.deepEqual(a.chamadas[1], ['concluir', loja]);
  assert.equal(a.cookies[0][0], 'loja_ativa');
  assert.equal(a.cookies[0][1], loja);

  const semEquipe = acoesReceber({ resposta: { data: { loja_id: loja, aceito: true }, error: null }, concluir: async () => null });
  await assert.rejects(semEquipe.aceitarLoja(token, null, new FormData()), /recebida=pendente$/);
  assert.equal(semEquipe.chamadas[0][1].p_manter_equipe, false, 'Caixa desmarcada: a equipe não fica');
});

test('aceitar a loja: quem já vende recebe a mensagem do banco; convite ruim não aceita', async () => {
  const vende = acoesReceber({ resposta: { data: null, error: { code: '23514', message: 'Você já vende no Mercado da Região. Fale com a equipe para receber esta loja.' } } });
  assert.match(await vende.aceitarLoja(token, null, new FormData()), /Você já vende/);
  assert.ok(!vende.chamadas.some((c) => c[0] === 'concluir'));
  const vencido = acoesReceber({ resposta: { data: null, error: null } });
  assert.match(await vencido.aceitarLoja(token, null, new FormData()), /venceu/);
  assert.equal(vencido.chamadas.length, 1);
  assert.match(await vencido.aceitarLoja('abc', null, new FormData()), /venceu/);
  assert.equal(vencido.chamadas.length, 1, 'Código inválido nem consulta o banco');
});

test('terminar de receber: só o dono, e só a loja com fotos pendentes', async () => {
  const ok = acoesReceber({ resposta: null });
  await assert.rejects(ok.terminarRecebimento(loja), /recebida=1-0-2$/);
  assert.ok(ok.chamadas.some((c) => c[0] === 'eq' && c[1] === 'dono_id' && c[2] === 'user_dono1'));
  const outro = acoesReceber({ resposta: null, linhaDono: null });
  assert.match(await outro.terminarRecebimento(loja), /Não foi possível/);
  assert.ok(!outro.chamadas.some((c) => c[0] === 'concluir'));
  const falhou = acoesReceber({ resposta: null, concluir: async () => null });
  assert.match(await falhou.terminarRecebimento(loja), /Tente de novo/);
  // Fotos já mudaram, mas a publicação parou: ainda dá para terminar.
  const soProntos = acoesReceber({ resposta: null, linhaDono: { id: loja, pasta_montagem: null }, prontos: 2 });
  await assert.rejects(soProntos.terminarRecebimento(loja), /recebida=1-0-2$/);
  const nadaPendente = acoesReceber({ resposta: null, linhaDono: { id: loja, pasta_montagem: null } });
  assert.match(await nadaPendente.terminarRecebimento(loja), /já foi recebida/);
  assert.ok(!nadaPendente.chamadas.some((c) => c[0] === 'concluir'));
});

function acoesPainel(resposta) {
  const chamadas = [];
  const supabase = { rpc: async (nome, args) => { chamadas.push([nome, args]); return resposta; } };
  const mod = carregar('src/app/admin/lojas/montagem-actions.ts', {
    'next/navigation': redirecionar,
    'next/cache': { revalidatePath() {} },
    '@/lib/admin/auth': { exigirSuperAdmin: async () => ({ supabase }) },
  });
  return { ...mod, chamadas };
}

test('painel: montar loja manda nome, endereço e cidade e abre a ficha nova', async () => {
  const p = acoesPainel({ data: loja, error: null });
  const f = new FormData();
  f.set('nome', ' Loja Montada '); f.set('slug', 'loja-montada'); f.set('microrregiao_id', '59200000-0000-4000-a000-000000000001'); f.set('cidade', 'Corrente');
  await assert.rejects(p.montarLoja(null, f), new RegExp(`redirect:/admin/lojas/${loja}$`));
  assert.deepEqual(p.chamadas[0], ['super_montar_loja', { p_nome: 'Loja Montada', p_slug: 'loja-montada', p_regiao: '59200000-0000-4000-a000-000000000001', p_cidade: 'Corrente' }]);
  f.set('microrregiao_id', '');
  assert.match((await p.montarLoja(null, f)).erro, /região/);
  const repetido = acoesPainel({ data: null, error: { code: '23505', details: 'campo:slug', message: 'duplicate' } });
  f.set('microrregiao_id', '59200000-0000-4000-a000-000000000001');
  assert.match((await repetido.montarLoja(null, f)).erro, /endereço já está em uso/);
});

test('painel: convite do dono devolve o link completo e o número para o WhatsApp', async () => {
  const p = acoesPainel({ data: token, error: null });
  const f = new FormData();
  f.set('whatsapp', '(89) 99999-0590');
  const r = await p.convidarDono(loja, null, f);
  assert.equal(r.whatsapp, '5589999990590');
  assert.match(r.link, new RegExp(`^https?://[^/]+/receber-loja\\?codigo=${token}$`));
  assert.deepEqual(p.chamadas[0], ['super_convidar_dono', { p_loja: loja, p_whatsapp: '5589999990590' }]);
  f.set('whatsapp', '123');
  assert.match((await p.convidarDono(loja, null, f)).erro, /celular/);
  assert.equal(p.chamadas.length, 1, 'Número ruim nem chega ao banco');
  assert.match((await p.cancelarConviteDono(loja)).ok, /cancelado/);
});

function paginaReceber({ userId = 'user_dono1', convite = null, erro = null }) {
  return carregar('src/app/receber-loja/page.tsx', {
    '@clerk/nextjs/server': { auth: async () => ({ userId }) },
    '@clerk/nextjs': { SignOutButton: ({ children }) => children },
    'next/navigation': redirecionar,
    '@/lib/perfil': { garantirPerfil: async () => {} },
    '@/lib/dados/conta': { meuPerfilEVitrine: async () => ({ perfil: { whatsapp: '5589999990590', whatsapp_verificado_em: '2026-11-01' } }) },
    '@/lib/dados/paginas': { termosPendentes: async () => [] },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: () => ({ maybeSingle: async () => ({ data: convite, error: erro }) }) }) },
    './form-receber': { FormReceberLoja: ({ codigo }) => `FORM:${codigo}` },
  }).default({ searchParams: Promise.resolve({ codigo: token }) });
}

test('página receber loja: convite válido, quem já vende, sem login e convite vencido', async () => {
  const base = { loja_id: loja, nome: 'Loja Montada', cidade: 'Corrente', prontos: 3, ja_vende: false, aceito: false };
  let html = render(await paginaReceber({ convite: base }));
  assert.match(html, /Receber Loja Montada/);
  assert.match(html, /3 produtos prontos vão ao ar/);
  assert.match(html, /teste grátis começa hoje/);
  assert.match(html, new RegExp(`FORM:${token}`));
  html = render(await paginaReceber({ convite: { ...base, ja_vende: true } }));
  assert.match(html, /Você já vende/);
  assert.doesNotMatch(html, /FORM:/);
  html = render(await paginaReceber({ userId: null }));
  assert.match(html, /Entrar ou criar conta/);
  assert.match(html, /redirect_url=%2Freceber-loja%3Fcodigo%3D/);
  html = render(await paginaReceber({ convite: null }));
  assert.match(html, /venceu, foi cancelado/);
});

test('formulário de receber: a caixa da equipe começa desmarcada', () => {
  const { FormReceberLoja } = carregar('src/app/receber-loja/form-receber.tsx', {
    './actions': { aceitarLoja() {}, terminarRecebimento() {} },
  });
  const html = render(React.createElement(FormReceberLoja, { codigo: token }));
  assert.match(html, /<input type="checkbox"[^>]*name="manter_equipe"\/>/);
  assert.doesNotMatch(html, /<input[^>]*checked/);
  assert.match(html, /Receber minha loja/);
});
