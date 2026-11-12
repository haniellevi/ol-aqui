-- Códigos oficiais do IBGE das 18 cidades da região (fonte: servicodados.ibge.gov.br, 12/11/2026).
-- Sem eles, a verificação de lojas não reconhece a cidade do CNPJ e manda toda loja para a equipe
-- com "cidade fora da região" (visto no primeiro pedido real em produção).
-- Só preenche onde está vazio; não troca código já preenchido.
update public.cidades c
   set codigo_ibge = x.ibge
  from (values
    ('Avelino Lopes', 'PI', 2201101),
    ('Barreiras do Piauí', 'PI', 2201309),
    ('Bom Jesus', 'PI', 2201903),
    ('Corrente', 'PI', 2202901),
    ('Cristalândia do Piauí', 'PI', 2203008),
    ('Curimatá', 'PI', 2203206),
    ('Gilbués', 'PI', 2204402),
    ('Júlio Borges', 'PI', 2205524),
    ('Monte Alegre do Piauí', 'PI', 2206605),
    ('Morro Cabeça no Tempo', 'PI', 2206654),
    ('Parnaguá', 'PI', 2207603),
    ('Redenção do Gurguéia', 'PI', 2208700),
    ('Riacho Frio', 'PI', 2208858),
    ('Santa Filomena', 'PI', 2209203),
    ('São Gonçalo do Gurguéia', 'PI', 2209757),
    ('Sebastião Barros', 'PI', 2210623),
    ('Barreiras', 'BA', 2903201),
    ('Formosa do Rio Preto', 'BA', 2911105)
  ) as x(nome, uf, ibge)
 where c.nome = x.nome and c.uf = x.uf and c.codigo_ibge is null
   and not exists (select 1 from public.cidades o where o.codigo_ibge = x.ibge);
