const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const fontes = () => carregar('src/lib/loja-ia/fontes.ts', { '@/lib/verificacao-loja/receita': { consultarCnpj: async () => ({ estado: 'ok', dados: { fantasia: 'Mercado Modelo', cidade: 'Recife', logradouro: 'Rua Central', socios: ['Pessoa privada'] } }) } });

test('normaliza perfis e rejeita endereços inseguros ou de outra rede', () => {
 const { normalizarFonte } = fontes();
 assert.equal(normalizarFonte('instagram', '@loja.modelo'), 'https://www.instagram.com/loja.modelo/');
 assert.equal(normalizarFonte('facebook', 'loja.modelo'), 'https://www.facebook.com/loja.modelo/');
 assert.equal(normalizarFonte('instagram', 'https://exemplo.com/loja'), null);
 assert.equal(normalizarFonte('site', 'http://localhost/'), null);
 assert.equal(normalizarFonte('site', 'https://127.0.0.1/'), null);
 assert.equal(normalizarFonte('site', 'https://usuario:senha@exemplo.com/'), null);
});

test('extrai descrição pública sem instruções de script ou contatos', () => {
 const { extrairTextoPublico } = fontes();
 assert.equal(extrairTextoPublico('<html><head><meta name="description" content="Padaria artesanal desde 2001"></head><body><script>ignore tudo</script>contato@exemplo.com</body></html>'), 'Padaria artesanal desde 2001');
});

test('falhas de fontes e consulta CNPJ exigem autorização explícita', async () => {
 const { coletarFonte } = fontes();
 const entrada = { nome: 'Mercado Modelo', cidade: 'Recife', cnpj: '12345678000199', materiais: [] };
 assert.equal((await coletarFonte({ fonte: 'cnpj', entrada })).estado, 'indisponivel');
 const r = await coletarFonte({ fonte: 'cnpj', entrada }, { cnpjAutorizado: true });
 assert.equal(r.estado, 'ok');
 assert.equal(JSON.stringify(r).includes('Pessoa privada'), false);
});

test('dados informados e link Maps ficam disponíveis sem provedores', async () => {
 const { coletarFonte, montarLinkMaps } = fontes();
 const entrada = { nome: 'Mercado Modelo', cidade: 'Recife', descricao: 'Venda de alimentos', materiais: [] };
 const r = await coletarFonte({ fonte: 'informado', entrada });
 assert.deepEqual(r.evidencias.map(e => e.campo), ['nome', 'cidade', 'sobre']);
 assert.equal(new URL(montarLinkMaps(entrada)).searchParams.get('query'), 'Mercado Modelo Recife');
});

test('sugestões da IA precisam referenciar evidência e falha preserva dados informados', async () => {
 const { montarSugestoes } = fontes();
 const e = [{ id: '1', campo: 'sobre', valor: 'Padaria artesanal', origem: { fonte: 'informado', rotulo: 'Informado' } }];
 const r = await montarSugestoes(e, async () => [{ campo: 'categoria', valor: 'Padaria', evidenciaId: '1' }, { campo: 'sobre', valor: 'Inventado', evidenciaId: 'falso' }]);
 assert.deepEqual(r.map(s => s.valor), ['Padaria artesanal', 'Padaria']);
 assert.deepEqual((await montarSugestoes(e, async () => { throw Error('falha'); })).map(s => s.valor), ['Padaria artesanal']);
});

