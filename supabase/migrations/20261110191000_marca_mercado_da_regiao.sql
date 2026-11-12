-- Marca e endereço público. Identificadores técnicos e históricos de aceites permanecem estáveis.
create or replace function pg_temp.marca_atual(texto text) returns text language sql immutable as $f$
  select regexp_replace(replace(replace(texto,'https://ol-aqui.vercel.app','https://mercadodaregiao.com.br'),
    'https://olaki.com.br','https://mercadodaregiao.com.br'), '\m(OLAKI|OL-AKI|OL-AQUI|OLAQUI|Olaki)\M', 'Mercado da Região', 'g')
$f$;

-- Mensagens geradas por funções do banco passam a usar a marca atual.
do $$
declare f record; original text; novo text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.prolang in (select oid from pg_language where lanname in ('sql','plpgsql'))
      and p.prosrc ~ '\m(OLAKI|OL-AKI|OL-AQUI|OLAQUI|Olaki)\M'
  loop
    original:=pg_get_functiondef(f.oid); novo:=pg_temp.marca_atual(original);
    if novo<>original then execute novo; end if;
  end loop;
end $$;

update public.configuracoes set valor=to_jsonb(pg_temp.marca_atual(valor#>>'{}'))
  where jsonb_typeof(valor)='string' and pg_temp.marca_atual(valor#>>'{}') is distinct from valor#>>'{}';
update public.home_blocos set titulo=pg_temp.marca_atual(titulo),texto=pg_temp.marca_atual(texto),botao=pg_temp.marca_atual(botao)
  where row(titulo,texto,botao) is distinct from row(pg_temp.marca_atual(titulo),pg_temp.marca_atual(texto),pg_temp.marca_atual(botao));
update public.ajuda_perguntas set pergunta=pg_temp.marca_atual(pergunta),resposta=pg_temp.marca_atual(resposta)
  where row(pergunta,resposta) is distinct from row(pg_temp.marca_atual(pergunta),pg_temp.marca_atual(resposta));

-- Os textos padrão também precisam mudar para que "restaurar padrão" use a nova marca.
alter table public.modelos_mensagem disable trigger modelos_mensagem_proteger;
update public.modelos_mensagem set nome=pg_temp.marca_atual(nome),quando=pg_temp.marca_atual(quando),
  titulo=pg_temp.marca_atual(titulo),texto=pg_temp.marca_atual(texto),titulo_padrao=pg_temp.marca_atual(titulo_padrao),texto_padrao=pg_temp.marca_atual(texto_padrao)
  where row(nome,quando,titulo,texto,titulo_padrao,texto_padrao) is distinct from
    row(pg_temp.marca_atual(nome),pg_temp.marca_atual(quando),pg_temp.marca_atual(titulo),pg_temp.marca_atual(texto),pg_temp.marca_atual(titulo_padrao),pg_temp.marca_atual(texto_padrao));
alter table public.modelos_mensagem enable trigger modelos_mensagem_proteger;

-- A versão aceita anteriormente não pode ser reescrita. A nova marca ganha versão própria.
do $$
declare d public.documentos_legais; proxima integer;
begin
  for d in select * from public.documentos_legais where ativo
    and row(titulo,conteudo) is distinct from row(pg_temp.marca_atual(titulo),pg_temp.marca_atual(conteudo)) for update
  loop
    select max(versao)+1 into proxima from public.documentos_legais where tipo=d.tipo;
    update public.documentos_legais set ativo=false where id=d.id;
    insert into public.documentos_legais(tipo,versao,titulo,conteudo,resumo_mudancas,revisado_advogado,ativo)
      values(d.tipo,proxima,pg_temp.marca_atual(d.titulo),pg_temp.marca_atual(d.conteudo),
        'Atualização do nome da plataforma para Mercado da Região e do endereço público.',false,true);
  end loop;
end $$;
