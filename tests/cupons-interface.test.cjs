const assert = require('node:assert/strict');
const { test } = require('node:test');
const { carregar } = require('./carregar.cjs');

function form(campos) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

const respostas = (erro) => ({ data: null, error: erro });

function admin(arquivo, supabase, master = true) {
  const acesso = async () => ({ supabase, userId: 'admin' });
  return carregar(`src/app/admin/planos/${arquivo}.ts`, {
    '@/lib/admin/auth': {
      exigirAdmin: acesso,
      exigirSuperAdmin: master ? acesso : async () => { throw new Error('Acesso restrito.'); },
    },
    'next/cache': { revalidatePath() {} },
  });
}

test('cria cupom com código normalizado, dias inteiros e prazo opcional', async () => {
  const chamadas = [];
  const { salvarVoucher } = admin('voucher-actions', { rpc: async (...args) => { chamadas.push(args); return respostas(null); } });
  assert.ok((await salvarVoucher(null, form({ codigo: ' novo-2026 ', duracao_dias: '14' }))).ok);
  assert.deepEqual(chamadas, [['voucher_admin_criar', { p_codigo: 'NOVO-2026', p_duracao_dias: 14, p_valido_ate: null }]]);
  for (const duracao_dias of ['0', '1.5', '1e3', '2147483648', '']) {
    assert.match((await salvarVoucher(null, form({ codigo: 'NOVO', duracao_dias }))).erro, /duração/);
  }
  assert.match((await salvarVoucher(null, form({ codigo: 'a!', duracao_dias: '14' }))).erro, /código/);
  assert.equal(chamadas.length, 1);
});

const campanhaId = '7d1352f2-4904-4107-af0f-146619c30d58';

function consultaCampanha(resposta) {
  return (tabela) => {
    assert.equal(tabela, 'voucher_campanhas');
    return { select: () => ({ eq: (campo, valor) => {
      assert.deepEqual([campo, valor], ['id', campanhaId]);
      return { maybeSingle: async () => resposta };
    } }) };
  };
}

test('salva duração e status de campanha legada preservando o instante exibido como dia', async () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { FormVoucher } = carregar('src/app/admin/planos/vouchers.tsx', {
    './voucher-actions': { salvarVoucher: async () => null },
  });
  const legado = '2025-12-31T15:00:00.123456+00:00';
  const html = renderToStaticMarkup(React.createElement(FormVoucher, {
    campanha: { id: campanhaId, codigo: 'LEGADO', valido_ate: legado, duracao_dias: 90, ativo: true },
  }));
  const dia = html.match(/<input(?=[^>]*name="validade")[^>]*value="([^"]+)"/)?.[1];
  assert.equal(dia, '2025-12-31');

  const chamadas = [];
  const { salvarVoucher } = admin('voucher-actions', {
    from: consultaCampanha({ data: { valido_ate: legado }, error: null }),
    rpc: async (...args) => { chamadas.push(args); return respostas(null); },
  });
  assert.ok((await salvarVoucher(null, form({ id: campanhaId, duracao_dias: '2', validade: dia }))).ok);
  assert.deepEqual(chamadas, [['voucher_admin_configurar', {
    p_id: campanhaId, p_duracao_dias: 2, p_ativo: false, p_valido_ate: legado,
  }]]);
});

test('muda a data de cupom para o fim do novo dia em São Paulo, aceita prazo passado e pode remover prazo', async () => {
  const chamadas = [];
  const { salvarVoucher } = admin('voucher-actions', {
    from: consultaCampanha({ data: { valido_ate: '2025-12-30T15:00:00Z' }, error: null }),
    rpc: async (...args) => { chamadas.push(args); return respostas(null); },
  });
  assert.ok((await salvarVoucher(null, form({ id: campanhaId, duracao_dias: '2', validade: '2025-12-31', ativo: 'on' }))).ok);
  assert.ok((await salvarVoucher(null, form({ id: campanhaId, duracao_dias: '2', validade: '' }))).ok);
  assert.deepEqual(chamadas, [
    ['voucher_admin_configurar', { p_id: campanhaId, p_duracao_dias: 2, p_ativo: true, p_valido_ate: '2026-01-01T03:00:00.000Z' }],
    ['voucher_admin_configurar', { p_id: campanhaId, p_duracao_dias: 2, p_ativo: false, p_valido_ate: null }],
  ]);
  assert.match((await salvarVoucher(null, form({ id: campanhaId, duracao_dias: '2', validade: '2025-02-29' }))).erro, /data/);
  assert.match((await salvarVoucher(null, form({ codigo: 'NOVO', duracao_dias: '2', validade: '2025-12-31' }))).erro, /data/);
  assert.equal(chamadas.length, 2);
});

