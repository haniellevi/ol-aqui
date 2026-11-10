-- Corrige somente a identificação da plataforma. Preserva versões e aceites anteriores.
do $marca$
declare d public.documentos_legais; proxima integer; titulo_novo text; conteudo_novo text;
begin
  lock table public.documentos_legais in share row exclusive mode;
  for d in select * from public.documentos_legais where ativo loop
    titulo_novo := regexp_replace(d.titulo, '\m(OLAKI|OL-AKI|OLAQUI|OL-AQUI)\M', 'Mercado da Região', 'gi');
    conteudo_novo := regexp_replace(replace(replace(d.conteudo, 'ol-aqui.vercel.app', 'mercadodaregiao.com.br'), 'olaki.com.br', 'mercadodaregiao.com.br'), '\m(OLAKI|OL-AKI|OLAQUI|OL-AQUI)\M', 'Mercado da Região', 'gi');
    if titulo_novo is distinct from d.titulo or conteudo_novo is distinct from d.conteudo then
      select max(versao)+1 into proxima from public.documentos_legais where tipo=d.tipo;
      update public.documentos_legais set ativo=false where id=d.id;
      insert into public.documentos_legais(tipo,versao,titulo,conteudo,resumo_mudancas,revisado_advogado,ativo)
        values(d.tipo,proxima,titulo_novo,conteudo_novo,
          'Atualização do nome da plataforma para Mercado da Região e do endereço público.',false,true);
    end if;
  end loop;
end;
$marca$;
