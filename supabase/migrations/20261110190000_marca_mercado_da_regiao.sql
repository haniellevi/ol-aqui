-- Atualiza apenas textos de configuração, ajuda e modelos de mensagem.
-- Os documentos legais publicados, aceites e funções do banco ficam fora desta migração.
do $marca$
declare
  nome_antigo constant text := '\m(OLAKI|OL-AKI)\M';
  nome_novo constant text := 'Mercado da Região';
begin
  update public.configuracoes
     set valor = regexp_replace(valor::text, nome_antigo, nome_novo, 'g')::jsonb
   where valor::text ~ nome_antigo
     and ((chave in ('ajuda.texto_contato', 'robo.boas_vindas', 'termos.aviso_novo_texto', 'termos.aviso_texto')
           and jsonb_typeof(valor) = 'string')
          or (chave = 'planos.perguntas_frequentes' and jsonb_typeof(valor) = 'array'
              and not jsonb_path_exists(valor, '$[*] ? (@.type() != "string")')));

  update public.configuracoes
     set descricao = regexp_replace(descricao, nome_antigo, nome_novo, 'g')
   where descricao ~ nome_antigo;

  update public.ajuda_perguntas
     set pergunta = regexp_replace(pergunta, nome_antigo, nome_novo, 'g'),
         resposta = regexp_replace(resposta, nome_antigo, nome_novo, 'g')
   where concat_ws(' ', pergunta, resposta) ~ nome_antigo;

  if exists (select 1 from public.modelos_mensagem
              where concat_ws(' ', quando, titulo, texto, titulo_padrao, texto_padrao) ~ nome_antigo) then
    -- O protetor impede alterações nos textos padrão pelo painel. A pausa dura só esta transação.
    alter table public.modelos_mensagem disable trigger modelos_mensagem_proteger;

    update public.modelos_mensagem
       set quando        = regexp_replace(quando, nome_antigo, nome_novo, 'g'),
           titulo        = regexp_replace(titulo, nome_antigo, nome_novo, 'g'),
           texto         = regexp_replace(texto, nome_antigo, nome_novo, 'g'),
           titulo_padrao = regexp_replace(titulo_padrao, nome_antigo, nome_novo, 'g'),
           texto_padrao  = regexp_replace(texto_padrao, nome_antigo, nome_novo, 'g')
     where concat_ws(' ', quando, titulo, texto, titulo_padrao, texto_padrao) ~ nome_antigo;

    alter table public.modelos_mensagem enable trigger modelos_mensagem_proteger;
  end if;
end;
$marca$;