test('edição de cupom falha sem gravar quando a leitura falha ou o código não existe', async () => {
  for (const [resposta, mensagem] of [
    [respostas({ code: '500', message: 'Erro interno' }), /consultar o cupom/i],
    [respostas(null), /Cupom não encontrado/],
  ]) {
    const { salvarVoucher } = admin('voucher-actions', {
      from: consultaCampanha(resposta), rpc: async () => assert.fail('chamou RPC'),
    });
    assert.match((await salvarVoucher(null, form({ id: campanhaId, duracao_dias: '2', validade: '2025-12-31' }))).erro, mensagem);
  }
});

test('painel vincula novas assinaturas aos planos comerciais e permissões vigentes ao Promocional', async () => {
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: PlanosPage } = carregar('src/app/admin/planos/page.tsx', {
    '@/lib/admin/auth': {
      exigirAdmin: async () => ({ supabase: { from: () => ({ select: () => ({ order: async () => respostas(null) }) }) } }),
      eSuperAdmin: async () => true,
    },
    './form-plano': { FormPlano: () => null },
    './vouchers': { FormVoucher: () => null },
    './promocional': { FormPromocional: () => null },
  });
  const html = renderToStaticMarkup(await PlanosPage());
  assert.match(html, /Mudanças nos planos comerciais valem para novas assinaturas\./);
  assert.match(html, /As permissões do Promocional mudam também para quem já tem acesso\./);
});

test('ações de plano promocional e cupom não escrevem sem acesso master', async () => {
  const supabase = { rpc: async () => assert.fail('chamou RPC'), from: () => assert.fail('acessou tabela') };
  const dados = form({ codigo: 'promocional', nome: 'Promocional', duracao_dias: '5', validade: '2099-01-01' });
  const { salvarVoucher } = admin('voucher-actions', supabase, false);
  const { criarPlano, salvarPlano, salvarPromocional } = admin('actions', supabase, false);
  for (const acao of [salvarVoucher, criarPlano, salvarPlano, salvarPromocional]) {
    assert.match((await acao(null, dados)).erro, /restrito|reservado/i);
  }
});

test('recursos promocionais escrevem apenas permissões e zero quando desmarcadas', async () => {
  let escrito;
  const { salvarPromocional } = admin('actions', {
    from: (tabela) => {
      assert.equal(tabela, 'planos');
      return {
        update: (dados) => {
          escrito = dados;
          return { eq: async (campo, valor) => {
            assert.deepEqual([campo, valor], ['codigo', 'promocional']);
            return respostas(null);
          } };
        },
      };
    },
  });
  assert.ok((await salvarPromocional(null, form({
    preco: '100', publicar_anuncios: 'on', limite_anuncios: '',
    aviso_radar_na_hora: 'on', propostas_radar_mes: '55',
    vitrine_foto_fachada: 'on', vitrine_secoes: 'on', vitrine_secoes_max: '3', vitrine_fixados_max: '9',
  }))).ok);
  const { atualizado_em, atualizado_por, ...permissoes } = escrito;
  assert.equal(atualizado_por, 'admin');
  assert.ok(atualizado_em);
  assert.deepEqual(permissoes, {
    limite_anuncios: null, acesso_radar: false, aviso_radar_na_hora: false, propostas_radar_mes: 0,
    vitrine_foto_fachada: true, vitrine_secoes_max: 3, vitrine_fixados_max: 0,
  });
});

test('resgate ativa sem depender de vitrine e distingue falha de serviço de erro do cupom', async () => {
  const chamadas = [];
  const revalidadas = [];
  let resposta = { data: '2099-12-31T03:00:00Z', error: null };
  const { resgatarVoucher } = carregar('src/app/(conta)/minha-conta/plano/voucher-actions.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (...args) => { chamadas.push(args); return resposta; } }) },
    'next/cache': { revalidatePath: (...args) => revalidadas.push(args) },
  });
  const dados = form({ codigo: ' outro-30 ' });
  assert.match((await resgatarVoucher(null, dados)).ok, /plano Promocional/);
  assert.deepEqual(chamadas, [['resgatar_voucher', { p_codigo: 'OUTRO-30' }]]);
  assert.ok(revalidadas.some(([path]) => path === '/minha-conta/plano'));
  resposta = respostas({ code: '22023', message: 'Este cupom está desativado.' });
  assert.deepEqual(await resgatarVoucher(null, dados), { erro: 'Este cupom está desativado.' });
  resposta = respostas({ code: '500', message: 'Erro interno' });
  assert.match((await resgatarVoucher(null, dados)).erro, /Tente novamente/);
});

