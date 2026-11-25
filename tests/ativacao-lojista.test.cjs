const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup: render } = require("react-dom/server");
const { carregar } = require("./carregar.cjs");
const h = React.createElement;
const mocks = { "next/link": { __esModule: true, default: ({children, ...p}) => h("a", p, children) } };

test("cupom da URL valida formato e recusa parâmetros repetidos", () => {
  const { cupomDoLink } = carregar("src/lib/cupons.ts");
  assert.equal(cupomDoLink(" exemplo-2026 "), "EXEMPLO-2026");
  for (const v of [undefined, ["TESTE", "OUTRO"], "x", "<script>", "A".repeat(33)]) assert.equal(cupomDoLink(v), null);
});

test("loja pronta oferece anúncio, vitrine e compartilhamento manual", () => {
  const { LojaPronta } = carregar("src/components/anunciar/loja-pronta.tsx", mocks);
  const html = render(h(LojaPronta, { slug: "loja-exemplo" }));
  for (const texto of ["Criar primeiro anúncio", "Ver minha loja", "Copiar link", "Compartilhar no WhatsApp"]) assert.ok(html.includes(texto), texto);
  assert.ok(html.includes("/anunciar"));
  assert.ok(html.includes("/loja/loja-exemplo"));
});

test("local da loja só pode ser confirmado pelo dono com endereço e cidade válidos", () => {
  const { localDaLoja } = carregar("src/lib/ativacao-lojista.ts");
  const loja = { tipo: "loja", cidade: "Corrente", bairro: "Centro", endereco: "Rua Exemplo, 1" };
  assert.deepEqual(localDaLoja(loja, [{nome: "Corrente"}]), { cidade: "Corrente", bairro: "Centro" });
  for (const v of [{...loja, tipo: "pf"}, {...loja, ajudante: true}, {...loja, endereco: ""}, {...loja, cidade: "Fora"}]) assert.equal(localDaLoja(v, [{nome: "Corrente"}]), null);
});

test("confirmação de local mantém dados escondidos e oferece corrigir", () => {
  const { FormLocal } = carregar("src/components/anunciar/form-local.tsx", {
    ...mocks,
    "@/app/(conta)/anunciar/actions": { salvarLocal: async () => null },
    "./enviar": { useEnvioAnuncio: () => [null, () => {}, false, () => {}] },
    "./barra-continuar": { BarraContinuar: ({children}) => children, BotaoPasso: () => null },
  });
  const p = { id: "exemplo", editar: false, formId: "local", cidades: [{nome: "Corrente", uf: "PI"}], cidadeInicial: "Corrente", bairroInicial: "Centro" };
  const html = render(h(FormLocal, {...p, confirmarLoja: true}));
  assert.match(html, /Corrigir localização/);
  assert.match(html, /name="cidade" value="Corrente"/);
  assert.doesNotMatch(html, /<select/);
  assert.match(render(h(FormLocal, p)), /<select/);
});

test("voucher do link é sugestão sem executar resgate ao renderizar", () => {
  let chamadas = 0;
  const { Voucher } = carregar("src/app/(conta)/minha-conta/plano/voucher.tsx", {
    ...mocks, "./voucher-actions": { resgatarVoucher: async () => { chamadas++; } },
  });
  const html = render(h(Voucher, {codigos: [], codigoInicial: "EXEMPLO"}));
  assert.match(html, /value="EXEMPLO"/);
  assert.match(html, /não ativa o benefício/);
  assert.match(html, /depois do vencimento/);
  assert.equal(chamadas, 0);
});

