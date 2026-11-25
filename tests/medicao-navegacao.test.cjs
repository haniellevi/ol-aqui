const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

test('coletor real: ausente, aceite, re-render, SPA, revisita, rota sensível e retirada sem retroenvio', async () => {
  const cookies = new Map(), local = new Map(), sessao = new Map(), eventos = new Map(), chamadas = [];
  const doc = new EventTarget();
  Object.defineProperty(doc, 'cookie', {get:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),set:s=>{const [par]=s.split(';');const i=par.indexOf('=');cookies.set(par.slice(0,i),par.slice(i+1))}});
  doc.visibilityState='visible';
  const armazem = m => ({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
  let rota='/', cursor=0; const slots=[], efeitos=[], limpezas=[];
  global.document=doc;
  global.location={protocol:'https:',search:'?utm_source=radio&q=sentinela'};
  global.localStorage=armazem(local); global.sessionStorage=armazem(sessao);
  global.matchMedia=()=>({matches:true});
  const originalFetch=global.fetch;
  global.fetch=async(_url,op)=>{chamadas.push(JSON.parse(op.body));return {ok:true}};
  global.window={location:{pathname:'/'},addEventListener:(n,f)=>eventos.set(n,f),removeEventListener:n=>eventos.delete(n),dispatchEvent:e=>eventos.get(e.type)?.(e)};
  const react=require('react');
  const comp=carregar('src/components/paginas/rastreio-visitas.tsx',{
    react:{...react,
      useState:v=>{const i=cursor++;if (!(i in slots)) slots[i]=v;return [slots[i],v=>slots[i]=v]},
      useRef:v=>{const i=cursor++;return slots[i]??(slots[i]={current:v})},
      useEffect:(f,deps)=>{const i=cursor++;if (!slots[i]||deps.some((d,j)=>d!==slots[i][j])){limpezas[i]?.();slots[i]=deps;efeitos.push(()=>limpezas[i]=f())}},
    },
    'next/navigation':{usePathname:()=>rota},
    '@/components/ui/botao':{Botao:()=>null},
  });
  const cliente=carregar('src/lib/metricas/cliente.ts');
  const render=async(p=rota)=>{rota=p;window.location.pathname=p;cursor=0;comp.RastreioVisitas();while(efeitos.length)efeitos.shift()();await new Promise(r=>setTimeout(r,5))};
  try {
    await render();await render();assert.equal(chamadas.length,0);assert.equal(local.has('mr_visitante'),false);
    cliente.salvarPreferencia({v:1,estatistica:true,marketing:false});await render();assert.equal(chamadas.length,1);
    await render();assert.equal(chamadas.length,1);
    // Reexecuta o efeito de navegação como uma remontagem de efeitos do StrictMode.
    delete slots[4];await render();assert.equal(chamadas.length,1);
    await render('/busca');await render('/');assert.equal(chamadas.length,3);
    assert.equal(new Set(chamadas.map(c=>c.sessao)).size,1);assert.equal(new Set(chamadas.map(c=>c.ocorrencia)).size,3);
    await render('/entrar');assert.equal(chamadas.length,3);
    cliente.salvarPreferencia({v:1,estatistica:false,marketing:false});await render('/busca');assert.equal(chamadas.length,3);assert.equal(local.has('mr_visitante'),false);
    cliente.salvarPreferencia({v:1,estatistica:true,marketing:false});await render();assert.equal(chamadas.length,4);
    assert.ok(!JSON.stringify(chamadas).includes('sentinela'));
  } finally {
    for(const f of limpezas)f?.();global.fetch=originalFetch;
    for(const k of ['window','document','location','localStorage','sessionStorage','matchMedia'])delete global[k];
  }
});