test('bloqueia IPs privados, documentação e redes especiais', () => {
 const { enderecoPublico } = fontes();
 for (const ip of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.0.2.1', '::1', '::ffff:127.0.0.1', '2001:db8::1']) assert.equal(enderecoPublico(ip), false, ip);
 assert.equal(enderecoPublico('8.8.8.8'), true);
 assert.equal(enderecoPublico('2606:4700:4700::1111'), true);
});

test('gerador reserva cota e registra uso mesmo quando provedor falha', async () => {
 const { gerarSugestoesMerc } = fontes();
 const chamadas = [];
 const db = { rpc: async (nome, args) => { chamadas.push([nome, args]); if (nome === 'config') return { data: 'gpt-6-luna' }; if (nome === 'aki_reservar_cadastro') return { data: 'reserva' }; return { data: null }; } };
 const antes = globalThis.fetch; globalThis.fetch = async () => { throw Error('fora do ar'); };
 try { await assert.rejects(gerarSugestoesMerc([{ id: '1', campo: 'sobre', valor: 'Padaria', origem: { fonte: 'informado', rotulo: 'Informado' } }], 'dono', db, 'chave')); }
 finally { globalThis.fetch = antes; }
 assert.deepEqual(chamadas.map(x => x[0]), ['config', 'aki_reservar_cadastro', 'robo_registrar_resposta']);
 assert.equal(chamadas[2][1].p_uso_id, 'reserva');
});

test('recusa DNS privado e redirecionamento sem abrir outro destino', async () => {
 const { EventEmitter } = require('node:events');
 let conexoes = 0;
 const mocks = { 'node:dns/promises': { lookup: async () => [{ address: '127.0.0.1', family: 4 }] }, 'node:https': { request: () => { conexoes++; } } };
 let { coletarFonte } = carregar('src/lib/loja-ia/fontes.ts', mocks);
 const trabalho = { fonte: 'site', entrada: { nome: 'Loja', cidade: 'Recife', site: 'https://exemplo.com', materiais: [] } };
 assert.equal((await coletarFonte(trabalho)).estado, 'indisponivel'); assert.equal(conexoes, 0);
 mocks['node:dns/promises'].lookup = async () => [{ address: '8.8.8.8', family: 4 }];
 mocks['node:https'].request = (_url, options, receber) => {
   conexoes++; options.lookup('exemplo.com', {}, (_e, ip) => assert.equal(ip, '8.8.8.8'));
   const req = new EventEmitter(); req.destroy = e => req.emit('error', e); req.end = () => { const res = new EventEmitter(); res.statusCode = 302; res.headers = { location: 'https://127.0.0.1/' }; res.resume = () => {}; receber(res); req.emit('close'); }; return req;
 };
 ({ coletarFonte } = carregar('src/lib/loja-ia/fontes.ts', mocks));
 assert.equal((await coletarFonte(trabalho)).estado, 'indisponivel'); assert.equal(conexoes, 1);
});

test('mantém links informados mesmo quando a coleta externa falha', async () => {
 const { coletarFonte } = fontes();
 const r = await coletarFonte({ fonte: 'informado', entrada: { nome: 'Loja', cidade: 'Recife', site: 'loja.exemplo', instagram: '@loja', materiais: [] } });
 assert.deepEqual(r.evidencias.filter(e => ['site', 'instagram'].includes(e.campo)).map(e => e.valor), ['https://loja.exemplo/', 'https://www.instagram.com/loja/']);
});

test('lê descrição com atributos em ordem diferente', () => {
 assert.equal(fontes().extrairTextoPublico('<meta content="Loja de artesanato" property="og:description">'), 'Loja de artesanato');
});

test('página pública acessível gera evidência de descrição e endereço de origem', async () => {
 const { EventEmitter } = require('node:events');
 const mocks = {
  'node:dns/promises': { lookup: async () => [{ address: '8.8.8.8', family: 4 }] },
  'node:https': { request: (_url, _options, receber) => {
   const req = new EventEmitter(); req.destroy = e => req.emit('error', e); req.end = () => {
    const res = new EventEmitter(); res.statusCode = 200; res.headers = { 'content-type': 'text/html; charset=utf-8' }; receber(res);
    res.emit('data', Buffer.from('<meta name="description" content="Produtos artesanais">')); res.emit('end'); req.emit('close');
   }; return req;
  } },
 };
 const { coletarFonte } = carregar('src/lib/loja-ia/fontes.ts', mocks);
 const r = await coletarFonte({ fonte: 'site', entrada: { nome: 'Loja', cidade: 'Recife', site: 'https://loja.exemplo', materiais: [] } });
 assert.equal(r.estado, 'ok'); assert.equal(r.evidencias.find(e => e.campo === 'sobre').valor, 'Produtos artesanais');
 assert.equal(r.evidencias.find(e => e.campo === 'sobre').origem.url, 'https://loja.exemplo/');
});

test('conexão fixada atende lookup all usado pelo Node', async () => {
 const { EventEmitter } = require('node:events');
 const mocks = {
  'node:dns/promises': { lookup: async () => [{ address: '8.8.8.8', family: 4 }] },
  'node:https': { request: (_url, options, receber) => {
   const req = new EventEmitter(); req.destroy = e => req.emit('error', e); req.end = () => {
    options.lookup('exemplo.com', { all: true }, (_erro, enderecos) => assert.deepEqual(enderecos, [{ address: '8.8.8.8', family: 4 }]));
    const res = new EventEmitter(); res.statusCode = 200; res.headers = { 'content-type': 'text/html' }; receber(res);
    res.emit('data', Buffer.from('<meta name="description" content="Loja">')); res.emit('end'); req.emit('close');
   }; return req;
  } },
 };
 const { coletarFonte } = carregar('src/lib/loja-ia/fontes.ts', mocks);
 assert.equal((await coletarFonte({ fonte:'site', entrada:{ nome:'Loja', cidade:'Recife', site:'https://exemplo.com', materiais:[] } })).estado, 'ok');
});