test('resumo promocional exibe o prazo da conta sem considerar vencido o plano de origem', () => {
  const { resumoPlano } = carregar('src/components/conta/resumo-plano.ts');
  const conta = {
    vitrine: null, plano: { codigo: 'promocional', nome: 'Promocional', preco_centavos: 0 },
    promocional: { codigo: 'NOVO', ativado_em: '2026-11-18T03:00:00Z', vence_em: '2026-11-20T03:00:00Z' },
    ativos: 0, limite: 5,
  };
  for (const vitrine of [null, { plano: 'full', plano_expira_em: '2026-11-17T03:00:00Z' }]) {
    const resumo = resumoPlano({ ...conta, vitrine }, Date.parse('2026-11-18T03:00:00Z'));
    assert.equal(resumo.nome, 'Promocional');
    assert.equal(resumo.venceEm, conta.promocional.vence_em);
    assert.equal(resumo.diasRestantes, 2);
    assert.equal(resumo.venceu, false);
    assert.equal(resumo.uso, '0 de 5 anúncios');
  }
  assert.equal(resumoPlano({ ...conta, vitrine: { plano: 'full' }, ajudante: true }).venceEm, null);
});

test('Meu plano mostra formulário e benefício antes de a conta criar uma vitrine', async () => {
  const { renderToStaticMarkup } = require('react-dom/server');
  const React = require('react');
  const chamadas = [];
  const promocional = { codigo: 'NOVO', ativado_em: '2026-11-18T03:00:00Z', vence_em: '2026-12-18T03:00:00Z' };
  const marcador = (texto) => () => React.createElement('p', null, texto);
  const db = {
    rpc: async (nome) => { chamadas.push(nome); return { data: nome === 'meu_promocional' ? [promocional] : [], error: null }; },
    from: (tabela) => {
      assert.equal(tabela, 'planos');
      return { select: () => ({ eq: (campo, valor) => {
        assert.deepEqual([campo, valor], ['codigo', 'promocional']);
        return { maybeSingle: async () => ({ data: { codigo: valor, nome: 'Promocional', limite_anuncios: 6 }, error: null }) };
      } }) };
    },
  };
  const { default: PaginaMeuPlano } = carregar('src/app/(conta)/minha-conta/plano/page.tsx', {
    '@clerk/nextjs/server': {},
    '@/lib/dados/conta': {
      meuPerfilEVitrine: async () => ({ vitrine: null, plano: null, limite: 0, ativos: 0 }),
      lerAcessoPromocional: async (cliente) => (await cliente.rpc('meu_promocional')).data[0],
    },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/asaas': {},
    '@/lib/cobranca-destaque': {},
    '@/lib/dados/cobranca': {},
    '@/lib/dados/radar': {},
    '@/components/cobranca/escolher-plano': {},
    '@/components/ui/botao': { Botao: marcador('Quero vender') },
    '@/components/ui/vazio': { Vazio: ({ children }) => children },
    '@/components/conta/topo-conta': { PaginaConta: ({ children }) => children, TopoConta: marcador('Meu plano') },
    '@/components/conta/aviso': {},
    '@/components/ui/badge': {},
    './voucher': { Voucher: marcador('Ativar cupom') },
  });
  const html = renderToStaticMarkup(await PaginaMeuPlano({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Ativar cupom/);
  assert.match(html, /Promocional/);
  assert.match(html, /18 de dezembro de 2026/);
  assert.match(html, /0 de 6 anúncios/);
  assert.deepEqual(chamadas.sort(), ['meu_promocional', 'meus_vouchers']);
});

test('Radar promocional aponta para a verificação de vendedor ou de loja', () => {
  const { linkVerificarParaRadar } = carregar('src/components/radar/util.ts');
  const { LINK_LOJA_VERIFICAR } = carregar('src/lib/rotas.ts');
  const { LINK_VERIFICACAO_VENDEDOR } = carregar("src/lib/verificacao-vendedor.ts");
  const plano = { codigo: 'promocional', preco_centavos: 0, acesso_radar: true };
  assert.equal(linkVerificarParaRadar({ plano, vitrine: { tipo: 'pf', status: 'ativa' } }, false), LINK_VERIFICACAO_VENDEDOR);
  assert.equal(linkVerificarParaRadar({ plano, vitrine: { tipo: 'loja', status: 'ativa' } }, false), LINK_LOJA_VERIFICAR);
  assert.equal(linkVerificarParaRadar({ plano: { ...plano, acesso_radar: false }, vitrine: { status: 'ativa' } }, false), null);
});

test('leitura da conta consulta datas promocionais somente para titular do plano efetivo', async () => {
  const promocional = { codigo: 'NOVO', ativado_em: '2026-11-18T03:00:00Z', vence_em: '2026-12-18T03:00:00Z' };
  const chamadas = [];
  let codigo = 'promocional';
  const db = {
    rpc: (nome) => {
      chamadas.push(nome);
      if (nome === 'meus_contatos_vitrine') return { maybeSingle: async () => respostas(null) };
      return { error: null, data: nome === 'meu_perfil' ? [{ id: 'dono' }] : nome === 'meu_promocional' ? [promocional] : [{ codigo, limite_anuncios: 8 }] };
    },
    from: (tabela) => {
      if (tabela === 'vitrines_lojas') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'vitrine', dono_id: 'dono' }, error: null }) }) }) };
      const consulta = { select: () => consulta, eq: () => consulta, or: () => consulta, count: 1, error: null };
      return consulta;
    },
  };
  const { meuPerfilEVitrine, contaDaLoja } = carregar('src/lib/dados/conta.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'dono' }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/dados/vitrines': { COLUNAS_VITRINE: 'id' },
    '@/lib/dados/loja-ativa': { lojaEscolhida: async () => ({ id: 'ajudada', dono: false }) },
  });
  assert.deepEqual((await meuPerfilEVitrine(true)).promocional, promocional);
  assert.equal(chamadas.filter((n) => n === 'meu_promocional').length, 1);
  chamadas.length = 0;
  const ajudada = await contaDaLoja(true);
  assert.equal(ajudada.ajudante, true);
  assert.equal(ajudada.plano.codigo, 'promocional');
  assert.equal(ajudada.promocional, undefined);
  assert.ok(!chamadas.includes('meu_promocional'));
  codigo = 'full';
  chamadas.length = 0;
  assert.equal((await meuPerfilEVitrine(true)).promocional, undefined);
  assert.ok(!chamadas.includes('meu_promocional'));
});

