const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

test('índice do documento aponta para âncoras únicas e preserva as existentes', () => {
  const { Markdown, titulosDoTexto } = carregar('src/components/paginas/markdown.tsx');
  const texto = '## Dados\n\n### Dados\n\n## Dados 2\n\n## **Dados**\n\n## ⚠\n\n## ⚠';
  const ids = [...render(React.createElement(Markdown, { texto })).matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['dados', 'dados-3', 'dados-2', 'dados-4', 'secao', 'secao-2']);
  assert.deepEqual(titulosDoTexto(texto).map((t) => t.id), ids.filter((id) => id !== 'dados-3'));
});

test('uma versão legal específica mantém o texto correto e distingue ausência de falha', async () => {
  const atual = { id: 'atual', versao: 2, ativo: true, publicado_em: '2026-11-10T12:00:00Z', titulo: 'Termos atuais', conteudo: 'Texto atual' };
  const antiga = { ...atual, id: 'antiga', ativo: false, versao: 1, titulo: 'Termos antigos', conteudo: 'Texto histórico' };
  const abrir = async (pedida) => {
    const { PaginaDocumento } = carregar('src/components/paginas/pagina-documento.tsx', {
      '@/lib/dados/paginas': {
        documentoAtivo: async () => atual,
        documentoVersao: async () => { if (pedida instanceof Error) throw pedida; return pedida; },
        versoesDocumento: async () => [atual, antiga],
      },
    });
    return render(await PaginaDocumento({ tipo: 'termos', versao: 1 }));
  };
  const h = await abrir(antiga);
  assert.match(h, /Versão arquivada/);
  assert.match(h, /Texto histórico/);
  assert.match(h, /<a(?=[^>]* aria-current="page")(?=[^>]* href="\/termos\?versao=1")/);
  const falta = await abrir(null);
  assert.match(falta, /Versão 1 não encontrada/);
  assert.doesNotMatch(falta, /Texto atual/);
  const falha = await abrir(Error('offline'));
  assert.match(falha, /Não conseguimos abrir o documento/);
  assert.match(falha, /href="\/termos\?versao=1"/);
  assert.doesNotMatch(falha, /Texto atual/);
});

test('planos só oferecem contratação para o público elegível e mantêm a origem', async () => {
  const plano = { codigo: 'full', nome: 'Plano Full', publico: 'pj', preco_centavos: 9900, periodo_dias: 30, limite_anuncios: null };
  const abrir = async (tipo) => {
    const { default: Planos } = carregar('src/app/(publico)/planos/page.tsx', {
      '@clerk/nextjs/server': { auth: async () => ({ userId: tipo ? 'usuario' : null }) },
      '@/lib/dados/conta': { meuPerfilEVitrine: async () => ({ vitrine: { tipo } }) },
      '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => ({ data: null, error: null }) }) },
      '@/lib/dados/vitrine-completa': { planosPublicos: async () => [plano], perguntasDosPlanos: async () => [] },
    });
    return render(await Planos({ searchParams: Promise.resolve({ origem: 'radar' }) }));
  };
  const pf = await abrir('pf');
  assert.match(pf, /por 30 dias/);
  assert.doesNotMatch(pf, /plano=full/);
  assert.match(await abrir('loja'), /\/minha-conta\/plano\?origem=radar&amp;plano=full/);
  assert.match(await abrir(null), /redirect_url=%2Fplanos%3Forigem%3Dradar/);
});
