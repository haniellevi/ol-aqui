-- Atualiza os textos ativos da assistente em dados já gravados pelo painel.
-- Documentos legais publicados, aceites e mensagens anteriores conservam a redação original.
update public.configuracoes
set valor = to_jsonb(regexp_replace(
  regexp_replace(
    valor #>> '{}',
    '\m(sou) o (Merc|Aki), o ajudante do Mercado da Região',
    '\1 a Lia, a assistente do Mercado da Região',
    'gi'
  ),
  '\m(sou) o (Merc|Aki)\M', '\1 a Lia', 'gi'
))
where chave = 'robo.boas_vindas'
  and jsonb_typeof(valor) = 'string'
  and (valor #>> '{}') ~* '\msou o (Merc|Aki)\M';

update public.configuracoes
set descricao = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(descricao, 'Robô (Merc|Aki) ligado', 'Lia ligada'),
      '\mao (Merc|Aki)\M', 'à Lia', 'g'
    ),
    '\mdo (Merc|Aki)\M', 'da Lia', 'g'
  ),
  '\mo (Merc|Aki)\M', 'a Lia', 'g'
)
where chave in (
  'robo.ativo', 'robo.limite_diario_pessoa', 'robo.boas_vindas',
  'robo.temas_proibidos', 'robo.max_caracteres_mensagem', 'robo.max_caracteres_resposta',
  'robo.max_ferramentas', 'robo.historico_mensagens', 'robo.foto_lado_maximo',
  'robo.foto_max_kb', 'robo.max_conversa_mensagens', 'robo.reserva_tokens_entrada'
)
  and descricao ~ '\m(Merc|Aki)\M';

update public.configuracoes
set descricao = replace(descricao, '(ele explica', '(ela explica')
where chave = 'robo.temas_proibidos' and descricao like '%a Lia não conversa (ele explica%';

update public.ajuda_perguntas
set pergunta = 'Quem é a Lia?',
    resposta = regexp_replace(
      resposta,
      '^O (Merc|Aki) é o robô do Mercado da Região, feito com inteligência artificial\. Ele ajuda',
      'A Lia é a assistente do Mercado da Região, feita com inteligência artificial. Ela ajuda'
    )
where categoria = 'conta' and pergunta in ('Quem é o Merc?', 'Quem é o Aki?');

-- Troca apenas mensagens geradas daqui em diante, preservando permissões e lógica das funções.
do $$
declare
  definicao text;
begin
  definicao := pg_get_functiondef('public.abrir_atendimento_cadastro(bigint)'::regprocedure);
  if definicao ~ 'Resposta do (Merc|Aki) sem texto\.' then
    execute regexp_replace(definicao, 'Resposta do (Merc|Aki) sem texto\.', 'Resposta da Lia sem texto.');
  end if;

  definicao := pg_get_functiondef('public.loja_ia_publicar(uuid,integer,jsonb,jsonb)'::regprocedure);
  if definicao like '%Escolha o modelo do Merc ou deixe a capa em branco.%' then
    execute replace(definicao,
      'Escolha o modelo do Merc ou deixe a capa em branco.',
      'Escolha o modelo da Lia ou deixe a capa em branco.');
  end if;
end;
$$;
