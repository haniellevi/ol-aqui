# Interfaces de A/B/C para Admin D/E

Item 34 integra as ondas e não implementa D/E. Contratos normativos: `MEDICAO.md` e `ativacao-lojistas.md`.

## D: fontes, permissões e denominadores

`admin_medicao_resumo(p_de date,p_ate date) -> jsonb` exige `e_admin()` e retorna `fonte=interno`, `coorte=consentida_v1`, `pageviews`, `navegadores`, `sessoes`, `sem_dados`. Limite inicial inclusivo e final exclusivo no dia seguinte. Não há recortes de região, categoria, campanha ou dispositivo nessa RPC; não apresentar filtros como aplicados sem implementá-los na fonte e testar suas permissões. Não tratar ausência de observações como ausência de pessoas.

`admin_visitas(date,date)` é legado compatível. Nunca concatenar com a coorte nova. `metricas_marcos` fornece corte; excluir dia misto das comparações homogêneas. `buscas_faixas_dia` é série nova por região/categoria/faixa, sem termos e sem identidade. Taxa zero usa todas as consultas válidas consentidas do mesmo recorte como denominador. Produto/loja conservam janela e agregados existentes, que não equivalem a pageviews ou sessões.

Criação/recebimento de loja, publicação de anúncio, atribuição de voucher, pagamento confirmado e pedido/proposta Radar são fatos persistidos existentes. O Admin deve reutilizar consultas autorizadas, definir elegibilidade, período, denominador e maturidade de cada funil. Nenhum evento de clique em convite, cupom, conta ou conversa foi adicionado. Reabrir sucesso não cria conversão. Cupom sugerido não é resgate; contato não é venda. Loja ativa com anúncio publicado exige cruzar estado real dos dois recursos.

Todo indicador deve informar fonte/coorte/período/frescor e distinguir sem dados, erro e indisponibilidade. Ranking precisa manter isolamento regional e autorização administrativa. Não oferecer exportação pessoal nem supor filtros ou coortes que a fonte não guarda.

## E: fronteira externa permanece desligada

`DESTINOS` fixa GA4/Meta em falso. `eventoPermitido` valida envelope mínimo estrito e não envia nada. Futuro adaptador deve consumir somente nome enum, rota neutra, faixa autorizada e fonte/coorte, com allowlist própria, consentimento pertinente e configuração por ambiente. Não transmitir IDs internos, termos livres, nomes, contatos, token, cupom, slug individual ou URL bruta. Não criar tag duplicada nem espelhar RPC interna em eventos externos.

Origem é catálogo fechado, com prioridade de `origem` sobre `utm_source` e validação de código ativo no banco. Campanha livre e utm_medium/content/term não são coletados. D/E precisam de decisão explícita sobre catálogo de campanha antes de anunciar atribuição por campanha. Configuração real, política ativa, retenção e campanhas permanecem decisões posteriores, sem impedir esta candidata local.

## Composição preservada

B mantém `registrarEventoLoja` e `MedirAparicoes` gated por A; C mantém primeiro anúncio, regra V26 e cupom só preenchido. Preferências são conteúdo no fim da página, com reserva do token de navegação mobile para permitir revisar/retirar escolhas acima da barra fixa. Nenhuma sobreposição de arquivos entre as três ondas foi encontrada.
