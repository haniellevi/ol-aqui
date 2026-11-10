-- Publicação imediata. Só termos sexuais ou violentos geram retenção automática de anúncios.
-- Radar, vitrines, denúncias e decisões da equipe mantêm suas regras próprias.
insert into public.configuracoes(chave, valor, grupo, publico, descricao) values
 ('moderacao.termos_sensiveis_anuncios',
  '["sexo","sexual","sexuais","pornô","pornografia","pornográfico","pornográfica","erótico","erótica","eróticos","eróticas","nude","nudes","nudez","prostituição","prostituta","garota de programa","garoto de programa","boquete","estupro","estuprar","pedofilia","violência","violento","violenta","assassinato","assassinar","homicídio","matar","espancar","espancamento","tortura","torturar","massacre","ameaça de morte","arma de fogo","armas de fogo","fuzil","revólver","munição","munições","metralhadora"]',
  'moderacao', false, 'Termos sexuais ou violentos que deixam anúncios pendentes para conferência da equipe. Preço não gera moderação.')
on conflict do nothing;

create or replace function public.termo_sensivel_anuncio(p_texto text, p_regiao uuid)
returns text language plpgsql stable security definer set search_path=public,extensions as $$
declare
 texto text := ' ' || btrim(regexp_replace(public.sem_acento(lower(coalesce(p_texto,''))), '[^[:alnum:]]+', ' ', 'g')) || ' ';
 termo text;
 normalizado text;
begin
 for termo in select jsonb_array_elements_text(public.config('moderacao.termos_sensiveis_anuncios',p_regiao,'[]')) loop
   normalizado := btrim(regexp_replace(public.sem_acento(lower(termo)), '[^[:alnum:]]+', ' ', 'g'));
   -- Correspondência literal de palavras/expressões completas, sem executar regex da configuração.
   if normalizado <> '' and strpos(texto, ' ' || normalizado || ' ') > 0 then return termo; end if;
 end loop;
 return null;
end $$;
revoke all on function public.termo_sensivel_anuncio(text,uuid) from public,anon,authenticated;

create or replace function public.filtro_anuncio_sensivel()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
declare termo text;
begin
 -- A conferência humana aprova a versão examinada; mudar o conteúdo exige nova triagem.
 if tg_op='UPDATE' and old.status='em_analise' and new.status='ativo'
   and public.tem_papel('moderador')
   and (new.titulo,new.descricao,new.atributos) is not distinct from (old.titulo,old.descricao,old.atributos) then
   return new;
 end if;
 termo := public.termo_sensivel_anuncio(concat_ws(' ',new.titulo,new.descricao,
   (select string_agg(value,' ') from jsonb_each_text(new.atributos))),new.microrregiao_id);
 if termo is not null then
   new.status := 'em_analise';
   new.motivo_analise := format('Termo sexual ou violento: "%s"',termo);
   -- O protetor já existente impede IA, pausa e republicação de contornarem a equipe.
   new.revisao_manual_admin := true;
 end if;
 return new;
end $$;
revoke all on function public.filtro_anuncio_sensivel() from public,anon,authenticated;

drop trigger anuncios_moderacao on public.anuncios;
create trigger anuncios_moderacao before insert or update of titulo,descricao,atributos on public.anuncios
 for each row when (new.status in ('ativo','vendido')) execute function public.filtro_anuncio_sensivel();
drop trigger anuncios_moderacao_publicar on public.anuncios;
create trigger anuncios_moderacao_publicar before update of status on public.anuncios
 for each row when (old.status is distinct from new.status and new.status in ('ativo','vendido')
   and not (old.status='ativo' and new.status='vendido'))
 execute function public.filtro_anuncio_sensivel();

-- A IA legada nunca pode aprovar termos sensíveis, inclusive em trabalhos já reservados.
create or replace function public.moderacao_ia_concluir(p_id uuid,p_reserva uuid,p_resultado jsonb,p_custo_usd numeric default null,
 p_tokens_entrada integer default 0,p_tokens_saida integer default 0)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare j public.moderacao_ia; a public.anuncios; v public.vitrines_lojas; aprovar boolean; fim text; razao text; publicado public.status_anuncio;
