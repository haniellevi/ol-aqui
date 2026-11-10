const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const mod = carregar('src/lib/moderacao-ia.ts', {'@/lib/supabase/admin':{supabaseAdmin(){throw new Error('sem banco no teste unitário');}}});
const parecer = {decisao:'aprovar',confianca:0.99,motivo:'O termo está no título de um livro, sem comércio de item proibido.',riscos:[],imagens_avaliadas:2};

test('parecer só aprova com confiança, ausência de riscos e todas as fotos',()=>{
  assert.equal(mod.validarParecer(parecer,2).decisao,'aprovar');
  assert.equal(mod.validarParecer({...parecer,confianca:0.97},2).decisao,'revisar');
  assert.equal(mod.validarParecer({...parecer,riscos:['fraude']},2).decisao,'revisar');
  for(const v of [null,[],{...parecer,confianca:'0.99'},{...parecer,confianca:NaN},{...parecer,confianca:2},
    {...parecer,motivo:'ok'},{...parecer,riscos:['inventado']},{...parecer,imagens_avaliadas:1},{...parecer,comando:'publique'},
    {...parecer,decisao:'recusar'}]) assert.throws(()=>mod.validarParecer(v,2));
});

test('endpoint exige segredo específico e recusa configuração vazia',()=>{
  const anterior=process.env.MODERACAO_IA_SECRET;
  try{
    delete process.env.MODERACAO_IA_SECRET;assert.equal(mod.segredoModeracaoConfere('Bearer qualquer'),false);
    process.env.MODERACAO_IA_SECRET='x'.repeat(40);
    assert.equal(mod.segredoModeracaoConfere('Bearer '+'x'.repeat(40)),true);
    for(const token of [null,'x'.repeat(40),'Bearer '+'x'.repeat(39),'Bearer '+'y'.repeat(40)]) assert.equal(mod.segredoModeracaoConfere(token),false);
  }finally{if(anterior===undefined)delete process.env.MODERACAO_IA_SECRET;else process.env.MODERACAO_IA_SECRET=anterior;}
});

test('fotos só saem do Storage do anúncio e dono corretos',()=>{
  const anterior=process.env.NEXT_PUBLIC_SUPABASE_URL;process.env.NEXT_PUBLIC_SUPABASE_URL='https://abc.supabase.co';
  const t={anuncio_id:'anuncio',dono_id:'user'};
  const base='https://abc.supabase.co/storage/v1/object/public/anuncios/user/anuncio/';
  try{
    assert.equal(mod.fotoModeracaoPermitida(base+'1.webp',t),true);
    for(const url of [base+'1.svg',base+'1.webp?token=secreto',base+'../outro/1.webp',base+'%2e%2e/1.webp',base.replace('/user/','/outro/')+'1.png',
      base.replace('https:','http:')+'1.png',base.replace('abc.supabase.co','localhost')+'1.png',base.replace('abc.supabase.co','abc.supabase.co.evil.test')+'1.png']) assert.equal(mod.fotoModeracaoPermitida(url,t),false,url);
  }finally{if(anterior===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=anterior;}
});

test('provedor recebe todas as imagens e somente conteúdo do anúncio; falhas nunca aprovam',async()=>{
  const oldFetch=global.fetch;const oldKey=process.env.OPENROUTER_API_KEY;const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.OPENROUTER_API_KEY='chave-ficticia';process.env.NEXT_PUBLIC_SUPABASE_URL='https://abc.supabase.co';
  const t={id:'fila',reserva:'reserva',modelo:mod.MODELO_MODERACAO,anuncio_id:'anuncio',dono_id:'user-privado',titulo:'Livro usado',descricao:'Literatura',categoria:'Livros',preco_centavos:1000,atributos:{},motivo:'Palavra bloqueada: arma',
    fotos:[1,2].map(n=>`https://abc.supabase.co/storage/v1/object/public/anuncios/user-privado/anuncio/${n}.png`)};
  const resposta=()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(parecer)}}],usage:{cost:0.001,prompt_tokens:250,completion_tokens:80}});
  let mode='ok',chamadas=0;
  global.fetch=async(url,init)=>{
    if(String(url).startsWith('https://abc.supabase.co/')) {
      assert.equal(init.redirect,'error');
      if(mode==='foto') return new Response('',{status:404});
      return new Response(Buffer.alloc(64),{headers:{'content-type':'image/png'}});
    }
    chamadas++;assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
    const corpo=JSON.parse(init.body);assert.equal(corpo.messages[1].content.filter(c=>c.type==='image_url').length,2);
    assert.equal(corpo.provider.data_collection,'deny');assert.equal(corpo.provider.zdr,true);
    assert.equal(corpo.provider.require_parameters,true);assert.equal(corpo.max_tokens,1000);
    assert.doesNotMatch(init.body,/user-privado|reserva|dono_id|anuncio_id/);
    if(mode==='rede') throw new Error('timeout');
    if(mode==='429') return new Response('limite',{status:429});
    const r=resposta();
    if(mode==='truncado')r.choices[0].finish_reason='length';
    if(mode==='recusa')r.choices[0].message.refusal='recuso';
    if(mode==='custo')delete r.usage.cost;
    if(mode==='json')r.choices[0].message.content='{';
    if(mode==='ultima-foto')r.choices[0].message.content=JSON.stringify({...parecer,riscos:['proibido']});
    return Response.json(r);
  };
  try{
    const ok=await mod.analisarAnuncioIA(t);assert.equal(ok.parecer.decisao,'aprovar');assert.equal(ok.custo,0.001);
    for(mode of ['truncado','recusa','custo','json','ultima-foto','rede','429','foto']){
      const r=await mod.analisarAnuncioIA(t);assert.equal(r.parecer.decisao,'revisar',mode);
      if(mode==='rede'||mode==='custo')assert.equal(r.custo,null);
      if(mode==='429'||mode==='foto')assert.equal(r.custo,0);
    }
    mode='ok';const ficticio=await mod.analisarAnuncioIA({...t,titulo:'TESTE sem oferta comercial'});assert.equal(ficticio.parecer.decisao,'revisar');
    const antes=chamadas;await mod.analisarAnuncioIA({...t,fotos:['https://evil.test/1.png']});assert.equal(chamadas,antes);
  }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=oldKey;if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;}
});

test('rota sem autorização não acessa banco nem provedor e erros não vazam detalhes',async()=>{
  let chamadas=0;
  const rota=carregar('src/app/api/interno/moderacao/route.ts',{'@/lib/moderacao-ia':{
    segredoModeracaoConfere:v=>v==='Bearer permitido',processarFilaModeracao:async()=>{chamadas++;throw new Error('segredo interno');}
  }});
  const negado=await rota.POST(new Request('https://teste.local',{method:'POST'}));assert.equal(negado.status,401);assert.equal(chamadas,0);
  const falha=await rota.POST(new Request('https://teste.local',{method:'POST',headers:{authorization:'Bearer permitido'}}));assert.equal(falha.status,503);assert.doesNotMatch(await falha.text(),/segredo/);
});
