-- Corrige apenas o texto original. Textos personalizados no painel são preservados.
update public.home_blocos
set texto = 'Conte o que procura. As lojas podem enviar propostas, e você escolhe com quem conversar.'
where chave = 'radar'
  and texto = 'Diga o que procura no Radar e as lojas da região te chamam.';
