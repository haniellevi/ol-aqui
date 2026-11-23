const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { setTimeout: esperar } = require('node:timers/promises');
const { test } = require('node:test');
const { carregar } = require('../../tests/carregar.cjs');

const container = process.argv[2];
assert.match(container, /^(?:olaki-test|item15-candidato)-[0-9a-f]+$/);
const sql = (comando) => execFileSync('docker', [
  'exec', '-i', container, 'psql', '-XqAt', '-U', 'postgres', '-d', 'olaki', '-v', 'ON_ERROR_STOP=1',
], { input: comando, encoding: 'utf8', timeout: 10000 }).trim();
const literal = valor => valor == null ? 'NULL' : "'" + String(valor).replaceAll("'", "''") + "'";

async function rpc(nome, args) {
  assert.match(nome, /^whatsapp_[a-z_]+$/);
  const parametros = Object.entries(args).map(([chave, valor]) => {
    assert.match(chave, /^p_[a-z_]+$/);
    return chave + '=>' + literal(valor);
  }).join(',');
  const chamada = 'public.' + nome + '(' + parametros + ')';
  const consulta = nome.endsWith('fila_pegar')
    ? "select coalesce(json_agg(x), '[]') from " + chamada + ' x'
    : 'select to_json(' + chamada + ')';
  return { data: JSON.parse(sql("set request.jwt.claim.role='service_role'; set role service_role; " + consulta)), error: null };
}

const segredo = 'chave-ficticia-para-o-ensaio-isolado-do-radar';
const origem = 'https://evolution.test';
Object.assign(process.env, {
  EVOLUTION_WEBHOOK_SEGREDO: segredo, EVOLUTION_URL: origem, EVOLUTION_API_KEY: 'ficticia', EVOLUTION_INSTANCE: 'ficticia',
});
const fronteiras = {
  'next/server': { NextResponse: Response },
  '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc }) },
};
const webhook = carregar('src/app/api/whatsapp/evolution/route.ts', fronteiras).POST;
const fila = carregar('src/app/api/interno/whatsapp-fila/route.ts', {
  ...fronteiras,
  '@/lib/moderacao-ia': { segredoModeracaoConfere: () => true },
  '@/lib/formato': { SITE: 'https://site.test' },
  'node:timers/promises': { setTimeout: async () => {} },
}).POST;
const { hashIdWhatsapp } = carregar('src/lib/whatsapp/evolution.ts');

