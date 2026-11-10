begin;
update public.configuracoes set valor = to_jsonb('Fale com o OL-AKI de Corrente.'::text)
 where chave = 'ajuda.texto_contato';
update public.configuracoes set valor = '["OLAKI | Pix", "Sem alteração"]'::jsonb
 where chave = 'planos.perguntas_frequentes';
update public.configuracoes set descricao = 'Suporte do OLAKI'
 where chave = 'contato.whatsapp_suporte';
update public.ajuda_perguntas set resposta = 'Resposta local do OL-AKI.'
 where id = (select id from public.ajuda_perguntas order by id limit 1);
update public.modelos_mensagem set texto = 'O OLAKI traz notícias sobre {pedido}.'
 where chave = 'proposta_escolhida' and canal = 'notificacao';
alter table public.modelos_mensagem disable trigger modelos_mensagem_proteger;
update public.modelos_mensagem set texto_padrao = 'Padrão do OL-AKI sobre {pedido}.'
 where chave = 'proposta_escolhida' and canal = 'notificacao';
alter table public.modelos_mensagem enable trigger modelos_mensagem_proteger;

create temporary table marca_documentos as table public.documentos_legais;
create temporary table marca_aceites as table public.aceites;
create temporary table marca_convites as table public.convites_gerente_loja;
create temporary table marca_contato as
 select id, valor from public.configuracoes where chave = 'contato.whatsapp_suporte';

-- APLICAR_MIGRACAO_MARCA

create temporary table marca_config as table public.configuracoes;
create temporary table marca_ajuda as table public.ajuda_perguntas;
create temporary table marca_modelos as table public.modelos_mensagem;

-- APLICAR_MIGRACAO_MARCA

do $$
begin
  assert (select valor = '"Fale com o Mercado da Região de Corrente."'::jsonb
            from public.configuracoes where chave = 'ajuda.texto_contato');
  assert (select valor = '["Mercado da Região | Pix", "Sem alteração"]'::jsonb
            from public.configuracoes where chave = 'planos.perguntas_frequentes');
  assert (select descricao = 'Suporte do Mercado da Região' and c.valor = a.valor
            from public.configuracoes c join marca_contato a using (id));
  assert exists (select 1 from public.ajuda_perguntas where resposta = 'Resposta local do Mercado da Região.');
  assert (select texto = 'O Mercado da Região traz notícias sobre {pedido}.'
                 and texto_padrao = 'Padrão do Mercado da Região sobre {pedido}.'
            from public.modelos_mensagem where chave = 'proposta_escolhida' and canal = 'notificacao');
  assert (select tgenabled = 'O' from pg_trigger
           where tgrelid = 'public.modelos_mensagem'::regclass and tgname = 'modelos_mensagem_proteger');
  assert (select jsonb_agg(to_jsonb(c) order by id) from public.configuracoes c) is not distinct from
         (select jsonb_agg(to_jsonb(c) order by id) from marca_config c);
  assert (select jsonb_agg(to_jsonb(a) order by id) from public.ajuda_perguntas a) is not distinct from
         (select jsonb_agg(to_jsonb(a) order by id) from marca_ajuda a);
  assert (select jsonb_agg(to_jsonb(m) order by id) from public.modelos_mensagem m) is not distinct from
         (select jsonb_agg(to_jsonb(m) order by id) from marca_modelos m);
  assert (select jsonb_agg(to_jsonb(d) order by id) from public.documentos_legais d) is not distinct from
         (select jsonb_agg(to_jsonb(d) order by id) from marca_documentos d);
  assert (select jsonb_agg(to_jsonb(a) order by to_jsonb(a)) from public.aceites a) is not distinct from
         (select jsonb_agg(to_jsonb(a) order by to_jsonb(a)) from marca_aceites a);
  assert (select jsonb_agg(to_jsonb(c) order by id) from public.convites_gerente_loja c) is not distinct from
         (select jsonb_agg(to_jsonb(c) order by id) from marca_convites c);
end $$;
rollback;
