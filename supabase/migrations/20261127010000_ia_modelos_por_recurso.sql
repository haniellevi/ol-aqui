-- Modelo de IA de cada recurso, escolhido no painel (/admin/configuracoes?grupo=ia).
-- Padrão: GPT-6 Luna (openai/gpt-6-luna). Opção: DeepSeek V4.1 Flash. Cada recurso guarda também o
-- modelo que usava antes, para voltar atrás. Chave ausente ou valor fora da lista: usa o padrão.
-- A lista de modelos permitidos é a mesma de src/lib/ia-modelos.ts (um teste confere as duas).
-- Recursos do JEV (TypeSafe) e de imagem não entram aqui: são fixos.

insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('ia.modelo.moderacao', '"openai/gpt-6-luna"', 'ia', false, 'Modelo da análise automática de anúncios retidos'),
  ('ia.modelo.categorizacao', '"openai/gpt-6-luna"', 'ia', false, 'Modelo que sugere a categoria dos anúncios antigos'),
  ('ia.modelo.melhoria', '"openai/gpt-6-luna"', 'ia', false, 'Modelo que melhora título e descrição do anúncio'),
  ('ia.modelo.verificacao', '"openai/gpt-6-luna"', 'ia', false, 'Modelo que lê o comprovante e a fachada da loja'),
  ('ia.modelo.radar', '"openai/gpt-6-luna"', 'ia', false, 'Modelo que escreve os textos do Radar')
on conflict do nothing;

create or replace function public.ia_modelo(p_recurso text)
returns text language plpgsql stable security definer
set search_path = public
as $$
declare
  permitidos text[];
  escolhido text;
begin
  permitidos := case p_recurso
    when 'moderacao' then array['openai/gpt-6-luna', 'deepseek/deepseek-v4.1-flash', 'openai/gpt-4.1-mini']
    when 'categorizacao' then array['openai/gpt-6-luna', 'deepseek/deepseek-v4.1-flash', 'openai/gpt-4.1-mini']
    when 'melhoria' then array['openai/gpt-6-luna', 'deepseek/deepseek-v4.1-flash', 'openai/gpt-4.1-mini']
    when 'verificacao' then array['openai/gpt-6-luna', 'deepseek/deepseek-v4.1-flash', 'openai/gpt-4.1-mini']
    when 'radar' then array['openai/gpt-6-luna', 'deepseek/deepseek-v4.1-flash', 'google/gemini-2.5-flash-lite']
  end;
  if permitidos is null then
    raise exception 'Recurso de IA desconhecido.' using errcode = '22023';
  end if;
  escolhido := public.config('ia.modelo.' || p_recurso, null, 'null') #>> '{}';
  if escolhido = any(permitidos) then return escolhido; end if;
  return 'openai/gpt-6-luna';
end $$;
revoke all on function public.ia_modelo(text) from public, anon, authenticated;
grant execute on function public.ia_modelo(text) to service_role;

-- Moderação: cada análise nova nasce com o modelo escolhido. As pendentes mantêm o modelo gravado
-- (o código ainda aceita o modelo anterior).
alter table public.moderacao_ia alter column modelo set default public.ia_modelo('moderacao');

-- As demais reservas tinham o modelo escrito no corpo da função. Em vez de copiar cada corpo inteiro
-- (e arriscar desfazer uma mudança posterior), troca só o texto do modelo na versão atual do banco.
-- Se a contagem não bater, a migração para sem mudar nada.
do $$
declare
  alvo record;
  corpo text;
  achados integer;
begin
  for alvo in
    select * from (values
      ('public.categorizacao_ia_reservar()'::regprocedure, 'openai/gpt-4.1-mini', 'categorizacao', 2),
      ('public.melhoria_ia_reservar(uuid,text)'::regprocedure, 'openai/gpt-4.1-mini', 'melhoria', 2),
      ('public.verificacao_loja_reservar()'::regprocedure, 'openai/gpt-4.1-mini', 'verificacao', 1),
      ('public.radar_ia_reservar(text,text)'::regprocedure, 'google/gemini-2.5-flash-lite', 'radar', 1)
    ) as t(funcao, antigo, recurso, vezes)
  loop
    corpo := pg_get_functiondef(alvo.funcao);
    achados := (length(corpo) - length(replace(corpo, quote_literal(alvo.antigo), ''))) / length(quote_literal(alvo.antigo));
    if achados <> alvo.vezes then
      raise exception 'A função % tem o modelo % escrito % vez(es); esperado %.', alvo.funcao, alvo.antigo, achados, alvo.vezes;
    end if;
    execute replace(corpo, quote_literal(alvo.antigo), format('public.ia_modelo(%L)', alvo.recurso));
  end loop;
end $$;
