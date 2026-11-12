const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const { formatarNome } = carregar('src/lib/formatar-nome.ts');

const casos = [
  // Caixa alta vira cada palavra com a primeira maiúscula
  ['TESTE', 'Teste'],
  ['RVS TECNOLOGIA', 'RVS Tecnologia'], // sigla sem vogal continua maiúscula
  ['GELADEIRA BRASTEMP USADA', 'Geladeira Brastemp Usada'],
  ['CASA DA ANA', 'Casa da Ana'],
  ['PÃES E DOCES DO ZÉ', 'Pães e Doces do Zé'],
  ['LOJA DAS FLORES DOS SANTOS', 'Loja das Flores dos Santos'],
  ['DE CASA PARA VOCÊ', 'De Casa Para Você'], // ligação na 1ª palavra fica maiúscula
  ['ÓTICA SÃO JOSÉ', 'Ótica São José'],
  ['JOÃO DA SILVA', 'João da Silva'],
  ['AUTO-PEÇAS CORRENTE', 'Auto-Peças Corrente'],
  ['(NOVO) FOGÃO 4 BOCAS', '(Novo) Fogão 4 Bocas'],
  ['TV LG 32 POLEGADAS', 'TV LG 32 Polegadas'],
  ['CHAVEIRO DIA E NOITE', 'Chaveiro Dia e Noite'],
  ['COLEÇÃO PARTE II', 'Coleção Parte II'],
  ['ÁGUA D\'ÁGUA', 'Água D\'água'],
  // Números e unidades ficam como foram digitados
  ['MOTO HONDA CG 160CC 2015', 'Moto Honda CG 160CC 2015'],
  ['MOTO TITAN 160cc', 'Moto Titan 160cc'],
  ['RAÇÃO 15KG', 'Ração 15KG'],
  ['PS5 COM 2 CONTROLES', 'PS5 com 2 Controles'],
  ['IPHONE 11 PRO MAX 128GB', 'Iphone 11 Pro Max 128GB'],
  // "Quase todo" em caixa alta (80% ou mais das letras)
  ['GELADEIRA BRASTEMP FROST FREe', 'Geladeira Brastemp Frost Free'],
  // Misturado fica como está (respeita o que a loja escreveu de propósito)
  ['Loja RVS', 'Loja RVS'],
  ['iPhone 11', 'iPhone 11'],
  ['Geladeira Brastemp K3X', 'Geladeira Brastemp K3X'],
  ['TESTE de moto', 'TESTE de moto'],
  ['McDonald\'s', 'McDonald\'s'],
  // Tudo minúsculo: só a primeira letra
  ['geladeira usada', 'Geladeira usada'],
  ['rvs tecnologia', 'Rvs tecnologia'],
  // Espaços e vazios
  ['  CASA   DA  ANA  ', 'Casa da Ana'],
  ['Loja  RVS ', 'Loja RVS'],
  ['', ''],
  ['   ', ''],
  [null, ''],
  [undefined, ''],
  ['123', '123'],
  ['2015', '2015'],
  ['A', 'A'],
  ['PIZZA NA BRASA', 'Pizza na Brasa'],
  ['CASA NO CAMPO COM PISCINA EM CORRENTE', 'Casa no Campo com Piscina em Corrente'],
  ['EM CASA COM VOCÊ', 'Em Casa com Você'], // 1ª palavra sempre maiúscula
  // Siglas de empresa e abreviações
  ['LOJA JOÃO LTDA', 'Loja João LTDA'],
  ['MERCADO DO ZÉ ME', 'Mercado do Zé Me'], // "ME" também é pronome: não vira sigla
  ['VENDO ME DESFAZENDO', 'Vendo Me Desfazendo'],
  ['SA MODAS', 'Sa Modas'],
  ['INDÚSTRIA X S.A.', 'Indústria X S.A.'],
  ['ONG AMIGOS DO BEM', 'ONG Amigos do Bem'],
  ['LÂMPADA LED USB', 'Lâmpada LED USB'],
  ['DR. JOÃO DENTISTA', 'Dr. João Dentista'],
  ['CORRENTE PI', 'Corrente PI'],
  ['VI MODAS', 'VI Modas'], // limite conhecido: "VI" parece algarismo romano
];

for (const [entrada, esperado] of casos) {
  test(`formatarNome(${JSON.stringify(entrada)}) → ${JSON.stringify(esperado)}`, () => {
    assert.equal(formatarNome(entrada), esperado);
  });
}

test('formatar duas vezes dá o mesmo resultado', () => {
  for (const [entrada] of casos) assert.equal(formatarNome(formatarNome(entrada)), formatarNome(entrada));
});

const { avisoComoVaiAparecer } = carregar('src/lib/formatar-nome.ts');

test('aviso "Vai aparecer assim" só quando muda o que aparece', () => {
  assert.equal(avisoComoVaiAparecer('RVS TECNOLOGIA'), 'Vai aparecer assim: “RVS Tecnologia”.');
  assert.equal(avisoComoVaiAparecer('TESTE'), 'Vai aparecer assim: “Teste”.');
  assert.equal(avisoComoVaiAparecer('Loja RVS'), undefined);
  assert.equal(avisoComoVaiAparecer('  Loja   RVS '), undefined); // espaço sobrando não é motivo de aviso
  assert.equal(avisoComoVaiAparecer(''), undefined);
  assert.equal(avisoComoVaiAparecer(null), undefined);
});
