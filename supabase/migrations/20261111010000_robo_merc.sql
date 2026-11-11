-- O robô passa a se chamar Merc (decisão do Raniel em 11/11/2026).
-- Troca só a palavra "Aki" nos textos que o público e a equipe leem.
-- Chaves, grupos, tabelas, funções e o destino 'aki' do atendimento ficam iguais.
do $merc$
declare
  antigo constant text := '\mAki\M';
  novo constant text := 'Merc';
  d public.documentos_legais; proxima integer; titulo_novo text; conteudo_novo text;
  f record; definicao text; definicao_nova text;
begin
  update public.configuracoes
     set valor = regexp_replace(valor::text, antigo, novo, 'g')::jsonb
   where valor::text ~ antigo
     and (jsonb_typeof(valor) = 'string'
          or (jsonb_typeof(valor) = 'array' and not jsonb_path_exists(valor, '$[*] ? (@.type() != "string")')));

  update public.configuracoes
     set descricao = regexp_replace(descricao, antigo, novo, 'g')
   where descricao ~ antigo;

  update public.ajuda_categorias
     set nome = regexp_replace(nome, antigo, novo, 'g'),
         descricao = regexp_replace(descricao, antigo, novo, 'g')
   where concat_ws(' ', nome, descricao) ~ antigo;

  update public.ajuda_perguntas
     set pergunta = regexp_replace(pergunta, antigo, novo, 'g'),
         resposta = regexp_replace(resposta, antigo, novo, 'g')
   where concat_ws(' ', pergunta, resposta) ~ antigo;

  update public.home_blocos
     set titulo = regexp_replace(titulo, antigo, novo, 'g'),
         texto  = regexp_replace(texto, antigo, novo, 'g'),
         botao  = regexp_replace(botao, antigo, novo, 'g')
   where concat_ws(' ', titulo, texto, botao) ~ antigo;

  if exists (select 1 from public.modelos_mensagem
              where concat_ws(' ', quando, titulo, texto, titulo_padrao, texto_padrao) ~ antigo) then
    -- O protetor impede alterações nos textos padrão pelo painel. A pausa dura só esta transação.
    alter table public.modelos_mensagem disable trigger modelos_mensagem_proteger;
    update public.modelos_mensagem
       set quando        = regexp_replace(quando, antigo, novo, 'g'),
           titulo        = regexp_replace(titulo, antigo, novo, 'g'),
           texto         = regexp_replace(texto, antigo, novo, 'g'),
           titulo_padrao = regexp_replace(titulo_padrao, antigo, novo, 'g'),
           texto_padrao  = regexp_replace(texto_padrao, antigo, novo, 'g')
     where concat_ws(' ', quando, titulo, texto, titulo_padrao, texto_padrao) ~ antigo;
    alter table public.modelos_mensagem enable trigger modelos_mensagem_proteger;
  end if;

  -- Termos e privacidade: nova versão só com o nome do robô trocado. Versões e aceites antigos ficam.
  lock table public.documentos_legais in share row exclusive mode;
  for d in select * from public.documentos_legais where ativo loop
    titulo_novo := regexp_replace(d.titulo, antigo, novo, 'g');
    conteudo_novo := regexp_replace(d.conteudo, antigo, novo, 'g');
    if titulo_novo is distinct from d.titulo or conteudo_novo is distinct from d.conteudo then
      select max(versao) + 1 into proxima from public.documentos_legais where tipo = d.tipo;
      update public.documentos_legais set ativo = false where id = d.id;
      insert into public.documentos_legais (tipo, versao, titulo, conteudo, resumo_mudancas, revisado_advogado, ativo)
        values (d.tipo, proxima, titulo_novo, conteudo_novo,
                'O robô do site passou a se chamar Merc.', false, true);
    end if;
  end loop;

  -- Texto guardado quando a resposta do robô chega vazia.
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f' and p.proname = 'abrir_atendimento_cadastro' loop
    definicao := pg_get_functiondef(f.oid);
    definicao_nova := replace(definicao, quote_literal('Resposta do Aki sem texto.'), quote_literal('Resposta do Merc sem texto.'));
    if definicao_nova is distinct from definicao then execute definicao_nova; end if;
  end loop;
end;
$merc$;
