const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const { renderToStaticMarkup: render } = require('react-dom/server');
const id = '70000000-0000-4000-a000-000000000001';
function ambiente(opts = {}) {
  const chamadas = [];
  const q = { update(v) { chamadas.push(['update',v]); return q; }, eq() { return q; }, async select() { return opts.resposta ?? { data: [{id}], error: null }; } };
  const actions = carregar('src/app/(conta)/minha-conta/anuncios/actions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: opts.semSessao ? null : 'user_loja' }) },
    '@/lib/dados/anuncios': { meuAnuncio: async () => opts.semDono ? null : ({ id, status: opts.status ?? 'ativo' }) },
    '@/lib/supabase/server': { createClient: async () => ({ from: () => q, rpc: async (...args) => {
      chamadas.push(args); if (opts.falha) throw Error('offline');
      return opts.resposta ?? { data: opts.retorno, error: null };
    } }) },
    'next/cache': { revalidatePath: (p) => chamadas.push(['cache',p]) },
    'next/navigation': { unstable_rethrow: () => {} },
  });
  return { actions, chamadas };
}
test('ações rejeitam UUID inválido, sessão expirada e anúncio de outro dono antes da escrita', async () => {
  for (const opcoes of [{}, {semSessao:true}, {semDono:true}]) {
    const {actions,chamadas}=ambiente(opcoes);
    assert.equal((await actions.moverParaLixeira(Object.keys(opcoes).length ? id : 'invalido')).ok,false);
    assert.equal(chamadas.length,0);
  }
});
test('reativação não transforma retorno nulo ou inesperado em sucesso', async () => {
  for (const retorno of [null, undefined, '', 'vendido', {}]) assert.equal((await ambiente({retorno}).actions.reativarAnuncio(id)).ok,false);
  for (const retorno of ['ativo','em_analise']) assert.deepEqual(await ambiente({retorno}).actions.reativarAnuncio(id),{ok:true,dados:retorno});
});
test('retorno incerto pede atualização e erro de banco não vira sucesso', async () => {
  const falha=await ambiente({falha:true}).actions.moverParaLixeira(id);
  assert.equal(falha.ok,false); assert.equal(falha.erro.codigo,'alteracao_incerta');
  assert.match(falha.erro.mensagem,/Atualize a página/);
  const {actions,chamadas}=ambiente({resposta:{data:null,error:{code:'42501',message:'Bloqueado'}}});
  assert.equal((await actions.restaurarAnuncio(id)).ok,false);
  assert.equal(chamadas.some(([a])=>a==='cache'),false);
});
test('pausar repetidamente e marcar venda repetidamente preservam estado sem novas escritas', async () => {
  const pausa=ambiente({status:'pausado'});assert.equal((await pausa.actions.pausarAnuncio(id)).ok,true);
  assert.equal(pausa.chamadas.some(([a])=>a==='update'),false);
  const venda=ambiente({status:'vendido'});assert.equal((await venda.actions.marcarVendido(id,true)).ok,true);
  assert.equal(venda.chamadas.some(([a])=>a==='marcar_vendido'),false);
  assert.equal((await venda.actions.marcarVendido(id,'true')).ok,false);
});
test('pausa não confirma escrita vazia e rejeita estado desatualizado', async () => {
  assert.equal((await ambiente({resposta:{data:[],error:null}}).actions.pausarAnuncio(id)).ok,false);
  assert.equal((await ambiente({status:'vendido'}).actions.pausarAnuncio(id)).ok,false);
});
test('lixeira chama RPC reversível e atualiza conta, busca, anúncio e loja', async () => {
  const {actions,chamadas}=ambiente({retorno:'excluido'});
  assert.deepEqual(await actions.moverParaLixeira(id),{ok:true,dados:'excluido'});
  assert.deepEqual(chamadas[0],['mover_anuncio_lixeira',{p_anuncio_id:id}]);
  for(const p of ['/minha-conta/anuncios','/busca','/anuncio/[idslug]','/loja/[slug]']) assert.ok(chamadas.some(([a,b])=>a==='cache'&&b===p));
});
test('restauração aceita estados preservados e não anuncia reativação automática', async () => {
  for(const retorno of ['rascunho','pausado','vendido','em_analise','congelado']) assert.equal((await ambiente({retorno}).actions.restaurarAnuncio(id)).ok,true);
  for(const retorno of [null,'ativo','excluido']) assert.equal((await ambiente({retorno}).actions.restaurarAnuncio(id)).ok,false);
});

test('restaurar mantém a aba Lixeira e só encaminha ao destino depois do último anúncio', async () => {
  const restaurado = { id, status: 'pausado' };
  const outro = { id: '70000000-0000-4000-a000-000000000002', status: 'excluido', titulo: 'Ainda na lixeira', fotos: [] };
  const pagina = anuncios => carregar('src/app/(conta)/minha-conta/anuncios/page.tsx', {
    'next/navigation': { redirect: destino => { throw Error(`redirect:${destino}`); } },
    '@/lib/dados/conta': { meuPerfilEVitrine: async () => ({ vitrine: { tipo: 'pf' }, podePublicar: true }) },
    '@/lib/dados/anuncios': { meusAnuncios: async () => anuncios },
    '@/lib/dados/destaques': { resultadosDestaques: async () => [] },
    '@/lib/dados/vitrine-completa': {},
    '@/components/conta/resumo-plano': { resumoPlano: () => null },
    '@/components/conta/acoes-anuncio': { AcoesAnuncio: () => 'Restaurar anúncio' },
    '@/components/conta/filtro-meus-anuncios': { FiltroMeusAnuncios: () => null },
    '@/components/conta/foto-meu-anuncio': { FotoMeuAnuncio: () => null },
    '@/components/vitrine/botao-fixar': { BotaoFixar: () => null },
  }).default({ searchParams: Promise.resolve({ aba: 'lixeira', resultado: 'restaurado', anuncio: id }) });
  const html = render(await pagina([restaurado, outro]));
  assert.match(html, /Anúncio restaurado/);
  assert.match(html, /Ainda na lixeira/);
  await assert.rejects(pagina([restaurado]), new RegExp(`redirect:/minha-conta/anuncios\\?aba=pausados&resultado=restaurado&anuncio=${id}`));
});
test('todos exclui lixeira e cada estado possui destino e rótulo', () => {
  const {ABAS_ANUNCIOS,abaDoStatus,ROTULO_ANUNCIO}=carregar('src/components/conta/situacao-anuncios.ts');
  assert.equal(ABAS_ANUNCIOS[0].status.includes('excluido'),false);
  assert.equal(abaDoStatus('excluido'),'lixeira');assert.equal(abaDoStatus('congelado'),'analise');
  for(const status of Object.keys(ROTULO_ANUNCIO)) assert.notEqual(abaDoStatus(status),'todos');
});
