const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const loja = '40000000-0000-4000-a000-000000000001';
const regiao = '40000000-0000-4000-a000-000000000002';
function form(dados) { const f = new FormData(); for (const [k,v] of Object.entries(dados)) f.set(k,v); return f; }
const base = { id: 'user_teste', versao: '2026-11-10T10:00:00Z', motivo: 'Correção solicitada', nome: 'Maria Silva', tipo_pessoa: 'pf', microrregiao_id: regiao, cidade: 'Corrente' };
const dadosLoja = { ...base, id: loja, dono_id: 'user_teste', nome: 'Loja Teste', slug: 'loja-teste', tipo: 'loja', banner_tipo: 'modelo', banner_modelo: 'liso', banner_cor: '#4B1248' };
function ambiente(arquivo, op = {}) {
  const chamadas=[];
  const db={async rpc(nome,args) { chamadas.push({nome,args}); return { data: loja, error: op.erro ?? null }; }};
  const provider={users:{async getUser() { chamadas.push({nome:'getUser'}); return { emailAddresses: op.emails ?? [] }; },async updateUser(id,args) { chamadas.push({nome:'updateUser',id,args}); if(op.clerkFalha) throw Error('segredo do provider'); }},emailAddresses:{async createEmailAddress(args){chamadas.push({nome:'createEmailAddress',args});},async updateEmailAddress(id,args){chamadas.push({nome:'updateEmailAddress',id,args});}}};
  const modulo=carregar(arquivo,{
    '@/lib/admin/auth':{async exigirAdmin(){if(op.semPermissao) throw Error('NEXT_NOT_FOUND');return {supabase:db,userId:'user_admin'};}},
    'next/cache':{revalidatePath(path){chamadas.push({nome:'revalidate',path});}},
    'next/navigation':{unstable_rethrow(e){if(e.message?.startsWith('NEXT_')) throw e;},redirect(path){throw Error('NEXT_REDIRECT:'+path);}},
    '@clerk/nextjs/server':{async clerkClient(){chamadas.push({nome:'clerkClient'});return provider;}},
  });return {modulo,chamadas};
}
const usuarios='src/app/admin/usuarios/actions.ts', lojas='src/app/admin/lojas/gestao-actions.ts';
test('gestão: todas as ações recusam falta de autorização antes de acessar dados ou credenciais', async()=>{
  for(const [arquivo,acoes] of [[usuarios,['salvarUsuario','alterarAcesso','bloquearUsuario']],[lojas,['salvarLojaAdmin','excluirLojaAdmin']]]){
    const a=ambiente(arquivo,{semPermissao:true});
    for(const nome of acoes) await assert.rejects(a.modulo[nome](null,form(base)),/NEXT_NOT_FOUND/);
    assert.deepEqual(a.chamadas,[]);
  }
});
test('usuários: normaliza o telefone e envia só os campos permitidos com versão e motivo',async()=>{
  const a=ambiente(usuarios);const r=await a.modulo.salvarUsuario(null,form({...base,whatsapp:'(89) 99999-1111',e_admin:'true',whatsapp_verificado_em:'hoje'}));
  assert.ok(r.ok);const p=a.chamadas[0].args;assert.equal(p.p_dados.whatsapp,'5589999991111');assert.equal(p.p_versao,base.versao);
  assert.equal(p.p_dados.e_admin,undefined);assert.equal(p.p_dados.whatsapp_verificado_em,undefined);
});
test('usuários: entrada inválida não grava; conflito não é anunciado como sucesso',async()=>{
  for(const v of [{id:'outro'},{microrregiao_id:'invalida'},{nome:'X'},{whatsapp:'texto 89999991111'},{motivo:'x'}]){
    const a=ambiente(usuarios);assert.ok((await a.modulo.salvarUsuario(null,form({...base,...v}))).erro);assert.deepEqual(a.chamadas,[]);
  }
  const a=ambiente(usuarios,{erro:{code:'P0001',message:'O cadastro mudou. Recarregue.'}});
  assert.match((await a.modulo.salvarUsuario(null,form(base))).erro,/Recarregue/);assert.equal(a.chamadas.length,1);
});
test('acesso: audita antes do provedor e preserva espaços da senha sem registrar o segredo',async()=>{
  const a=ambiente(usuarios);const senha='  UmaSenhaNova123  ';
  assert.ok((await a.modulo.alterarAcesso(null,form({...base,operacao:'senha',senha,repetir_senha:senha}))).ok);
  assert.equal(a.chamadas[0].args.p_acao,'senha_solicitada');
  assert.deepEqual(a.chamadas.find(c=>c.nome==='updateUser').args,{password:senha,signOutOfOtherSessions:true});
  assert.equal(JSON.stringify(a.chamadas.filter(c=>c.nome==='admin_registrar_acesso')).includes(senha),false);
});
test('acesso: e-mail exige conferência e reutiliza endereço existente',async()=>{
  const a=ambiente(usuarios,{emails:[{id:'email1',emailAddress:'maria@example.com'}]});
  const entrada={...base,operacao:'email',email:'MARIA@example.com'};
  assert.ok((await a.modulo.alterarAcesso(null,form(entrada))).erro);assert.deepEqual(a.chamadas,[]);
  assert.ok((await a.modulo.alterarAcesso(null,form({...entrada,confirmar:'on'}))).ok);
  assert.ok(a.chamadas.some(c=>c.nome==='updateEmailAddress'&&c.id==='email1'));
  assert.equal(a.chamadas.some(c=>c.nome==='createEmailAddress'),false);
});
test('acesso: falha na auditoria impede trocar credenciais; falha externa não revela detalhes',async()=>{
  const entrada={...base,operacao:'senha',senha:'Senha123456',repetir_senha:'Senha123456'};
  const a=ambiente(usuarios,{erro:{message:'falhou'}});assert.ok((await a.modulo.alterarAcesso(null,form(entrada))).erro);assert.equal(a.chamadas.length,1);
  const b=ambiente(usuarios,{clerkFalha:true});const r=await b.modulo.alterarAcesso(null,form(entrada));assert.ok(r.erro);assert.equal(r.erro.includes('segredo'),false);
  assert.ok(b.chamadas.some(c=>c.args?.p_acao==='acesso_falhou'));
});
test('lojas: edição preserva faixas de horário, meia-noite e entrega; bloqueia campos de sistema',async()=>{
  const a=ambiente(lojas);assert.ok((await a.modulo.salvarLojaAdmin(null,form({...dadosLoja,horario_seg:'08:00-12:00, 14:00-24:00',faz_entrega:'nao',formas_pagamento:'Pix, Dinheiro',status:'ativa'}))).ok);
  const d=a.chamadas[0].args.p_dados;assert.deepEqual(d.horarios.seg,[{abre:'08:00',fecha:'12:00'},{abre:'14:00',fecha:'24:00'}]);
  assert.equal(d.faz_entrega,false);assert.deepEqual(d.formas_pagamento,['Pix','Dinheiro']);assert.equal(d.status,undefined);
});
test('lojas: inválidos são recusados antes de gravar',async()=>{
  for(const v of [{slug:'../outra'},{cnpj:'11111111111111'},{horario_seg:'oito ao meio-dia'},{lat:'NaN'},{dono_id:'outra-pessoa'},{motivo:'x'}]){
    const a=ambiente(lojas);assert.ok((await a.modulo.salvarLojaAdmin(null,form({...dadosLoja,...v}))).erro);assert.deepEqual(a.chamadas,[]);
  }
});
test('lojas: exclusão exige confirmação e respeita impedimentos financeiros e de retenção',async()=>{
  const entrada={...dadosLoja,confirmacao:'loja-teste'};
  const a=ambiente(lojas);assert.ok((await a.modulo.excluirLojaAdmin(null,form(entrada))).erro);assert.deepEqual(a.chamadas,[]);
  for(const erro of [{code:'55000'},{code:'23503'}]){
    const b=ambiente(lojas,{erro});assert.ok((await b.modulo.excluirLojaAdmin(null,form({...entrada,confirmar:'on'}))).erro);assert.equal(b.chamadas.length,1);
  }
  await assert.rejects(a.modulo.excluirLojaAdmin(null,form({...entrada,confirmar:'on'})),/NEXT_REDIRECT:\/admin\/lojas\?excluida=1/);
});
test('marca: URL legada configurada não volta para os compartilhamentos',()=>{
  const anterior=process.env.NEXT_PUBLIC_SITE_URL;
  try { process.env.NEXT_PUBLIC_SITE_URL='https://ol-aqui.vercel.app/';const f=carregar('src/lib/formato.ts');assert.equal(f.urlAbsoluta('/loja/teste'),'https://mercadodaregiao.com.br/loja/teste');assert.match(decodeURIComponent(f.linkWhatsApp('5589999990000','Produto',f.SITE)),/Mercado da Região/); }
  finally { if(anterior===undefined)delete process.env.NEXT_PUBLIC_SITE_URL;else process.env.NEXT_PUBLIC_SITE_URL=anterior; }
});
test('imagens administrativas: autorização e destino são conferidos antes de gerar URL de upload',async()=>{
  const arquivo='src/app/admin/imagens-actions.ts';
  const negado=ambiente(arquivo,{semPermissao:true});
  await assert.rejects(negado.modulo.prepararFotoGestao('usuario','user_teste','avatar_url','webp'),/NEXT_NOT_FOUND/);
  assert.deepEqual(negado.chamadas,[]);
  for(const args of [['loja','../fora','logo_url','webp'],['usuario','user_teste','banner_url','webp'],['usuario','user_teste','avatar_url','svg']]){
    const a=ambiente(arquivo);assert.ok((await a.modulo.prepararFotoGestao(...args)).erro);assert.deepEqual(a.chamadas,[]);
  }
});
