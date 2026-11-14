const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { carregar } = require('./carregar.cjs');

// Modelo de IA por recurso, escolhido no painel. Sem rede: fetch e banco falsos.
const ia = carregar('src/lib/ia-modelos.ts');
const LUNA = 'openai/gpt-6-luna';
const DEEPSEEK = 'deepseek/deepseek-v4.1-flash';
const RECURSOS = ['moderacao', 'categorizacao', 'melhoria', 'verificacao', 'radar'];
const MIGRACAO = fs.readFileSync('supabase/migrations/20261126010000_ia_modelos_por_recurso.sql', 'utf8');

async function comOpenRouter(fn) {
  const antes = global.fetch; const chave = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'chave-ficticia';
  const corpos = [];
  global.fetch = async (url, op) => {
    if (String(url).startsWith('https://openrouter.ai/')) { corpos.push(JSON.parse(op.body)); return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }], usage: { cost: 0.001 } }); }
    // foto do anúncio (moderação)
    return new Response(Buffer.alloc(100), { headers: { 'content-type': 'image/webp' } });
  };
  try { await fn(); return corpos; } finally {
    global.fetch = antes;
    if (chave === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = chave;
  }
}

test('catálogo: GPT-6 Luna é o padrão, DeepSeek é opção em todos e Claude Opus 5.5 nunca aparece', () => {
  assert.equal(ia.MODELO_IA_PADRAO, LUNA);
  assert.deepEqual(Object.keys(ia.RECURSOS_IA).sort(), [...RECURSOS].sort());
  for (const r of RECURSOS) {
    const valores = ia.RECURSOS_IA[r].modelos.map((m) => m.valor);
    assert.equal(valores[0], LUNA, r);
    assert.ok(valores.includes(DEEPSEEK), r);
    assert.equal(ia.RECURSOS_IA[r].chave, `ia.modelo.${r}`);
    for (const m of ia.RECURSOS_IA[r].modelos) assert.match(m.nome, new RegExp(m.valor.replace(/[./]/g, '\\$&')), 'nome mostra o ID');
  }
  assert.doesNotMatch(JSON.stringify(ia.RECURSOS_IA) + MIGRACAO.replace(/^--.*$/gm, ''), /opus/i);
});

test('valor salvo estranho, vazio ou ausente cai no padrão', () => {
  for (const v of [null, undefined, '', 'anthropic/claude-opus-5.5', 'google/gemini-2.5-flash-lite', 42, { a: 1 }]) {
    assert.equal(ia.modeloOuPadrao('moderacao', v), LUNA, String(v));
  }
  assert.equal(ia.modeloOuPadrao('moderacao', DEEPSEEK), DEEPSEEK);
  assert.equal(ia.modeloOuPadrao('radar', 'google/gemini-2.5-flash-lite'), 'google/gemini-2.5-flash-lite');
});

test('Luna sem temperature; Luna e DeepSeek com raciocínio desligado; modelos anteriores como antes', () => {
  const NADA = { effort: 'none' };
  assert.deepEqual(ia.ajustesDoModelo('melhoria', LUNA, 0.2), { reasoning: NADA });
  assert.deepEqual(ia.ajustesDoModelo('melhoria', DEEPSEEK, 0.2), { temperature: 0.2, reasoning: NADA });
  assert.deepEqual(ia.ajustesDoModelo('melhoria', 'openai/gpt-4.1-mini', 0), { temperature: 0 });
  assert.deepEqual(ia.ajustesDoModelo('radar', 'google/gemini-2.5-flash-lite', 0), { temperature: 0 });
});

test('a lista do banco é a mesma do código (padrão, modelos e chaves)', () => {
  for (const r of RECURSOS) {
    const linha = MIGRACAO.match(new RegExp(`when '${r}' then array\\[([^\\]]+)\\]`));
    assert.ok(linha, r);
    const doBanco = linha[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
    assert.deepEqual(doBanco, ia.RECURSOS_IA[r].modelos.map((m) => m.valor), r);
    assert.match(MIGRACAO, new RegExp(`\\('ia\\.modelo\\.${r}', '"${LUNA.replace(/[./]/g, '\\$&')}"', 'ia'`));
  }
  assert.match(MIGRACAO, /return 'openai\/gpt-6-luna';/);
  assert.match(MIGRACAO, /alter column modelo set default public\.ia_modelo\('moderacao'\)/);
  assert.match(MIGRACAO, /grant execute on function public\.ia_modelo\(text\) to service_role;/);
});

test('painel: cada chave tem lista de escolha, é global e o grupo tem nome', () => {
  const config = carregar('src/lib/admin/config.ts');
  const vis = carregar('src/lib/admin/config-visibilidade.ts');
  assert.equal(config.NOMES_GRUPO.ia, 'Modelos de IA');
  for (const r of RECURSOS) {
    const chave = `ia.modelo.${r}`;
    assert.deepEqual(config.OPCOES_FIXAS[chave].map((o) => o.valor), ia.RECURSOS_IA[r].modelos.map((m) => m.valor));
    assert.equal(vis.permiteExcecaoRegional(chave), false);
    assert.equal(vis.configGenericaEditavel(chave), true);
  }
  const pagina = fs.readFileSync('src/app/admin/configuracoes/page.tsx', 'utf8');
  assert.match(pagina, /grupo=ia/);
  assert.match(pagina, /MODELOS_FIXOS_IA/);
  assert.ok(ia.MODELOS_FIXOS_IA.length >= 4 && ia.MODELOS_FIXOS_IA.every((f) => f.motivo.length > 20));
});

test('modeloDoRecurso: lê o banco, guarda por 30 s e cai no padrão se o banco falhar', async () => {
  let respostas = [{ data: DEEPSEEK, error: null }];
  let chamadas = 0;
  const mocks = { '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc: async (nome, args) => {
    chamadas++; assert.equal(nome, 'ia_modelo'); assert.ok(['radar', 'melhoria', 'moderacao'].includes(args.p_recurso));
    const r = respostas.shift(); if (r instanceof Error) throw r; return r;
  } }) } };
  const s = carregar('src/lib/ia-modelos-servidor.ts', mocks);
  assert.equal(await s.modeloDoRecurso('radar'), DEEPSEEK);
  assert.equal(await s.modeloDoRecurso('radar'), DEEPSEEK);
  assert.equal(chamadas, 1, 'segunda leitura vem da memória');
  respostas = [{ data: null, error: { message: 'fora do ar' } }];
  assert.equal(await s.modeloDoRecurso('melhoria'), LUNA);
  respostas = [new Error('sem rede')];
  assert.equal(await s.modeloDoRecurso('moderacao'), LUNA);
  respostas = [{ data: 'anthropic/claude-opus-5.5', error: null }];
  const s2 = carregar('src/lib/ia-modelos-servidor.ts', mocks);
  assert.equal(await s2.modeloDoRecurso('radar'), LUNA, 'modelo fora da lista nunca é usado');
});

