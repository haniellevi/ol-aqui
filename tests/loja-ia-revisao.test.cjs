const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');
const nomes = ['nome','cidade','slug','categoria','sobre','whatsapp','endereco','site','instagram','logo','capa'];
const campos = Object.fromEntries(nomes.map(c => [c, { valor: null, editado: false, origem: null, sugestao: null }]));
campos.nome = { valor:'Loja', editado:false, origem:{fonte:'informado',rotulo:'Informado pelo lojista'}, sugestao:{valor:'Nova Loja',origem:{fonte:'site',rotulo:'Site'}} };
const rascunho = { id:'r', revisao:1, estado:'pronto', campos, entrada: { nome:'Loja', cidade:'Recife', materiais:['imagem'], consultarWhatsapp:false, avisarWhatsapp:false }, fontes:{ site:{estado:'indisponivel',motivo:'Página indisponível'} }, vitrineId:null };
const props = { rascunho, cidades:[{nome:'Recife',uf:'PE'}], whatsappInicial:'', avisoTeste:null, imagens:{imagem:'/imagem'}, linkMaps:'https://www.google.com/maps/search/?api=1&query=Loja', salvar:async()=>rascunho, retentar:async()=>rascunho, confirmar:async()=>null };

test('exibe todos campos, origem, sugestão e falha com opção de retentar', () => {
 const { RevisaoLojaIa } = carregar('src/components/anunciar/revisao-loja-ia.tsx');
 const html = renderToStaticMarkup(React.createElement(RevisaoLojaIa, props));
 for (const texto of ['Nome da loja','Cidade da loja','Link da sua loja','Categoria da loja','Descrição da loja','WhatsApp da loja','Endereço','Site','Instagram','Logo','Capa','Informado pelo lojista','Nova Loja','Página indisponível','Tentar novamente','Criar minha loja']) assert.ok(html.includes(texto), texto);
 assert.equal((html.match(/Criar minha loja/g) || []).length, 1);
});

test('envia apenas alterações explícitas, incluindo limpeza', () => {
 const { edicoesPendentes, valoresIniciais } = carregar('src/components/anunciar/revisao-loja-ia.tsx');
 const iniciais = valoresIniciais(rascunho, '');
 assert.deepEqual(edicoesPendentes(iniciais, iniciais), {});
 assert.deepEqual(edicoesPendentes(iniciais, { ...iniciais, nome:'', site:'https://loja.exemplo' }), { nome:null, site:'https://loja.exemplo' });
});

test('monta formulário de confirmação com nomes atuais e imagens escolhidas', () => {
 const { valoresIniciais, formularioRevisao } = carregar('src/components/anunciar/revisao-loja-ia.tsx');
 const f = formularioRevisao({ ...valoresIniciais(rascunho, ''), categoria:'Mercado', logo:'imagem', capa:'' });
 assert.equal(f.get('nome_loja'), 'Loja'); assert.equal(f.get('categoria_loja'), 'Mercado'); assert.equal(f.get('logo'), 'imagem'); assert.equal(f.get('capa'), '');
});

test('campo WhatsApp limpo continua vazio após atualização e não volta ao inicial', () => {
 const { valoresIniciais } = carregar('src/components/anunciar/revisao-loja-ia.tsx');
 const r = { ...rascunho, campos: { ...campos, whatsapp: { valor:null, editado:true, origem:null, sugestao:null } } };
 assert.equal(valoresIniciais(r, '11999999999').whatsapp, '');
});

test('mostra fonte pendente com retentativa bloqueada enquanto consulta roda', () => {
 const { RevisaoLojaIa } = carregar('src/components/anunciar/revisao-loja-ia.tsx');
 const html = renderToStaticMarkup(React.createElement(RevisaoLojaIa, { ...props, rascunho: { ...rascunho, fontes: { site: { estado:'pendente' } } } }));
 assert.match(html, /Consulta em andamento/);
 assert.match(html, /disabled=""[^>]*>.*Tentar novamente/);
});

test('oferece imagens geradas além dos arquivos enviados', () => {
 const { RevisaoLojaIa } = carregar('src/components/anunciar/revisao-loja-ia.tsx');
 const html = renderToStaticMarkup(React.createElement(RevisaoLojaIa, { ...props, imagens:{ imagem:'/imagem', gerada:'/gerada' } }));
 assert.match(html, /value="gerada"/);
});

test('oferece referência pública de origem e rejeita URL insegura', () => {
 const { RevisaoLojaIa } = carregar('src/components/anunciar/revisao-loja-ia.tsx');
 const c = { ...campos, nome:{...campos.nome, origem:{fonte:'site',rotulo:'Site',url:'https://loja.exemplo/'}} };
 let html = renderToStaticMarkup(React.createElement(RevisaoLojaIa, { ...props, rascunho:{...rascunho,campos:c} }));
 assert.match(html, /href="https:\/\/loja\.exemplo\//);
 c.nome.origem.url = 'javascript:alert(1)';
 html = renderToStaticMarkup(React.createElement(RevisaoLojaIa, { ...props, rascunho:{...rascunho,campos:c} }));
 assert.doesNotMatch(html, /href="javascript:/);
});
