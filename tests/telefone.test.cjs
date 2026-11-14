const {test}=require('node:test');
const assert=require('node:assert/strict');
const {carregar}=require('./carregar.cjs');

const t=()=>carregar('src/lib/telefone.ts');
const celular=(v,ddd)=>t().normalizarTelefone(v,{ddd}).numero??null;
const erro=(v,opcoes)=>t().normalizarTelefone(v,opcoes).erro;

test('celular com DDD, em qualquer formato, vira 55 + DDD + 9 dígitos',()=>{
 const casos=[
  ['(89) 99999-0000','5589999990000'],['89 99999 0000','5589999990000'],['89999990000','5589999990000'],
  ['89 99999-0000','5589999990000'],['(89)99999-0000','5589999990000'],['(89) 99999.0000','5589999990000'],
  ['+55 (89) 99999-0000','5589999990000'],['+55 89 99999-0000','5589999990000'],['+5589999990000','5589999990000'],
  ['5589999990000','5589999990000'],['558999990000','5589999990000'],['089 99999-0000','5589999990000'],
  ['99 99999-0000','5599999990000'],['11 98765-4321','5511987654321'],['+55 (55) 99999-0001','5555999990001'],
  ['55 99999-0000','5555999990000'],['55999990001','5555999990001'],
 ];
 for(const [entrada,esperado] of casos) assert.equal(celular(entrada),esperado,entrada);
});

test('celular de 8 dígitos começando com 6 a 9 ganha o 9 na frente',()=>{
 assert.equal(celular('(89) 9999-0000'),'5589999990000');
 assert.equal(celular('89 9999 0000'),'5589999990000');
 assert.equal(celular('89 6999-0000'),'5589969990000');
 assert.equal(celular('(89) 8888-7777'),'5589988887777');
 assert.equal(celular('+55 (89) 9999-0000'),'5589999990000');
});

test('sem DDD no número usa o DDD da região; sem região pede o DDD',()=>{
 assert.equal(celular('99999-0000','89'),'5589999990000');
 assert.equal(celular('9999-0000','89'),'5589999990000');
 assert.equal(celular('(89) 99999-0000','77'),'5589999990000','DDD digitado vale mesmo com outra região');
 assert.equal(celular('+55 99999-0001','89'),'5589999990001');
 assert.equal(celular('99999-0000',null),null);
 assert.equal(erro('99999-0000'),'sem_ddd');
 assert.equal(erro('9999-0000',{ddd:null}),'sem_ddd');
 assert.equal(erro('+55 99999-0001'),'sem_ddd');
});

test('fixo só entra quando a tela aceita',()=>{
 assert.equal(erro('(89) 3333-0000'),'invalido');
 assert.equal(erro('89 33330000'),'invalido');
 assert.equal(t().normalizarTelefone('(89) 3333-0000',{aceitaFixo:true}).numero,'558933330000');
 assert.equal(t().normalizarTelefone('89 33330000',{aceitaFixo:true}).numero,'558933330000');
 assert.equal(t().normalizarTelefone('+55 (89) 3333-0000',{aceitaFixo:true}).numero,'558933330000');
 assert.equal(t().normalizarTelefone('(89) 6333-0000',{aceitaFixo:true}).numero,'5589963330000','fixo com 6 é celular sem o 9');
 assert.equal(erro('(89) 1333-0000',{aceitaFixo:true}),'invalido');
 assert.equal(t().normalizarTelefone('(89) 1333-0000',{aceitaFixo:true}).numero,undefined);
});

test('DDD que não existe no Brasil é recusado',()=>{
 for(const ddd of ['00','10','20','23','25','26','29','30','36','39','40','50','52','56','57','58','59','60','70','72','76','78','80','90'])
  assert.equal(erro(`${ddd} 99999-0000`),'invalido',ddd);
 assert.equal(erro('(10) 99999-0000'),'invalido');
 assert.equal(erro('+55 (20) 99999-0000'),'invalido');
 assert.equal(erro('99999-0000',{ddd:'10'}),'invalido','DDD da região inválido não passa');
});

test('DDDs válidos de borda passam',()=>{
 for(const ddd of ['11','19','21','22','24','27','28','31','35','37','38','41','49','51','53','54','55','61','69','71','73','74','75','77','79','81','89','91','99'])
  assert.ok(celular(`${ddd} 99999-0000`), ddd);
});

test('entradas inválidas, vazias ou com lixo não viram número',()=>{
 for(const v of [null,undefined,'','   ',123,{},[],'telefone 89999990001','89 99999-0000 ramal 2','(89) abc','9'.repeat(31),'()'])
  assert.equal(celular(v,'89'),null,String(v));
 for(const v of ['+12125551234','++55 (89) 99999-0001','+5 58999990001','55+89 99999-0001','+1 2999999999','+55 (89) 99999-00012'])
  assert.equal(celular(v,'89'),null,v);
 for(const v of ['(55) 99999-00012','(55) 99999-000123','(89) 99999-00012','89 999999-00000','89 9999999999','89 1999-0000','89 19999-0000','2 99999-0000'])
  assert.equal(celular(v,'89'),null,v);
});

test('celular do banco é 55 + DDD + 9 dígitos começando com 9; fixo continua a forma do banco',()=>{
 for(const v of ['(89) 99999-0000','89 9999-0000'])assert.match(celular(v,'89'),/^55[1-9][0-9]9[0-9]{8}$/);
 assert.match(t().normalizarTelefone('(89) 3333-0000',{aceitaFixo:true}).numero,/^55[1-9][0-9][2-5][0-9]{7}$/);
});

test('mostra sempre como (89) 99999-0000 (ou fixo)',()=>{
 assert.equal(t().telefone('5589999990000'),'(89) 99999-0000');
 assert.equal(t().telefone('558933330000'),'(89) 3333-0000');
 assert.equal(t().telefone('5555999990001'),'(55) 99999-0001');
 assert.equal(t().telefone('55999990000'),'(55) 99999-0000');
 assert.equal(t().telefone('89999990000'),'(89) 99999-0000');
 assert.equal(t().telefone('123'),'123');
 assert.equal(t().telefone(null),'');
 assert.equal(t().telefone(t().normalizarTelefone('(89) 99999-0000',{ddd:'89'}).numero),'(89) 99999-0000');
});

test('DDD do número guardado e exemplo do campo',()=>{
 assert.equal(t().dddDoNumero('5589999990000'),'89');
 assert.equal(t().dddDoNumero('5555999990001'),'55');
 assert.equal(t().dddDoNumero('abc'),null);
 assert.equal(t().dddDoNumero(null),null);
 assert.equal(t().exemploTelefone('89'),'(89) 99999-0000');
 assert.equal(t().exemploTelefone(null),'(DD) 99999-0000');
 assert.equal(t().exemploTelefone('00'),'(DD) 99999-0000');
});

test('formato.ts e servico.ts usam o mesmo normalizador',()=>{
 const f=carregar('src/lib/formato.ts');
 assert.equal(f.whatsappDigitado('(89) 99999-0000'),'5589999990000');
 assert.equal(f.whatsappDigitado('9999-0000','89'),'5589999990000');
 assert.equal(f.whatsappDigitado('9999-0000'),null);
 assert.equal(f.telefoneComercialDigitado('(89) 3333-0000'),'558933330000');
 assert.equal(f.telefoneComercialDigitado('33330000'),null);
 assert.equal(f.telefoneComercialDigitado('33330000','89'),'558933330000');
 assert.equal(f.telefone('5589999990000'),'(89) 99999-0000');
});