test('categorização e melhoria usam o modelo da reserva: Luna sem temperature, DeepSeek com', async () => {
  const cat = carregar('src/lib/categorizacao-ia.ts', { '@/lib/supabase/admin': { supabaseAdmin: () => ({}) } });
  const mel = carregar('src/lib/melhoria-ia.ts', { '@/lib/supabase/admin': { supabaseAdmin: () => ({}) } });
  const lote = (modelo) => ({ id: 'l', reserva: 'r', modelo, categorias: [{ slug: 'casa', nome: 'Casa' }], anuncios: [{ id: 'a', titulo: 'Sofá', descricao: null, categoria: 'casa' }] });
  const pedido = (modelo) => ({ id: 'm', reserva: 'r', modelo, titulo: 'Sofá', descricao: 'sofa bom', categoria: 'Casa', atributos: {}, fotos: [] });
  const corpos = await comOpenRouter(async () => {
    await cat.sugerirCategoriasIA(lote(LUNA));
    await cat.sugerirCategoriasIA(lote(DEEPSEEK));
    await mel.sugerirMelhoriaIA(pedido(LUNA));
    await mel.sugerirMelhoriaIA(pedido(DEEPSEEK));
    await mel.sugerirMelhoriaIA(pedido('anthropic/claude-opus-5.5'));
  });
  assert.equal(corpos.length, 4, 'modelo fora da lista não chama a IA');
  assert.deepEqual(corpos.map((c) => c.model), [LUNA, DEEPSEEK, LUNA, DEEPSEEK]);
  assert.deepEqual(corpos.map((c) => c.temperature), [undefined, 0, undefined, 0.2]);
  assert.deepEqual(corpos.map((c) => c.reasoning?.effort), ['none', 'none', 'none', 'none']);
  for (const c of corpos) { assert.equal(c.provider.require_parameters, true); assert.equal(c.provider.zdr, true); }
});

test('verificação e Radar leem o modelo do painel a cada chamada', async () => {
  const servidor = { modeloDoRecurso: async (r) => { assert.ok(['verificacao', 'radar'].includes(r)); return DEEPSEEK; } };
  const ver = carregar('src/lib/verificacao-loja/ia.ts', { '@/lib/ia-modelos-servidor': servidor, './pdf': { extrairTextoPdf: async () => '' } });
  const radar = carregar('src/lib/radar-ia/gemini.ts', { '@/lib/ia-modelos-servidor': servidor });
  const corpos = await comOpenRouter(async () => {
    await ver.lerFachada({ base64: 'iVBORw0KGgo=', tipo: 'image/png' });
    await radar.perguntarGemini({ nome: 'x', sistema: 's', usuario: 'u', esquema: { type: 'object' }, validar: (v) => v });
  });
  assert.deepEqual(corpos.map((c) => c.model), [DEEPSEEK, DEEPSEEK]);
  assert.deepEqual(corpos.map((c) => c.temperature), [0, 0]);
  assert.deepEqual(corpos.map((c) => c.reasoning), [{ effort: 'none' }, { effort: 'none' }]);
});

test('moderação: análise pendente com o modelo anterior continua funcionando', async () => {
  const mod = carregar('src/lib/moderacao-ia.ts', { '@/lib/supabase/admin': { supabaseAdmin: () => ({}) } });
  const antes = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemplo.supabase.co';
  const t = (modelo) => ({ id: 'f', reserva: 'r', modelo, anuncio_id: 'an', dono_id: 'do', titulo: 'Livro', descricao: 'Literatura', preco_centavos: 1000,
    categoria: 'Livros', atributos: {}, motivo: 'Palavra bloqueada: arma', fotos: ['https://exemplo.supabase.co/storage/v1/object/public/anuncios/do/an/1.webp'] });
  try {
    const corpos = await comOpenRouter(async () => {
      await mod.analisarAnuncioIA(t(LUNA));
      await mod.analisarAnuncioIA(t('openai/gpt-4.1-mini'));
      const fora = await mod.analisarAnuncioIA(t('outro/modelo'));
      assert.equal(fora.parecer.decisao, 'revisar');
    });
    assert.deepEqual(corpos.map((c) => c.model), [LUNA, 'openai/gpt-4.1-mini']);
    assert.deepEqual(corpos.map((c) => c.temperature), [undefined, 0]);
    assert.deepEqual(corpos.map((c) => c.reasoning), [{ effort: 'none' }, undefined], 'modelo anterior segue sem o campo');
  } finally {
    if (antes === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = antes;
  }
});