function requisicao(body) {
  return new Request('https://app.test', {
    method: 'POST', headers: { authorization: 'Bearer ' + segredo, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function conta(n, modo = 'legado') {
  const usuario = 'user_evolocal' + n;
  const numero = '5589998889' + String(n).padStart(3, '0');
  const uid = literal(usuario);
  sql(`
    update whatsapp_fila set estado='cancelada' where estado in ('pendente','enviando');
    update radar_piloto_controle set modo='legado';
    update configuracoes set valor='true' where chave='radar.whatsapp_ativo' and microrregiao_id is null;
    insert into perfis(id,nome,microrregiao_id,cidade,whatsapp,whatsapp_verificado_em)
      select ${uid},'Pessoa fictícia',id,'Corrente',${literal(numero)},clock_timestamp()
      from microrregioes where slug='corrente-pi';
    begin;
      set local role authenticated;
      set local request.jwt.claim.sub=${uid};
      select salvar_preferencia_whatsapp_radar_tipo('proposta_nova',true);
    commit;
  `);
  if (modo === 'fechado') sql(`
    update radar_piloto_controle
      set modo='fechado', rodada_id=gen_random_uuid(),
        microrregiao_id=(select microrregiao_id from perfis where id=${uid}),
        inicio_em=now()-interval '1 day', fim_em=now()+interval '29 days', piso_fila_em=now()-interval '1 day';
    insert into radar_piloto_participantes(rodada_id,usuario_id,microrregiao_id,inicio_em,fim_em)
      select rodada_id,${uid},microrregiao_id,inicio_em,fim_em from radar_piloto_controle;
  `);
  return { uid, numero, ligado: () => sql(`
    select ligado from preferencias_avisos where usuario_id=${uid} and canal='whatsapp' and tipo='proposta_nova'
  `) === 't' };
}

async function entrada(numero, texto, id, { hora = Math.floor(Date.now()/1000), externa, interna } = {}) {
  const data = {
    key: { remoteJid: numero + '@s.whatsapp.net', fromMe: false, id },
    message: interna ? { extendedTextMessage: { text: texto, contextInfo: { stanzaId: interna } } } : { conversation: texto },
    messageTimestamp: hora,
  };
  if (externa) data.contextInfo = { stanzaId: externa, quotedMessage: { conversation: 'Pergunta fictícia' } };
  assert.equal((await webhook(requisicao({ event: 'messages.upsert', data }))).status, 200);
}

async function rodada() {
  const resposta = await fila(requisicao({}));
  assert.equal(resposta.status, 200);
}

async function ciclo(n, { modo, ordem, formato = 'externa', novoSair = false, status = 201, horaSaida }) {
  const { uid, numero, ligado } = conta(n, modo);
  const comprovante = 'pergunta-' + n;
  const contexto = formato === 'conflito'
    ? { externa: 'outra-referencia', interna: comprovante }
    : { [formato]: comprovante };
  await entrada(numero, 'SAIR', 'saida-' + n, { hora: horaSaida });
  await entrada(numero, 'Olá', 'mensagem-' + n);
  if (ordem === 'pendente') {
    await entrada(numero, 'SIM', 'sim-pendente-' + n, contexto);
    assert.equal(ligado(), false);
  }
  let postsPergunta = 0;
  global.fetch = async (url, options) => {
    assert.ok(url.startsWith(origem + '/'));
    if (url.endsWith('/instance/connectionState/ficticia')) return Response.json({ instance: { state: 'open' } });
    assert.ok(url.endsWith('/message/sendText/ficticia'));
    assert.equal(options.method, 'POST');
    const pergunta = JSON.parse(options.body).text.includes('Use Responder');
    if (pergunta) {
      postsPergunta++;
      if (ordem === 'durante') {
        await entrada(numero, 'SIM', 'sim-' + n, contexto);
        assert.equal(ligado(), false, 'SIM aguarda a confirmação do provedor');
      }
      if (novoSair) await entrada(numero, 'SAIR', 'novo-sair-' + n);
      if (status !== 201) return Response.json({ error: 'Bad Request' }, { status });
    }
    return Response.json({ key: { id: pergunta ? comprovante : 'confirmacao-' + n, fromMe: true } });
  };
  await rodada();
  assert.equal(postsPergunta, 1);
  const estado = sql(`
    select estado||'/'||coalesce(radar_comprovante_pergunta,'-')||'/'||tentativas
    from whatsapp_fila where usuario_id=${uid} and radar_eh_pergunta_whatsapp(chave)
  `);
  assert.equal(estado, status === 201 ? 'enviada/' + hashIdWhatsapp(comprovante) + '/1' : 'incerta/-/1');
  if (ordem === 'depois') await entrada(numero, 'SIM', 'sim-' + n, contexto);
  assert.equal(ligado(), status === 201 && !novoSair && formato !== 'conflito' && ordem !== 'pendente');
  if (status !== 201) {
    sql(`update whatsapp_fila set enviar_apos=now()-interval '1 second'
       where usuario_id=${uid} and radar_eh_pergunta_whatsapp(chave)`);
    await rodada();
    assert.equal(postsPergunta, 1, 'a fila não repete um POST de entrega incerta');
    assert.equal(sql(`select estado from whatsapp_fila where usuario_id=${uid} and radar_eh_pergunta_whatsapp(chave)`), 'incerta');
  }
}

for (const [n, modo, ordem] of [
  [1, 'legado', 'depois'], [2, 'legado', 'durante'], [3, 'fechado', 'depois'], [4, 'fechado', 'durante'],
]) {
  test('C2: SIM no payload publicado pela Evolution, ' + ordem + ' a confirmação, em ' + modo,
    () => ciclo(n, { modo, ordem }));
}

test('C2: formato interno válido, referências conflitantes, pergunta pendente e novo SAIR', async () => {
  await ciclo(5, { ordem: 'durante', formato: 'interna' });
  await ciclo(6, { ordem: 'depois', formato: 'conflito' });
  await ciclo(7, { ordem: 'pendente' });
  await ciclo(8, { ordem: 'durante', novoSair: true });
});

test('C3: SAIR com origem adiantada impede VOLTAR atrasado; duplicata e novo VOLTAR continuam distintos', async () => {
  const { numero, uid, ligado } = conta(9);
  const t = Math.floor(Date.now()/1000);
  await entrada(numero, 'SAIR', 'saida-desalinhada', { hora: t + 100 });
  assert.equal(ligado(), false);
  await esperar(Math.max(0, (t+2)*1000-Date.now()));
  await entrada(numero, 'VOLTAR', 'voltar-atrasado', { hora: t + 1 });
  assert.equal(ligado(), false, 'a hora de processamento não substitui a origem incompatível de SAIR');
  assert.equal(sql(`select radar_origem_incompativel from whatsapp_respostas where usuario_id=${uid} and comando='SAIR'`), 't');
  assert.match(sql(`select texto from whatsapp_fila where usuario_id=${uid} and chave like '%:orientacao:%'`), /Minha conta > Notificações/);
  await entrada(numero, 'SAIR', 'saida-desalinhada', { hora: t + 100 });
  assert.equal(sql(`select count(*) from whatsapp_respostas where usuario_id=${uid} and comando='SAIR'`), '1');

  const fechado = conta(15, 'fechado');
  await entrada(fechado.numero, 'SAIR', 'saida-desalinhada-fechado', { hora: t + 100 });
  const t2 = Number(sql('select ceil(extract(epoch from clock_timestamp()))'));
  await esperar(Math.max(0, t2*1000-Date.now()+25));
  await entrada(fechado.numero, 'VOLTAR', 'voltar-atrasado-fechado', { hora: t2 });
  assert.equal(fechado.ligado(), false);
  await ciclo(16, { modo: 'fechado', ordem: 'durante', horaSaida: t + 100 });

  const normal = conta(10);
  await entrada(normal.numero, 'SAIR', 'saida-normal');
  const hora = Number(sql('select ceil(extract(epoch from clock_timestamp()))'));
  await esperar(Math.max(0, hora*1000-Date.now()+25));
  await entrada(normal.numero, 'VOLTAR', 'voltar-novo', { hora });
  assert.equal(normal.ligado(), true);
  await entrada(normal.numero, 'SAIR', 'saida-normal');
  assert.equal(normal.ligado(), true);
  await entrada(normal.numero, 'SAIR', 'saida-nova');
  assert.equal(normal.ligado(), false);
});

test('entrega incerta: HTTP 400 do POST no caminho da fila jamais repete a pergunta', async () => {
  await ciclo(11, { ordem: 'durante', status: 400 });
});

test('I4: sino bloqueado de proposta nova orienta só pelo tipo afetado', async () => {
  const { numero, uid, ligado } = conta(12);
  await entrada(numero, 'SAIR', 'saida-sino');
  sql(`insert into preferencias_avisos(usuario_id,tipo,canal,ligado) values (${uid},'proposta_nova','app',false)`);
  await entrada(numero, 'VOLTAR', 'voltar-sino');
  assert.equal(ligado(), false);
  const texto = sql(`select texto from whatsapp_fila where usuario_id=${uid} and chave like '%:sino:%'`);
  assert.match(texto, /avisos de propostas/);
  assert.doesNotMatch(texto, /pedidos/);
});

test('I7: confirmação de SAIR para número compartilhado indica o caminho autenticado', async () => {
  const { numero, uid, ligado } = conta(13);
  sql(`insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
    select 'user_evolosegunda',microrregiao_id,'Outra pessoa fictícia','Corrente',
      substr(whatsapp,1,4)||substr(whatsapp,6),clock_timestamp() from perfis where id=${uid};
    insert into preferencias_avisos(usuario_id,tipo,canal,ligado,consentido_em)
      values ('user_evolosegunda','proposta_nova','whatsapp',true,now());`);
  await entrada(numero, 'SAIR', 'saida-ambigua');
  assert.equal(ligado(), false);
  assert.equal(sql("select ligado from preferencias_avisos where usuario_id='user_evolosegunda'"), 'f');
  const texto = sql(`select texto from whatsapp_fila where chave like 'whatsapp_saida:${numero}:%'`);
  assert.match(texto, /Minha conta > Notificações/);
  assert.doesNotMatch(texto, /VOLTAR/);
  await entrada(numero, 'VOLTAR', 'voltar-ambiguo');
  assert.equal(ligado(), false);
  assert.equal(sql(`select count(*) from whatsapp_fila where usuario_id in (${uid},'user_evolosegunda') and chave like 'whatsapp_resposta:%'`), '0');
});

test('compatibilidade: Worker antigo conserva SAIR e orientação sem criar pergunta de SIM', async () => {
  const { numero, ligado } = conta(14);
  const sair = await rpc('whatsapp_sair', { p_numero: numero, p_comando: 'SAIR' });
  assert.equal(sair.data, true);
  const antiga = (intencao, letra) => rpc('whatsapp_mensagem_recebida', { p_numero: numero, p_intencao: intencao, p_hash: letra.repeat(64) });
  assert.equal((await antiga('outra', 'a')).data, 'nada');
  assert.equal((await antiga('voltar', 'b')).data, 'orientacao');
  assert.equal((await antiga('sim', 'c')).data, 'nada');
  assert.equal(ligado(), false);
});

test('compatibilidade: coleta antiga preserva confirmação e deixa pergunta nova para o Worker com comprovante', async () => {
  const { numero, uid } = conta(17, 'fechado');
  await entrada(numero, 'SAIR', 'saida-durante-rollback');
  await entrada(numero, 'Olá de novo', 'mensagem-worker-novo');
  const antigaFila = (await rpc('whatsapp_fila_pegar', { p_limite: 5 })).data;
  assert.ok(antigaFila.some(item => item.texto.includes('Minha conta > Notificações')));
  assert.ok(antigaFila.every(item => !item.texto.includes('Use Responder')));
  assert.equal(sql(`select estado from whatsapp_fila where usuario_id=${uid} and radar_eh_pergunta_whatsapp(chave)`), 'pendente');
  assert.equal(sql(`select has_function_privilege('anon','whatsapp_radar_fila_pegar(integer)','execute')
    or has_function_privilege('authenticated','whatsapp_radar_mensagem_com_contexto(text,text)','execute')`), 'f');
});

test('minimização: comandos ignorados de número sem conta não deixam identificadores', async () => {
  const numero = '5589998889999';
  for (const tipo of ['SAIR', 'VOLTAR', 'SIM']) {
    await entrada(numero, tipo, 'sem-conta-' + tipo);
    assert.equal(sql(`select count(*) from whatsapp_radar_eventos where evento=${literal(hashIdWhatsapp('sem-conta-'+tipo,numero))}`), '0');
  }
});
