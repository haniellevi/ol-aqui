-- Radar v2: textos novos da faixa do Radar na home.
-- Só troca o texto que ainda é o padrão antigo: o que o painel já editou fica como está.

update public.home_blocos
   set texto = 'Diga o que precisa. As lojas da região te respondem.'
 where chave = 'radar'
   and texto in ('Diga o que procura no Radar e as lojas da região te chamam.',
                 'Conte o que procura. As lojas podem enviar propostas, e você escolhe com quem conversar.');

update public.home_blocos
   set botao = 'Estou procurando…'
 where chave = 'radar' and botao = 'Pedir no Radar';
