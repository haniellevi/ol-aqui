const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const id = '60000000-0000-4000-a000-000000000001';

function ambiente(op = {}) {
  const pg = { id, vitrine_id: 'vitrine', valor_centavos: 2990, status: 'pendente', forma: null, asaas_cobranca_id: null, link_pagamento: null, ...op.pg };
  const eventos = [];
  let reserva = !!op.reservado, encontrada = op.encontrada ?? null;
  const db = {
    from(tabela) {
      let remover = false;
      const q = { select(){return q;}, eq(){return q;}, update(){return q;}, delete(){remover=true;return q;},
        async maybeSingle(){ return {data:tabela==='pagamentos'?{...pg}:{id:'vitrine',dono_id:op.outro?'outro':'user',tipo:'loja',nome:'Teste',gateway_cliente_id:'sandbox:cus_1'},error:null}; },
        then(resolve){if(remover){reserva=false;eventos.push('liberou');}resolve({data:null,error:null});} };
      return q;
    },
    async rpc(nome, args) {
      eventos.push(nome);
      if(nome==='reservar_criacao_asaas'){if(op.erroReserva)return {error:{message:'indisponível'}};const ganhou=!reserva;reserva=true;return {data:ganhou,error:null};}
      if(nome==='registrar_cobranca_asaas'){
        if(op.erroRegistro)return {error:{message:'indisponível'}};
        pg.asaas_cobranca_id=args.p_cobranca_id;pg.forma=args.p_forma;pg.link_pagamento=args.p_link;return {data:true,error:null};
      }
      if(nome==='confirmar_pagamento'){if(op.erroConfirmacao)return {error:{message:'falhou'}};pg.status='pago';return {data:true,error:null};}
      return {data:true,error:null};
    }
  };
  class ErroAsaas extends Error { constructor(message,status){super(message);this.status=status;} }
  const cobrar = carregar('src/lib/cobranca-pagamento.ts', {
    '@clerk/nextjs/server': {auth:async()=>({userId:'user'})},
    '@/lib/supabase/admin': {supabaseAdmin:()=>db}, '@/lib/supabase/server':{createClient:async()=>db},
    '@/lib/dados/cobranca':{meuPagamento:async()=>({...pg,tipo:'assinatura',tem_cobranca:!!pg.asaas_cobranca_id})},
    '@/lib/asaas':{
      ErroAsaas,STATUS_PAGO:new Set(['RECEIVED','CONFIRMED']),ambienteAsaas:async()=>'sandbox',asaasConfigurado:()=>true,
      clienteDoAmbiente:(v)=>v?.split(':')[1],
      buscarCobrancaPorReferencia:async()=>encontrada,
      criarCobranca:async()=>{eventos.push('POST');await new Promise(r=>setTimeout(r,10));if(op.recusa)throw new ErroAsaas('documento recusado',400);if(op.timeout)throw new Error('timeout');return {id:'pay_1',value:29.9,billingType:'PIX',status:'PENDING',invoiceUrl:'https://sandbox.asaas.com/i/teste'};},
      trocarForma:async()=>{eventos.push('troca');return {invoiceUrl:'https://www.asaas.com/i/teste'};},
      consultarCobranca:async()=>({status:'RECEIVED'}),qrCodePix:async()=>{throw new Error('offline');},
    }
  });
  return { ...cobrar,pg,eventos,setEncontrada:(v)=>encontrada=v,
    run:()=>cobrar.garantirCobranca({amb:'sandbox',pg:{...pg},userId:'user',forma:'pix',descricao:'Teste',naoEncontrado:'Não encontrado'}) };
}

