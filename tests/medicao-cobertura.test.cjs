const {test}=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server'),{carregar}=require('./carregar.cjs');
test('avisos não apresentam série diária como homogênea ou histórico exaustivo',()=>{
 const {AvisoSerieMetrica}=carregar('src/components/metricas/aviso-serie.tsx');
 const s=renderToStaticMarkup(React.createElement(AvisoSerieMetrica));
 for(const texto of [/regimes diferentes/,/dia da migração/,/cascata/,/implantação real/])assert.match(s,texto);
});
test('painel explicita população observável e não compara tráfego sem rollout confirmado',()=>{
 const {lancamento}=require('./fixtures/lancamento.cjs');
 const {PainelLancamento}=carregar('src/app/admin/painel-lancamento.tsx',{'next/link':{__esModule:true,default:({children,...p})=>React.createElement('a',p,children)},'./preparacao-ga4':{PreparacaoGa4:()=>null}});
 const html=renderToStaticMarkup(React.createElement(PainelLancamento,{atual:lancamento,anterior:lancamento,periodo:{de:'2026-11-19',ate:'2026-11-24',anteriorDe:'2026-11-13',anteriorAte:'2026-11-18',aviso:null}}));
 assert.match(html,/30 min sem pageview/);assert.match(html,/copiado entre abas/);
 assert.match(html,/textuais/);assert.match(html,/Referer/);assert.match(html,/implantação real não confirmada/);
 assert.doesNotMatch(html,/Sessões por aba/);
});
test('leitor de rollout compara instantes com offsets diferentes',()=>{
 const {lancamento}=require('./fixtures/lancamento.cjs');
 const {lerLancamento}=carregar('src/lib/admin/lancamento.ts');
 assert.ok(lerLancamento({...lancamento,rollout_inicio:'2026-11-01T10:00:00Z',rollout_fim:'2026-11-01T08:00:00-03:00'}));
});
