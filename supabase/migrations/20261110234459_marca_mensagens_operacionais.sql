-- Substituições exatas em textos enviados ao público, sem renomear funções,
-- configurações, eventos, permissões ou identificadores de integração.
do $marca$
declare f record; definicao text; novo text; troca record;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname in
      ('enviar_mensagem_atendimento','escolher_proposta','moderar_anuncio',
       'moderar_banner_vitrine','moderar_pedido','periodo_assinatura','radar_propor') loop
    definicao := pg_get_functiondef(f.oid); novo := definicao;
    for troca in select * from (values
      ('Mensagem da equipe do OL-AKI','Mensagem da equipe do Mercado da Região'),
      ('Olá, %s! Vi sua proposta no Radar do OLAKI para "%s".','Olá, %s! Vi sua proposta no Radar do Mercado da Região para "%s".'),
      ('fora das regras do OLAKI','fora das regras do Mercado da Região'),
      ('Foto fora das regras do OLAKI','Foto fora das regras do Mercado da Região'),
      ('Fora das regras do OLAKI','Fora das regras do Mercado da Região'),
      ('Você já pagou o %s para começar em %s. Para mudar de novo, fale com o suporte do OLAKI.','Você já pagou o %s para começar em %s. Para mudar de novo, fale com o suporte do Mercado da Região.'),
      ('Olá! Vi seu pedido no Radar do OLAKI: "%s". Tenho uma proposta da loja %s.','Olá! Vi seu pedido no Radar do Mercado da Região: "%s". Tenho uma proposta da loja %s.')
    ) as t(antigo,atual) loop
      novo := replace(novo,quote_literal(troca.antigo),quote_literal(troca.atual));
    end loop;
    if novo is distinct from definicao then execute novo; end if;
  end loop;
end;
$marca$;