test('cobrança: quatro solicitações simultâneas fazem no máximo um POST',async()=>{
  const a=ambiente();const resultados=await Promise.allSettled(Array.from({length:4},()=>a.run()));
  assert.equal(a.eventos.filter(e=>e==='POST').length,1);assert.equal(resultados.filter(r=>r.status==='fulfilled').length,1);
  await a.run();assert.equal(a.eventos.filter(e=>e==='POST').length,1);
});
test('cobrança: timeout preserva reserva e repetição reconcilia sem novo POST',async()=>{
  const a=ambiente({timeout:true});await assert.rejects(a.run());await assert.rejects(a.run(),/tentativa anterior/);
  a.setEncontrada({id:'pay_recuperado',customer:'cus_1',externalReference:id,value:29.9,billingType:'PIX',status:'CONFIRMED',invoiceUrl:'https://sandbox.asaas.com/i/teste'});
  assert.equal(await a.run(),'ok');assert.equal(a.pg.status,'pago');assert.equal(a.pg.asaas_cobranca_id,'pay_recuperado');
  assert.equal(a.eventos.filter(e=>e==='POST').length,1);assert.equal(a.eventos.includes('liberou'),false);
});
test('cobrança: recusa explícita permite corrigir documento; falha de reserva não cria',async()=>{
  const a=ambiente({recusa:true});await assert.rejects(a.run(),/não foi aceito/);assert.ok(a.eventos.includes('liberou'));
  const b=ambiente({erroReserva:true});await assert.rejects(b.run());assert.equal(b.eventos.includes('POST'),false);
});
test('cobrança: referência, cliente, valor, forma e exclusão divergentes impedem reconciliação',async()=>{
  const encontrada={id:'pay_1',customer:'cus_1',externalReference:id,value:29.9,billingType:'PIX',status:'PENDING'};
  for(const errado of [{externalReference:'outro'},{customer:'cus_outro'},{value:30},{billingType:'BOLETO'},{deleted:true}]){
    const a=ambiente({reservado:true,encontrada:{...encontrada,...errado}});await assert.rejects(a.run(),/conferida/);assert.equal(a.eventos.includes('POST'),false);
  }
});
test('cobrança: falha ao gravar após criação mantém proteção contra duplicidade',async()=>{
  const a=ambiente({erroRegistro:true});await assert.rejects(a.run(),/confirmar a cobrança/);await assert.rejects(a.run(),/tentativa anterior/);
  assert.equal(a.eventos.filter(e=>e==='POST').length,1);assert.equal(a.eventos.includes('liberou'),false);
});
test('cobrança: dono diferente e status encerrado nunca criam nem alteram cobrança',async()=>{
  for(const op of [{outro:true},{pg:{status:'cancelado'}}]){const a=ambiente(op);await assert.rejects(a.run());assert.deepEqual(a.eventos,[]);}
  const a=ambiente({pg:{status:'pago',asaas_cobranca_id:'pay_1',forma:'cartao'}});assert.equal(await a.run(),'ok');assert.deepEqual(a.eventos,[]);
});
test('cobrança: falha ao confirmar banco não anuncia sucesso',async()=>{
  const a=ambiente({pg:{asaas_cobranca_id:'pay_1'},erroConfirmacao:true});assert.equal(await a.conferirNoAsaas(id),false);
});
test('Pix: falha no QR usa checkout seguro ou erro recuperável',async()=>{
  const a=ambiente();await assert.rejects(a.montarCobranca('sandbox',a.pg,'pix'),/carregar o Pix/);
  const c=await a.montarCobranca('sandbox',{...a.pg,link_pagamento:'https://sandbox.asaas.com/i/teste'},'pix');assert.equal(c.link,'https://sandbox.asaas.com/i/teste');
});
test('checkout: URLs externas rejeitam domínios imitadores, credenciais e protocolos inseguros',()=>{
  const {linkPagamentoSeguro:s}=carregar('src/lib/link-pagamento.ts');
  for(const url of ['https://www.asaas.com/i/a','https://sandbox.asaas.com/i/a'])assert.equal(s(url),url);
  for(const url of [null,'javascript:alert(1)','https://asaas.com.evil.test','https://user:pass@asaas.com','http://asaas.com','https://asaas.com:444/i/a'])assert.equal(s(url),null);
});
test('datas de vencimento: dia preservado no Brasil e entrada inválida recuperável',()=>{
  const {dataPorExtenso:d}=carregar('src/components/conta/resumo-plano.ts');
  assert.match(d('2026-11-09'),/9 de novembro/);assert.equal(d('inválida'),'Data indisponível');
});

function acoes(op={}) {
  const chamadas=[];
  class ErroCobranca extends Error {}
  const a=carregar('src/app/(conta)/pagar/actions.ts',{
    '@clerk/nextjs/server':{auth:async()=>({userId:op.semLogin?null:'user'})},'next/cache':{revalidatePath:()=>{}},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async(n,p)=>{chamadas.push([n,p]);if(op.rede)throw Error('rede');return {data:op.semLinha?null:{pagamento_id:id,cancelados:[]},error:op.erro??null};}})},
    '@/lib/asaas':{asaasConfigurado:()=>!op.desligado},
    '@/lib/cobranca-pagamento':{ErroCobranca,apagarCanceladasNoAsaas:async()=>{},cobrarMeuPagamento:async(pg)=>{chamadas.push(['cobrar',pg]);if(op.falha)throw new ErroCobranca('Retome este pagamento.');return {etapa:'precisa_documento',pagamentoId:pg};},situacaoMeuPagamento:async()=>{throw Error('consulta indisponível');}},
  });return {a,chamadas};
}
test('ações: exigem login, forma válida e preço positivo antes de criar pedido',async()=>{
  for(const [op,args] of [[{semLogin:true},['slim',1,'pix',null,2990]],[{},['slim',1,'boleto',null,2990]],[{},['slim',1,'pix',null,0]],[{},['slim',1,'pix',{},2990]],[{desligado:true},['slim',1,'pix',null,2990]]]){
    const {a,chamadas}=acoes(op);assert.equal((await a.pedirPlano(...args)).ok,false);assert.deepEqual(chamadas,[]);
  }
});
test('ações: vincula preço apresentado ao pedido e preserva ID na falta de documento ou falha',async()=>{
  const {a,chamadas}=acoes();const r=await a.pedirPlano('slim',1,'pix',null,2990);assert.equal(r.dados.pagamentoId,id);
  assert.deepEqual(chamadas[0],['pedir_assinatura_site',{p_plano:'slim',p_meses:1,p_valor_esperado:2990}]);
  const b=acoes({falha:true});const falha=await b.a.pedirPlano('slim',1,'pix',null,2990);assert.equal(falha.ok,false);assert.equal(falha.pagamentoId,id);
  const c=acoes();await c.a.pagarCobranca(id,'pix',null);assert.deepEqual(c.chamadas,[['cobrar',id]]);
});
test('ações: falha de rede, mudança de preço, resposta vazia e consulta falha são recuperáveis',async()=>{
  for(const op of [{rede:true},{semLinha:true},{erro:{code:'22023',message:'O preço mudou.'}}]){
    const {a,chamadas}=acoes(op);assert.equal((await a.pedirPlano('slim',1,'pix',null,2990)).ok,false);assert.equal(chamadas.some(c=>c[0]==='cobrar'),false);
  }
  assert.equal((await acoes().a.verificarCobranca(id,true)).ok,false);
});
test('leituras: indisponibilidade não se apresenta como ausência de assinatura ou pagamento',async()=>{
  const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:null,error:{message:'offline'}})};
  const d=carregar('src/lib/dados/cobranca.ts',{'@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({data:null,error:{message:'offline'}}),from:()=>q})}});
  await assert.rejects(d.minhaAssinatura());await assert.rejects(d.opcoesAssinatura());await assert.rejects(d.meuPagamento(id));
});