for (const rota of ["receber-loja", "convite-loja"]) test(`${rota}: login e confirmação preservam destino; inválido e expirado têm saída`, async () => {
  let userId = null, consultou = 0, perfilCompleto = true, convite = null;
  const token = "86000000-0000-4000-a000-000000000001";
  const { default: Pagina } = carregar(`src/app/${rota}/page.tsx`, {
    ...mocks, "@clerk/nextjs/server": {auth: async () => ({userId})},
    "@clerk/nextjs": {SignOutButton: ({children}) => children},
    "next/navigation": {redirect: url => {throw Error(url)}},
    "@/lib/perfil": {garantirPerfil: async()=>{}},
    "@/lib/dados/conta": {meuPerfilEVitrine: async()=>({perfil: perfilCompleto ? {whatsapp:"exemplo",whatsapp_verificado_em:"2026-01-01"}:{} })},
    "@/lib/dados/paginas": {termosPendentes: async()=>[]},
    "@/lib/supabase/server": {createClient: async()=>({rpc:()=>{consultou++;return {maybeSingle:async()=>({data:convite,error:null})}}})},
    "./form-receber": {FormReceberLoja: ()=>h("p",null,"Aceitar convite")},
    "./form-aceitar": {FormAceitarConvite: ()=>h("p",null,"Aceitar convite")},
  });
  const pagina = codigo => Pagina({searchParams:Promise.resolve({codigo})});
  let html = render(await pagina(token));
  assert.ok(html.includes(encodeURIComponent(`/${rota}?codigo=${token}`)));
  assert.match(html, /href="\/ajuda"/);
  assert.match(html, /href="\/"/);
  assert.equal(consultou,0);
  assert.doesNotMatch(render(await pagina("ruim")), /Entrar ou criar conta/);
  userId="dono"; perfilCompleto=false;
  await assert.rejects(pagina(token), new RegExp(`completar-perfil.*${token}`));
  perfilCompleto=true;
  html=render(await pagina(token));
  assert.match(html,/venceu, foi cancelado/);
  assert.match(html,/Entrar com outra conta/);
  convite={nome:"Loja Exemplo",cidade:"Corrente",prontos:2,ja_vende:false,aceito:false};
  html=render(await pagina(token));
  assert.match(html,/Loja Exemplo/);
  assert.match(html,/Aceitar convite/);
});

test("Slim vigente/vencido, Full e promoção mantêm cobrança pendente e escolha explícita", async () => {
  const pagamentoId="87000000-0000-4000-a000-000000000001";
  for (const codigo of ["slim", "full", "promocional"]) for (const vencido of [false,true]) {
    const vitrine={id:"vitrine",tipo:"loja",plano:codigo,plano_expira_em:vencido?"2020-01-01":"2099-01-01"};
    const plano={codigo,nome:codigo,preco_centavos:codigo==="promocional"?0:100,limite_anuncios:5,acesso_radar:false};
    const cobranca={id:pagamentoId,tipo:"assinatura",status:"pendente",valor_centavos:100,plano_codigo:"full",criado_em:"2026-11-01"};
    const db={from:tabela=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:()=>q,data:tabela==="pagamentos"?[cobranca]:[plano],count:tabela==="pagamentos"?1:0,error:null};return q;},rpc:async()=>({data:[],error:null})};
    let escolhas=0;
    const {default:Pagina}=carregar("src/app/(conta)/minha-conta/plano/page.tsx",{
      ...mocks,"@clerk/nextjs/server":{auth:async()=>({userId:"dono"})},
      "@/lib/dados/conta":{meuPerfilEVitrine:async()=>({vitrine,plano,perfil:{},limite:5,ativos:0,rascunhos:0}),lerAcessoPromocional:async()=>codigo==="promocional"?{ativado_em:"2026-11-01",vence_em:"2099-12-01"}:null},
      "@/lib/supabase/server":{createClient:async()=>db},
      "@/lib/asaas":{asaasConfigurado:()=>true,ambienteAsaas:async()=>"sandbox"},
      "@/lib/cobranca-destaque":{precisaDocumento:async()=>false},
      "@/lib/dados/cobranca":{minhaAssinatura:async()=>({vitrine_id:vitrine.id,situacao:vencido?"vencida":"ativa"}),opcoesAssinatura:async()=>[],meuPagamento:async()=>cobranca},
      "@/lib/dados/radar":{minhaCortesiaRadar:async()=>null},
      "@/components/cobranca/escolher-plano":{EscolherPlano:()=>{escolhas++;return h("p",null,"Escolha explícita");}},
      "./voucher":{Voucher:()=>null},
    });
    const html=render(await Pagina({searchParams:Promise.resolve({})}));
    assert.match(html,/Retomar pagamento/);
    assert.equal(escolhas,codigo==="promocional"?0:1);
    escolhas=0;
    const retorno=render(await Pagina({searchParams:Promise.resolve({p:pagamentoId})}));
    assert.match(retorno,/Escolha explícita/);
    assert.match(retorno,/Pendente/);
    assert.equal(escolhas,1);
    assert.equal(cobranca.status,"pendente");
  }
});
