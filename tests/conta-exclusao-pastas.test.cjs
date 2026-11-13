const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

// Banco falso: só o que pastasDaConta e apagarConta leem e gravam.
function bancoFalso({ trocas = [], perfisVivos = [], apagarPerfilFalha = null } = {}) {
  const fila = [];
  const removidos = [];
  const listas = { user_novo1: ['a.webp'], user_antigo1: ['b.webp'], user_desfeito1: ['c.webp'] };
  const consulta = (tabela) => {
    const filtros = {};
    const q = {
      select() { return q; },
      eq(c, v) { filtros[c] = v; return q; },
      in(c, v) { filtros[c] = v; return q; },
      upsert(linha) { if (tabela === 'limpeza_arquivos') fila.push(linha.pasta); return Promise.resolve({ error: null }); },
      delete() { q._delete = true; return q; },
      then(res) {
        if (tabela === 'admin_gestao_eventos') {
          const alvos = [].concat(filtros.alvo);
          const data = trocas.filter((t) => filtros.acao === 'troca_id_clerk' && alvos.includes(t.alvo)).map((t) => ({ detalhes: t.detalhes }));
          return res({ data, error: null });
        }
        if (tabela === 'perfis' && q._delete) return res({ error: apagarPerfilFalha });
        if (tabela === 'perfis') return res({ data: (filtros.id ?? []).filter((id) => perfisVivos.includes(id)).map((id) => ({ id })), error: null });
        return res({ data: [], error: null });
      },
    };
    return q;
  };
  const db = {
    from: consulta,
    rpc: (nome, args) => Promise.resolve(nome === 'urls_sem_uso' ? { data: args.p_urls, error: null } : { data: null, error: null }),
    storage: {
      from: () => ({
        list: (pasta) => Promise.resolve({ data: (listas[pasta] ?? []).map((name) => ({ name, id: name })), error: null }),
        getPublicUrl: (c) => ({ data: { publicUrl: `https://x/storage/v1/object/public/anuncios/${c}` } }),
        remove: (c) => { removidos.push(...c); return Promise.resolve({ error: null }); },
      }),
    },
  };
  return { db, fila, removidos };
}

function modulo(db) {
  return carregar('src/lib/conta-exclusao.ts', { '@/lib/supabase/admin': { supabaseAdmin: () => db } });
}

test('pastasDaConta: só a pasta do ID atual quando não houve troca', async () => {
  const { db } = bancoFalso();
  assert.deepEqual(await modulo(db).pastasDaConta(db, 'user_novo1'), ['user_novo1']);
});

test('pastasDaConta: inclui a pasta do ID antigo do Clerk, sem repetir e sem ID inválido', async () => {
  const { db } = bancoFalso({
    trocas: [
      { alvo: 'user_novo1', detalhes: { id_antigo: 'user_antigo1' } },
      { alvo: 'user_novo1', detalhes: { id_antigo: 'user_antigo1' } },
      { alvo: 'user_novo1', detalhes: { id_antigo: '../outra' } },
      { alvo: 'user_outro', detalhes: { id_antigo: 'user_naoe' } },
    ],
  });
  assert.deepEqual(await modulo(db).pastasDaConta(db, 'user_novo1'), ['user_novo1', 'user_antigo1']);
});

test('pastasDaConta: ID antigo que voltou a ser perfil (troca desfeita) não entra', async () => {
  const { db } = bancoFalso({
    trocas: [{ alvo: 'user_novo1', detalhes: { id_antigo: 'user_desfeito1' } }],
    perfisVivos: ['user_desfeito1'],
  });
  assert.deepEqual(await modulo(db).pastasDaConta(db, 'user_novo1'), ['user_novo1']);
});

test('pastasDaConta: segue a cadeia de trocas (A → B → C) e para em ciclo', async () => {
  const { db } = bancoFalso({
    trocas: [
      { alvo: 'user_b', detalhes: { id_antigo: 'user_a' } },
      { alvo: 'user_c', detalhes: { id_antigo: 'user_b' } },
      { alvo: 'user_a', detalhes: { id_antigo: 'user_c' } },
    ],
  });
  assert.deepEqual(await modulo(db).pastasDaConta(db, 'user_c'), ['user_c', 'user_b', 'user_a']);
});

test('pastasDaConta: cadeia para num ID antigo que voltou a ser perfil', async () => {
  const { db } = bancoFalso({
    trocas: [
      { alvo: 'user_b', detalhes: { id_antigo: 'user_a' } },
      { alvo: 'user_c', detalhes: { id_antigo: 'user_b' } },
    ],
    perfisVivos: ['user_b'],
  });
  assert.deepEqual(await modulo(db).pastasDaConta(db, 'user_c'), ['user_c']);
});

test('apagarConta: põe as duas pastas na fila e apaga os arquivos das duas', async () => {
  const { db, fila, removidos } = bancoFalso({ trocas: [{ alvo: 'user_novo1', detalhes: { id_antigo: 'user_antigo1' } }] });
  await modulo(db).apagarConta('user_novo1');
  assert.deepEqual(fila, ['user_novo1', 'user_antigo1']);
  assert.deepEqual(removidos.sort(), ['user_antigo1/b.webp', 'user_novo1/a.webp']);
});
