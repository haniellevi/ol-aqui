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

test('gera capa e salva a escolha no rascunho', async () => {
 const states = []; let cursor = 0;
 const react = { ...React, useState: (initial) => { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], v => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; } };
 const { RevisaoLojaIa } = carregar('src/components/anunciar/revisao-loja-ia.tsx', { react });
 const chamadas = [];
 const p = { ...props, gerarCapa:async()=>({id:'gerada',url:'/gerada'}), salvar:async(_id,_rev,e)=>{ chamadas.push(e); return { ...rascunho, revisao:2, campos:{...campos,capa:{...campos.capa,valor:e.capa,editado:true}} }; } };
 const render = () => { cursor = 0; return RevisaoLojaIa(p); };
 function achar(elemento, texto) { if (!elemento || typeof elemento !== 'object') return null; if (elemento.props?.children === texto && elemento.props?.onClick) return elemento; for (const filho of React.Children.toArray(elemento.props?.children)) { const achou = achar(filho, texto); if (achou) return achou; } return null; }
 const botao = achar(render(), 'Gerar capa'); assert.ok(botao); botao.props.onClick();
 await new Promise(resolve => setImmediate(resolve));
 assert.deepEqual(chamadas, [{capa:'gerada'}]);
 const html = renderToStaticMarkup(render()); assert.match(html, /value="gerada" selected=""/);
});

test('atualiza andamento somente depois de salvar a edição pendente', async () => {
 const states = []; let cursor = 0;
 const react = { ...React, useState: initial => { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], v => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; } };
 const { RevisaoLojaIa } = carregar('src/components/anunciar/revisao-loja-ia.tsx', { react });
 const eventos = []; const anterior = global.window; global.window = { location:{ reload:()=>eventos.push('atualizou') } };
 try {
  const p = { ...props, rascunho:{...rascunho,estado:'processando'}, salvar:async(_id,_rev,e)=>{ eventos.push(e); return { ...rascunho,revisao:2, campos:{...campos,nome:{...campos.nome,valor:e.nome,editado:true}} }; } };
  const render = () => { cursor=0; return RevisaoLojaIa(p); };
  function achar(el, pred) { if (!el || typeof el !== 'object') return null; if (pred(el)) return el; for (const filho of React.Children.toArray(el.props?.children)) { const achou=achar(filho,pred); if (achou) return achou; } return null; }
  achar(render(), el=>el.props?.name==='nome_loja' && !!el.props.onChange).props.onChange({target:{value:'Nome corrigido'}});
  achar(render(), el=>el.props?.children==='Atualizar andamento').props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(eventos,[{nome:'Nome corrigido'},'atualizou']);
 } finally { global.window = anterior; }
});
