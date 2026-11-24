\set ON_ERROR_STOP on
begin;
update configuracoes set valor = 'true' where chave='radar.whatsapp_ativo' and microrregiao_id is null;
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_revisao899',id,'Pessoa revisão radar','Corrente','5589998994100',clock_timestamp()
from microrregioes where slug='corrente-pi';
insert into preferencias_avisos(usuario_id,tipo,canal,ligado,consentido_em)
values ('user_revisao899','proposta_nova','whatsapp',true,clock_timestamp());
do $$ begin
  assert whatsapp_sair('5589998994100','SAIR');
  assert whatsapp_radar_mensagem_com_contexto('5589998994100',repeat('e',64))='pergunta';
  assert whatsapp_mensagem_recebida('5589998994100','sim',repeat('d',64))='nada',
    'C2: uma pergunta pendente não permite reativação pelo SIM';
  assert not (select ligado from preferencias_avisos where usuario_id='user_revisao899');
  perform whatsapp_mensagem_recebida('5589998994100','voltar',repeat('b',64));
  assert not (select ligado from preferencias_avisos where usuario_id='user_revisao899'),
    'C3: chamada antiga sem identidade ou ordem não permite reativação';
end $$;
do $$
declare
  pergunta public.whatsapp_fila;
  recebido timestamptz;
begin
  select * into strict pergunta from whatsapp_fila where usuario_id='user_revisao899' and public.radar_eh_pergunta_whatsapp(chave);
  assert public.radar_piloto_permite_pergunta(pergunta,pergunta.criado_em + interval '7 days' - interval '1 microsecond'), 'I5 antes do limite';
  assert not public.radar_piloto_permite_pergunta(pergunta,pergunta.criado_em + interval '7 days'), 'I5 o prazo é exclusivo';
  assert whatsapp_radar_evento(pergunta.numero,'sim',null,repeat('1',64),clock_timestamp(),repeat('f',64))='nada', 'C2 pendente mesmo com citação';
  update whatsapp_fila set estado='enviando' where id=pergunta.id;
  assert whatsapp_radar_evento(pergunta.numero,'sim',null,repeat('2',64),clock_timestamp(),null)='nada', 'C2 sem citação';
  assert whatsapp_radar_evento(pergunta.numero,'sim',null,repeat('3',64),clock_timestamp(),repeat('e',64))='aguarda_comprovante', 'C2 corrida de citação divergente';
  assert whatsapp_radar_evento(pergunta.numero,'sim',null,repeat('4',64),clock_timestamp(),repeat('f',64))='aguarda_comprovante', 'C2 corrida legítima';
  assert not (select ligado from preferencias_avisos where usuario_id='user_revisao899');
  assert whatsapp_radar_resultado_enviado(pergunta.id, repeat('f',64))='enviada';
  assert (select ligado from preferencias_avisos where usuario_id='user_revisao899'), 'C2 prova da Evolution libera o SIM correspondente';
  assert (select count(*)=1 from whatsapp_respostas where usuario_id='user_revisao899' and comando='VOLTAR');
  assert not exists (select from whatsapp_radar_eventos where pergunta_id is not null), 'C2 comprovante resolve os SIMs deferidos';
  assert whatsapp_radar_evento(pergunta.numero,'sair','SAIR',repeat('5',64),clock_timestamp(),null)='saiu';
  recebido := clock_timestamp();
  assert whatsapp_radar_evento(pergunta.numero,'voltar',null,repeat('6',64),recebido,null)='voltou';
  assert whatsapp_radar_evento(pergunta.numero,'sair','SAIR',repeat('7',64),clock_timestamp(),null)='saiu';
  assert whatsapp_radar_evento(pergunta.numero,'voltar',null,repeat('6',64),recebido,null)='evento_repetido', 'C3 reentrega com ID conhecido';
  assert whatsapp_radar_evento(pergunta.numero,'voltar',null,repeat('8',64),recebido,null)='orientacao', 'C3 chegada tardia com ID novo';
  assert not (select ligado from preferencias_avisos where usuario_id='user_revisao899');
  assert whatsapp_radar_evento(pergunta.numero,'voltar',null,repeat('9',64),clock_timestamp(),null)='voltou', 'C3 texto repetido deliberadamente em novo evento';
  assert whatsapp_radar_evento(pergunta.numero,'sair','SAIR',repeat('5',64),recebido,null)='evento_repetido', 'C3 reentrega de SAIR com ID conhecido';
  assert (select ligado from preferencias_avisos where usuario_id='user_revisao899');
  assert not has_function_privilege('authenticated','whatsapp_radar_evento(text,text,text,text,timestamptz,text)','EXECUTE');
  assert has_function_privilege('service_role','whatsapp_radar_resultado_enviado(uuid,text)','EXECUTE');
  assert not has_table_privilege('service_role','whatsapp_radar_eventos','SELECT');
  assert radar_escopo_whatsapp(array['proposta_nova'])='avisos de propostas do Radar', 'I4 não menciona pedidos';
  assert right(radar_texto_whatsapp_com_saida(repeat('x',995),'{}'),length('Responda SAIR para parar estes avisos.'))='Responda SAIR para parar estes avisos.', 'I6 reservar a instrução ao truncar';
  assert radar_texto_whatsapp_com_saida('Modelo curto. Digite SAIR para parar.','{}')='Modelo curto. Digite SAIR para parar.', 'I6 preservar instrução personalizada válida';
end $$;

update preferencias_avisos set consentido_em=null where usuario_id='user_revisao899';
update radar_piloto_controle set modo='fechado',rodada_id=gen_random_uuid(),
  microrregiao_id=(select microrregiao_id from perfis where id='user_revisao899'),
  inicio_em=clock_timestamp()-interval '1 hour',piso_fila_em=clock_timestamp()-interval '30 minutes',
  fim_em=clock_timestamp()+interval '1 day';
insert into radar_piloto_participantes(rodada_id,usuario_id,microrregiao_id,inicio_em,fim_em)
select rodada_id,'user_revisao899',microrregiao_id,inicio_em,fim_em from radar_piloto_controle;
do $$ begin
  assert whatsapp_radar_evento('5589998994100','voltar',null,repeat('b',64),clock_timestamp(),null)='orientacao',
    'I4 piloto: preferência antiga sem prova pede confirmação no site';
end $$;
update radar_piloto_controle set modo='legado';

insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_revisaoambigua',microrregiao_id,'Variante revisão radar','Corrente',
       substr(whatsapp,1,4)||substr(whatsapp,6),clock_timestamp()
from perfis where id='user_revisao899';
do $$ begin
  assert whatsapp_sair('5589998994100','SAIR');
  assert whatsapp_radar_evento('5589998994100','voltar',null,repeat('a',64),clock_timestamp(),null)='ambiguo', 'I7 nenhuma conta recebe a reativação ambígua';
  assert not (select ligado from preferencias_avisos where usuario_id='user_revisao899');
  assert (select count(distinct usuario_id)=2 from whatsapp_respostas where usuario_id like 'user_revisao%' and comando='SAIR'), 'I7 SAIR preservado para ambas as variantes';
end $$;
rollback;
