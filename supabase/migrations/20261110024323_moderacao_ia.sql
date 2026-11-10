-- Fila privada, decisão vinculada à versão do anúncio e orçamento compartilhado com o Aki.
insert into public.configuracoes(chave, valor, grupo, publico, descricao) values
 ('moderacao.ia_ativa', 'false', 'moderacao', false, 'Analisa anúncios retidos por preço ou palavras. Exceções continuam na revisão manual.')
on conflict do nothing;

alter table public.robo_uso drop constraint robo_uso_tipo_check;
alter table public.robo_uso add constraint robo_uso_tipo_check check (tipo in ('conversa','foto','teste','moderacao'));

create table public.moderacao_ia (
 id uuid primary key default gen_random_uuid(),
 anuncio_id uuid references public.anuncios(id) on delete set null,
 revisao text not null,
 estado text not null default 'pendente' check (estado in ('pendente','processando','aprovado','manual','obsoleto')),
 motivo text,
 modelo text not null default 'openai/gpt-4.1-mini',
 confianca numeric check (confianca between 0 and 1),
 riscos jsonb,
 uso_id bigint references public.robo_uso(id),
 reserva uuid,
 criado_em timestamptz not null default now(),
 iniciado_em timestamptz,
 concluido_em timestamptz,
 unique(anuncio_id, revisao)
);
create index moderacao_ia_pendentes on public.moderacao_ia(criado_em) where estado in ('pendente','processando');
alter table public.moderacao_ia enable row level security;
revoke all on public.moderacao_ia from public, anon, authenticated;
grant select on public.moderacao_ia to authenticated;
grant all on public.moderacao_ia to service_role;
create policy "equipe le analise ia" on public.moderacao_ia for select using (public.tem_papel('moderador'));

create function public.moderacao_ia_revisao(a public.anuncios)
returns text language sql immutable set search_path=public as $$
 select md5(jsonb_build_array(a.titulo,a.descricao,a.preco_centavos,a.categoria_id,a.atributos,a.fotos,
   a.cidade,a.bairro,a.status,a.motivo_analise,a.atualizado_em,a.vendido_em,a.congelado_motivo)::text)
$$;
revoke all on function public.moderacao_ia_revisao(public.anuncios) from public, anon, authenticated;

create function public.moderacao_ia_reservar()
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
 j public.moderacao_ia; a public.anuncios; v public.vitrines_lojas;
 cot numeric; orc numeric; gasto numeric; reserva_custo numeric; uid bigint; token uuid;
begin
 if coalesce(auth.role(),'') <> 'service_role' and session_user not in ('postgres','supabase_admin') then
   raise exception 'Acesso restrito.' using errcode='42501';
 end if;
 if public.config('moderacao.ia_ativa',null,'false') <> 'true'::jsonb then return null; end if;
 -- A mesma trava e o mesmo livro-caixa usados por robo_reservar.
 perform pg_advisory_xact_lock(hashtext('robo_uso:orcamento'));
 -- Uma chamada interrompida não é reenviada: pode ter sido cobrada. A reserva permanece no livro-caixa.
 update public.moderacao_ia set estado='manual', motivo='A análise automática foi interrompida. Revisão manual necessária.', concluido_em=now()
 where estado='processando' and iniciado_em < now()-interval '3 minutes';
 insert into public.moderacao_ia(anuncio_id,revisao)
 select x.id,public.moderacao_ia_revisao(x) from public.anuncios x
 where x.status='em_analise' and x.vendido_em is null and x.congelado_motivo is null
   and (x.motivo_analise='Preço fora do normal para a categoria' or x.motivo_analise like 'Palavra bloqueada:%')
   and not exists(select 1 from public.denuncias d where d.alvo_tipo='anuncio' and d.alvo_id=x.id and d.status='aberta')
   and not exists(select 1 from public.moderacao_ia m where m.anuncio_id=x.id and m.revisao=public.moderacao_ia_revisao(x))
 order by x.atualizado_em limit 100 on conflict do nothing;

 select * into j from public.moderacao_ia where estado='pendente' order by criado_em for update skip locked limit 1;
 if j.id is null then return null; end if;
 select * into a from public.anuncios where id=j.anuncio_id for update;
 if a.id is null or a.status <> 'em_analise' or public.moderacao_ia_revisao(a) <> j.revisao then
   update public.moderacao_ia set estado='obsoleto',concluido_em=now() where id=j.id;
   return jsonb_build_object('ignorado',true);
 end if;
 select * into v from public.vitrines_lojas where id=a.vitrine_id;
 if v.status <> 'ativa' or not public.whatsapp_confirmado(v.dono_id)
    or exists(select 1 from public.denuncias where alvo_tipo='anuncio' and alvo_id=a.id and status='aberta')
    or (select count(*) from public.robo_uso where usuario_id=v.dono_id and tipo='moderacao' and criado_em>=public.robo_inicio('dia')) >= 10 then
   update public.moderacao_ia set estado='manual',motivo='Contato, situação da conta, denúncia ou limite diário exige revisão manual.',concluido_em=now() where id=j.id;
   return jsonb_build_object('ignorado',true);
 end if;
 cot := public.numero_ou_nulo(public.config('robo.cotacao_dolar',null,'null'));
 orc := public.numero_ou_nulo(public.config('robo.orcamento_mensal_centavos',null,'null'));
 -- US$ 0,50 cobre até o contexto máximo deste modelo nos preços limitados pelo servidor.
 reserva_custo := 0.50*cot*100;
 select coalesce(sum(custo_centavos),0) into gasto from public.robo_uso where criado_em>=public.robo_inicio('mes');
 if cot is null or cot<=0 or orc is null or orc<0 or gasto+reserva_custo>orc then
   update public.moderacao_ia set estado='manual',motivo='Orçamento de IA indisponível. Revisão manual necessária.',concluido_em=now() where id=j.id;
   return jsonb_build_object('ignorado',true);
 end if;
 insert into public.robo_uso(usuario_id,microrregiao_id,tipo,provedor,modelo,custo_centavos,cotacao_dolar,erro)
 values(v.dono_id,a.microrregiao_id,'moderacao','openrouter',j.modelo,reserva_custo,cot,'em_andamento') returning id into uid;
 token:=gen_random_uuid();
 update public.moderacao_ia set estado='processando',uso_id=uid,reserva=token,iniciado_em=now() where id=j.id;
 return jsonb_build_object('id',j.id,'reserva',token,'modelo',j.modelo,'anuncio_id',a.id,'dono_id',v.dono_id,
   'titulo',a.titulo,'descricao',a.descricao,'preco_centavos',a.preco_centavos,'categoria',a.subcategoria,
   'atributos',a.atributos,'fotos',a.fotos,'motivo',a.motivo_analise);
