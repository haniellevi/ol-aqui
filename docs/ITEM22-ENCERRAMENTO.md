# Encerramento e autosserviço da vitrine (Item 22, frente B)

Entrega local sobre V25 `938807ecb33ba98a188176b912c00637202b07c3`. Nenhuma operação remota faz parte desta entrega.

## Integração

Aplicar A antes de B. A migração de B é `20261203031000_autosservico_vitrines.sql`, criada pela CLI local e renomeada para a versão reservada, sem colisão na base. Não altera migrações anteriores, preços, planos, política de cupom, Radar, admin ou cron.

`dono_id` continua único, com a FK original, mas admite nulo somente para uma linha purgada, suspensa e excluída. A nova constraint exige titular nas demais linhas. `dono_retido_id` guarda a referência histórica, sem conceder acesso operacional, com atualização em cascata e exclusão do perfil definida como `SET NULL`. `purgada_em` marca a retenção. As novas colunas não recebem concessões para o cliente. As políticas RLS e as ACL existentes permanecem.

Os leitores atuais que filtram `dono_id` deixam de selecionar a loja retida, inclusive `quero_vender`, `lerConta`, contatos e seleção da vitrine. Nenhuma edição de `src/lib/dados/conta.ts` é necessária em B; a alteração promocional desse arquivo pertence a A. B acrescenta ações em `/minha-conta/lojas`, sem alterar a página principal de Minha Conta.

`voucher_nova_loja` e `voucher_atribuir_nova_loja()` foram removidos pela migração `20261202130000`; devem continuar ausentes. B não os recria nem modifica atribuições. A deve preservar essa ausência. A hipótese inicial baseada na definição histórica foi corrigida após conferir a sequência completa de migrações.

RPCs novas para `authenticated`, com autorização própria: `loja_ia_descartar(uuid, integer) -> boolean`, exige dono, revisão atual e rascunho nunca publicado; `sair_da_loja(uuid) -> boolean`, revoga somente os convites aceitos pelo usuário e escreve uma única entrada de histórico quando houve saída. Não é concedida execução ao visitante. Nenhuma chave de serviço passa ao cliente.

O descarte usa a trava de criação já usada na publicação e a trava do rascunho. As FKs apagam trabalhos e callbacks vinculados; callbacks tardios retornam `false`. O trigger existente enfileira os caminhos de mídia numa fila independente. Essa fila aguarda 24 horas, cobrindo URLs de upload já emitidas (validade de duas horas no SDK instalado) e callbacks em trânsito. Mantém o serviço e a agenda de limpeza existentes.

PF usa `excluir_minha_loja` e `restaurar_minha_loja`, inclusive confirmação `EXCLUIR` e lixeira de 30 dias. Encerramento e restauração travam a linha; restauração fora do prazo é recusada após a trava. Suspensão real e exclusão administrativa conservam suas restrições. A conta só fica livre para nova vitrine após a purga.

## Preflight de uma futura aplicação autorizada

Este documento não autoriza conexão ou mudança em produção. Conferir primeiro a sequência de migrações e executar somente com autorização separada. Fazer backup conforme a operação existente antes da aplicação, dentro de uma janela que comporte o bloqueio de escrita da tabela durante a migração.

```sql
-- Resultado esperado: zero linhas. Qualquer divergência de catálogo exige revisão.
select tgname from pg_trigger
where tgrelid='public.vitrines_lojas'::regclass
  and tgname='voucher_nova_loja' and not tgisinternal;
select to_regprocedure('public.voucher_atribuir_nova_loja()'); -- esperado NULL

-- Quantidade de candidatas à recuperação, sem extrair dados pessoais.
select count(*) from public.vitrines_lojas v
where v.dono_id is not null and v.status='suspensa'
  and v.excluida_em <= now()-interval '30 days'
  and v.slug='encerrada-' || v.id and v.cidade='Conta excluída'
  and v.whatsapp is null
  and v.nome in ('Loja encerrada', 'Loja encerrada ' || left(v.id::text,8))
  and v.logo_url is null and v.capa_url is null
  and v.cnpj is null and v.descricao is null
  and not exists(select 1 from public.lixeira_lojas l where l.vitrine_id=v.id)
  and (exists(select 1 from public.pagamentos p where p.vitrine_id=v.id)
    or v.gateway_assinatura_id is not null
    or exists(select 1 from public.anuncios a where a.vitrine_id=v.id)
    or exists(select 1 from public.radar_propostas rp where rp.vitrine_id=v.id));
```

A recuperação é seletiva: exige a assinatura inteira da anonimização antiga, retenção existente, prazo vencido e ausência da lixeira. Não usa apenas nome ou status para decidir. Lojas ativas, suspensas de verdade ou ainda restauráveis não entram na recuperação. Pagamentos, referências congeladas e atribuições continuam na mesma linha histórica.

## Recuperação operacional

Aplicar a migração numa transação, como no runner local. Se falhar antes do commit, fazer rollback integral. Após commit, preferir correção progressiva; não recolocar `NOT NULL`, não religar titulares automaticamente e não recriar o gatilho antigo. Uma pessoa já pode ter aberto outra vitrine, e a unicidade deve continuar protegendo essa nova loja. A coluna histórica permite investigar uma reversão dirigida, sem redistribuir titularidade nem recuperar conteúdo já purgado. Reverter a interface pode ocultar as novas ações sem desfazer a liberação feita no banco.

## Verificação local

`npm run test:db` cria PostgreSQL 17 com `--network none`, sem portas e com armazenamento temporário, usando apenas fixtures sintéticas. Inclui recuperação de uma purga feita pela rotina antiga, controles de loja ativa e suspensão real, preservação de pagamento e atribuição, nova PF após purga, restauração no prazo e recusa fora dele, descarte em coleta/processando/pronto, recusa de publicado e terceiro, callback tardio, mídia pendente e saída de um gerente sem retirar outro. Duas conexões concorrem pela publicação e descarte, exigindo um único resultado consistente. A suíte anterior também cobre retenções congeladas, criação/transferência e demais autorizações.

As fixtures visuais renderizam os componentes reais com fronteiras externas substituídas e CSS do projeto. Verificam largura e alvos de toque em 320, 360 e 390 px. Não substituem uma sessão autenticada ponta a ponta nem o teste de corredor com usuários. Nenhum serviço externo é chamado.
