-- Troca da marca: OLAKI passa a se chamar Mercado da Região (docs/MARCA.md).
-- Esta migração muda só TEXTOS que as pessoas leem e que vivem no banco.
-- Nomes internos continuam iguais de propósito: colunas (vendido_pelo_olaki), a flag olaki.sistema,
-- os jobs do cron (olaki-expirar etc.) e o histórico de logs.
-- Pode rodar de novo sem efeito: depois da primeira vez não sobra "OLAKI" para trocar.

-- 1. Textos que a equipe edita no painel: troca só a palavra, preserva o resto (inclusive personalizações).
update public.configuracoes
   set valor = replace(replace(valor::text, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região')::jsonb
 where valor::text ~ 'OLAKI|OL-AKI';
update public.configuracoes
   set descricao = replace(replace(descricao, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região')
 where descricao ~ 'OLAKI|OL-AKI';

update public.ajuda_perguntas
   set pergunta = replace(replace(pergunta, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região'),
       resposta = replace(replace(resposta, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região')
 where pergunta ~ 'OLAKI|OL-AKI' or resposta ~ 'OLAKI|OL-AKI';

update public.modelos_mensagem
   set quando        = replace(replace(quando, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região'),
       titulo        = replace(replace(titulo, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região'),
       texto         = replace(replace(texto, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região'),
       titulo_padrao = replace(replace(titulo_padrao, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região'),
       texto_padrao  = replace(replace(texto_padrao, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região')
 where concat_ws(' ', quando, titulo, texto, titulo_padrao, texto_padrao) ~ 'OLAKI|OL-AKI';

-- 2. Termos de uso e política de privacidade: versão publicada não muda (é a prova do que cada pessoa aceitou).
--    Por isso sai uma VERSÃO NOVA com o nome novo; a anterior fica guardada. Quem já aceitou vê o aviso e aceita de novo.
do $$
declare
  d public.documentos_legais;
begin
  for d in select * from public.documentos_legais where ativo and (titulo ~ 'OLAKI|OL-AKI' or conteudo ~ 'OLAKI|OL-AKI') loop
    update public.documentos_legais set ativo = false where id = d.id;
    insert into public.documentos_legais (tipo, versao, titulo, conteudo, resumo_mudancas, revisado_advogado, ativo, publicado_por)
    values (d.tipo,
            (select max(versao) from public.documentos_legais where tipo = d.tipo) + 1,
            replace(replace(d.titulo, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região'),
            replace(replace(d.conteudo, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região'),
            'O site mudou de nome: o OLAKI agora se chama Mercado da Região. As regras continuam as mesmas.',
            d.revisado_advogado, true, null);
  end loop;
end $$;

-- 3. Mensagens de erro e textos prontos dentro das funções do banco (ex.: "Só a equipe do OLAKI pode ver isso.").
--    Recria cada função com o mesmo corpo, trocando só a palavra. Permissões e dono são preservados.
do $$
declare
  f record;
begin
  for f in
    select pg_get_functiondef(p.oid) as def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.prosrc ~ 'OLAKI|OL-AKI'
  loop
    execute replace(replace(f.def, 'OL-AKI', 'Mercado da Região'), 'OLAKI', 'Mercado da Região');
  end loop;
end $$;