end $$;

create function public.moderacao_ia_concluir(p_id uuid,p_reserva uuid,p_resultado jsonb,p_custo_usd numeric default null,
 p_tokens_entrada integer default 0,p_tokens_saida integer default 0)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare j public.moderacao_ia; a public.anuncios; v public.vitrines_lojas; aprovar boolean; fim text; razao text;
begin
 if coalesce(auth.role(),'') <> 'service_role' and session_user not in ('postgres','supabase_admin') then
   raise exception 'Acesso restrito.' using errcode='42501';
 end if;
 select * into j from public.moderacao_ia where id=p_id for update;
 if j.id is null or j.estado<>'processando' or j.reserva is distinct from p_reserva then return 'ignorado'; end if;
 -- Custo ausente ou inválido conserva a reserva, inclusive quando o provedor caiu após receber a chamada.
 update public.robo_uso set
   custo_centavos=case when p_custo_usd>=0 and p_custo_usd<=0.50 then round(p_custo_usd*cotacao_dolar*100,4) else custo_centavos end,
   tokens_entrada=greatest(coalesce(p_tokens_entrada,0),0),tokens_saida=greatest(coalesce(p_tokens_saida,0),0),
   erro=case when p_custo_usd>=0 and p_custo_usd<=0.50 then null else 'custo_indeterminado' end
 where id=j.uso_id;
 select * into a from public.anuncios where id=j.anuncio_id for update;
 if a.id is null or a.status<>'em_analise' or public.moderacao_ia_revisao(a)<>j.revisao then
   update public.moderacao_ia set estado='obsoleto',concluido_em=now() where id=j.id;
   return 'obsoleto';
 end if;
 razao:=left(coalesce(nullif(btrim(p_resultado->>'motivo'),''),'Resposta inconclusiva. Revisão manual necessária.'),300);
 aprovar := coalesce(p_resultado->>'decisao'='aprovar'
   and jsonb_typeof(p_resultado->'confianca')='number'
   and public.numero_ou_nulo(p_resultado->'confianca') between 0.98 and 1
   and p_resultado->'riscos'='[]'::jsonb
   and public.numero_ou_nulo(p_resultado->'imagens_avaliadas')=cardinality(a.fotos)
   and cardinality(a.fotos)>0 and char_length(razao)>=20
   and p_custo_usd between 0 and 0.50,false);
 select * into v from public.vitrines_lojas where id=a.vitrine_id for update;
 if public.config('moderacao.ia_ativa',null,'false') <> 'true'::jsonb or v.status<>'ativa'
   or not public.whatsapp_confirmado(v.dono_id) or a.congelado_motivo is not null or a.vendido_em is not null
   or exists(select 1 from public.denuncias where alvo_tipo='anuncio' and alvo_id=a.id and status='aberta')
   or not exists(select 1 from public.categorias c left join public.categorias p on p.id=c.pai_id
     where c.id=a.categoria_id and c.ativa and (p.id is null or p.ativa)) then
   aprovar:=false; razao:='O anúncio ou a conta mudou de situação e exige revisão manual.';
 end if;
 fim:='manual';
 if aprovar then
   begin
     -- Passa pelos gatilhos normais de plano, cota, fotos, categoria e log. Não fecha denúncias.
     update public.anuncios set status='ativo',motivo_analise=null where id=a.id;
     fim:='aprovado';
     perform public.notificar(v.dono_id,'anuncio_aprovado','Seu anúncio foi aprovado',
       'A análise automática foi concluída e seu anúncio está no ar.','/minha-conta/anuncios',
       'moderacao-ia:'||j.id::text);
   exception when check_violation or raise_exception or insufficient_privilege then
     razao:='A publicação encontrou uma restrição de cadastro, categoria ou plano. Revisão manual necessária.';
   end;
 end if;
 update public.moderacao_ia set estado=fim,motivo=razao,
   confianca=case when public.numero_ou_nulo(p_resultado->'confianca') between 0 and 1 then public.numero_ou_nulo(p_resultado->'confianca') else null end,
   riscos=case when jsonb_typeof(p_resultado->'riscos')='array' then p_resultado->'riscos' else null end,
   concluido_em=now() where id=j.id;
 return fim;
end $$;

revoke all on function public.moderacao_ia_reservar(), public.moderacao_ia_concluir(uuid,uuid,jsonb,numeric,integer,integer) from public,anon,authenticated;
grant execute on function public.moderacao_ia_reservar(), public.moderacao_ia_concluir(uuid,uuid,jsonb,numeric,integer,integer) to service_role;