begin
 if coalesce(auth.role(),'') <> 'service_role' and session_user not in ('postgres','supabase_admin') then
   raise exception 'Acesso restrito.' using errcode='42501';
 end if;
 select * into j from public.moderacao_ia where id=p_id for update;
 if j.id is null or j.estado<>'processando' or j.reserva is distinct from p_reserva then return 'ignorado'; end if;
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
   or a.revisao_manual_admin
   or public.termo_sensivel_anuncio(concat_ws(' ',a.titulo,a.descricao,
     (select string_agg(value,' ') from jsonb_each_text(a.atributos))),a.microrregiao_id) is not null
   or exists(select 1 from public.denuncias where alvo_tipo='anuncio' and alvo_id=a.id and status='aberta')
   or not exists(select 1 from public.categorias c left join public.categorias p on p.id=c.pai_id
     where c.id=a.categoria_id and c.ativa and (p.id is null or p.ativa)) then
   aprovar:=false; razao:='O conteúdo ou a situação do anúncio exige conferência da equipe.';
 end if;
 fim:='manual';
 if aprovar then
   begin
     update public.anuncios set status='ativo',motivo_analise=null where id=a.id returning status into publicado;
     if publicado='ativo' then
       fim:='aprovado';
       perform public.notificar(v.dono_id,'anuncio_aprovado','Seu anúncio foi aprovado',
         'A análise automática foi concluída e seu anúncio está no ar.','/minha-conta/anuncios',
         'moderacao-ia:'||j.id::text);
     else
       razao:='A publicação exige conferência da equipe.';
     end if;
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

-- Reavalia apenas retenções automáticas antigas. A atualização passa por todos os gatilhos.
do $$
declare a public.anuncios; atributos_atuais jsonb;
begin
 for a in select x.* from public.anuncios x join public.vitrines_lojas v on v.id=x.vitrine_id
   where x.status='em_analise' and not x.revisao_manual_admin
     and (x.motivo_analise='Preço fora do normal para a categoria' or x.motivo_analise like 'Palavra bloqueada:%')
     and x.vendido_em is null and x.congelado_motivo is null
     and v.status='ativa' and public.whatsapp_confirmado(v.dono_id)
     and coalesce(char_length(btrim(x.titulo)),0)>=5 and nullif(btrim(x.cidade),'') is not null
     and cardinality(x.fotos)>=coalesce(public.numero_ou_nulo(public.config('anuncio.fotos_minimo',x.microrregiao_id,'1')),0)
     and not exists(select 1 from public.denuncias d where d.alvo_tipo='anuncio' and d.alvo_id=x.id and d.status='aberta')
     and exists(select 1 from public.categorias c left join public.categorias p on p.id=c.pai_id
       where c.id=x.categoria_id and c.ativa and (p.id is null or p.ativa))
   order by x.id for update of x
 loop
   begin
     select public.normalizar_atributos(c.campos,a.atributos,true) into atributos_atuais
       from public.categorias c where c.id=a.categoria_id;
     update public.anuncios set status='ativo',motivo_analise=null,atributos=atributos_atuais where id=a.id;
   exception when check_violation or raise_exception or insufficient_privilege then
     raise notice 'Anúncio % preservado em análise: %',a.id,sqlerrm;
   end;
 end loop;
end $$;

update public.ajuda_perguntas
 set resposta='Ao tocar em **Publicar**, o anúncio entra no ar. Se o texto contiver termos sexuais ou violentos, ele fica pendente para conferência da equipe. Preço não exige moderação. Anúncios denunciados ou com restrição da equipe também podem ficar fora do ar; o motivo aparece em **Meus anúncios**.'
 where pergunta='Meu anúncio está "em análise". O que é isso?'
   and resposta='Alguns anúncios passam por uma conferência da equipe antes de aparecer (por exemplo, preço muito fora do normal ou palavra proibida). Assim que liberarmos, ele vai ao ar e você é avisado.';