test('formulário promocional preserva o limite zero de propostas', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { FormPromocional } = carregar('src/app/admin/planos/promocional.tsx', {
    './actions': { salvarPromocional: async () => null },
  });
  const html = renderToStaticMarkup(React.createElement(FormPromocional, {
    plano: { nome: 'Promocional', acesso_radar: true, propostas_radar_mes: 0, limite_anuncios: null, vitrine_secoes_max: 0, vitrine_fixados_max: 0 },
  }));
  assert.match(html, /<input[^>]*id="campo-propostas_radar_mes"[^>]*value="0"/);
});

test('Meu plano mostra o prazo já iniciado quando a vitrine está suspensa', async () => {
  const { renderToStaticMarkup } = require('react-dom/server');
  const React = require('react');
  const promocional = { codigo: 'NOVO', ativado_em: '2026-11-18T03:00:00Z', vence_em: '2026-12-18T03:00:00Z' };
  const vitrine = { id: 'vitrine', tipo: 'loja', status: 'suspensa', plano: 'full' };
  const plano = { codigo: 'full', nome: 'Full', acesso_radar: false };
  const db = {
    from: (tabela) => {
      const consulta = {
        select: () => consulta, eq: () => consulta, order: () => consulta, range: () => consulta,
        data: tabela === 'pagamentos' ? [] : [plano], count: 0, error: null,
      };
      return consulta;
    },
    rpc: async (nome) => ({ data: nome === 'meu_promocional' ? [promocional] : [], error: null }),
  };
  const { default: PaginaMeuPlano } = carregar('src/app/(conta)/minha-conta/plano/page.tsx', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'dono' }) },
    '@/lib/dados/conta': {
      meuPerfilEVitrine: async () => ({ vitrine, plano, perfil: {}, limite: 0, ativos: 0, rascunhos: 0 }),
      lerAcessoPromocional: async (cliente) => (await cliente.rpc('meu_promocional')).data[0],
    },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/asaas': { asaasConfigurado: () => false },
    '@/lib/cobranca-destaque': {},
    '@/lib/dados/cobranca': { minhaAssinatura: async () => ({ vitrine_id: vitrine.id, situacao: 'suspensa' }), opcoesAssinatura: async () => [] },
    '@/lib/dados/radar': { minhaCortesiaRadar: async () => null },
    '@/components/cobranca/escolher-plano': {},
    '@/components/ui/botao': { Botao: ({ children }) => children },
    '@/components/ui/vazio': {},
    '@/components/conta/topo-conta': { PaginaConta: ({ children }) => children, TopoConta: () => null },
    '@/components/conta/aviso': { Aviso: ({ children }) => children },
    '@/components/ui/badge': {},
    './voucher': { Voucher: () => React.createElement('p', null, 'Ativar cupom') },
  });
  const html = renderToStaticMarkup(await PaginaMeuPlano({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Full/);
  assert.match(html, /Cupom promocional/);
  assert.match(html, /18 de dezembro de 2026/);
  assert.match(html, /Os bloqueios da sua conta continuam/);
});
