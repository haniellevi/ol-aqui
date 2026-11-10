const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

function banco({ falha, vencidas = [], testes = [], lojas = [], atendimentos = 0 } = {}) {
  const consultas = [];
  return {
    consultas,
    rpc: async () => ({ data: [], error: null }),
    from(tabela) {
      const filtros = [];
      let colunas = '', opcoes;
      const q = {
        select(c, o) { colunas = c; opcoes = o; return q; },
        order() { return q; }, limit() { return q; },
        eq(...a) { filtros.push(['eq', ...a]); return q; },
        is(...a) { filtros.push(['is', ...a]); return q; },
        gt() { return q; }, lt() { return q; }, gte() { return q; }, lte() { return q; },
        in() { return q; }, not() { return q; },
        then(resolve) {
          consultas.push({ tabela, colunas, filtros });
          if (['vitrines_lojas', 'pagamentos'].includes(tabela) && /\bwhatsapp\b/.test(colunas)) return resolve({ data: null, error: { code: '42501', message: 'permission denied for table vitrines_lojas' } });
          if (tabela === falha) return resolve({ data: null, error: { message: 'offline' }, count: null });
          const data = tabela === 'pagamentos' ? vencidas : tabela === 'vitrines_lojas' ? (colunas.includes('anuncios(') ? lojas : testes) : [];
          return resolve({ data, error: null, count: tabela === 'atendimentos_anuncio' ? atendimentos : opcoes?.head ? 0 : null });
        },
      };
      return q;
    },
  };
}

const agora = new Date('2026-11-10T20:00:00Z');
const { tarefasDeHoje } = carregar('src/lib/admin/hoje.ts');

test('Hoje carrega com os privilégios reais, sem consultar contatos privados', async () => {
  const db = banco();
  const r = await tarefasDeHoje(db, agora);
  assert.equal(r.erro, false);
  assert.deepEqual(r.tarefas, []);
  assert.ok(db.consultas.filter(q => ['vitrines_lojas', 'pagamentos'].includes(q.tabela)).every(q => !/\bwhatsapp\b/.test(q.colunas)));
});

test('Hoje preserva tarefas carregadas quando outra origem falha', async () => {
  const r = await tarefasDeHoje(banco({ falha: 'funil_lojistas', testes: [{ id: 'loja', nome: 'Loja', teste_expira_em: '2026-11-11T20:00:00Z' }] }), agora);
  assert.equal(r.erro, true);
  assert.equal(r.tarefas[0].tipo, 'teste_acabando');
});

test('Hoje só oferece cobranças vencidas de produção', async () => {
  const db = banco();
  await tarefasDeHoje(db, agora);
  const q = db.consultas.find(q => q.tabela === 'pagamentos');
  assert.match(q.colunas, /asaas_criacoes!inner/);
  assert.ok(q.filtros.some(f => f[0] === 'eq' && f[1] === 'asaas_criacoes.ambiente' && f[2] === 'producao'));
});

test('Hoje mostra atendimento humano como pendência que precisa ser resolvida', async () => {
  const r = await tarefasDeHoje(banco({ atendimentos: 2 }), agora);
  const t = r.tarefas.find(t => t.tipo === 'atendimento');
  assert.ok(t);
  assert.equal(t.adiavel, false);
  assert.equal(t.acao.href, '/admin/anuncios/conversas');
});

test('Hoje não anuncia ausência de pendências quando a consulta falha', async () => {
  const simples = tag => props => React.createElement(tag, null, props.children);
  const { default: Page } = carregar('src/app/admin/hoje/page.tsx', {
    '@/lib/admin/equipe': { exigirTela: async () => ({ supabase: {} }) },
    '@/lib/admin/hoje': { hojeLocal: () => '2026-11-10', NOME_TIPO: {}, tarefasDeHoje: async () => ({ tarefas: [], total: 0, feitas: 0, erro: true, falhas: ['Lojas'], max: 10 }) },
    '@/components/admin/ui': { Aviso: simples('div'), Titulo: simples('h1') },
    '@/components/ui/badge': { Badge: simples('span') },
    '@/components/ui/botao': { Botao: simples('button') },
    '@/components/ui/vazio': { Vazio: props => React.createElement('div', null, props.titulo, props.texto, props.children) },
    './botoes': { BotaoFeito: simples('button'), BotaoDesfazer: simples('button') },
  });
  const html = renderToStaticMarkup(await Page());
  assert.doesNotMatch(html, /Nada pendente agora|Tudo feito por hoje/);
  assert.match(html, /não|Não/);
});
