# Roteiro de produção: verificação de lojas, Radar e cortesia de 30 dias

Para quem não é técnico. Cada passo diz o que faz e qual é o risco.
Marca **[precisa do sim do Raniel]** = mexe na produção. Ninguém executa sem o "sim" no chat.
Marca **[só leitura]** = só consulta, não muda nada.

Onde rodar as consultas: Supabase > projeto OLAKI > **SQL Editor**. Cole, clique em **Run**.

---

## Antes de tudo (4 conferências)

1. **Vercel com Node 22 ou mais novo.** O projeto exige Node 22 ou mais (`engines` no `package.json`).
   Vercel > projeto > Settings > General > **Node.js Version** = 22.x (ou mais). Se estiver 20 ou menos, o deploy falha ou se comporta mal.
   Risco: site fora do ar até corrigir.
2. **Política de privacidade.** O texto precisa dizer que os documentos enviados para a verificação são apagados quando a conferência termina,
   **guardados por no máximo 7 dias** se a equipe precisar rever (revisão por amostra). Sem isso, publicar viola a promessa que a tela faz.
   Risco: problema com a LGPD. A política não foi revisada por advogado.
3. **CNPJ com letras ainda não funciona.** O novo CNPJ alfanumérico (letras e números) **não é aceito** nesta versão. Loja com esse CNPJ cai na equipe ou é recusada.
   Aviso para o suporte: se alguém reclamar disso, não é erro do cliente.
4. **Risco de banimento do WhatsApp.** Os avisos por WhatsApp saem pelo número do **Evolution** (WhatsApp não oficial).
   Mandar muita mensagem automática pode fazer a Meta **banir o número**. Por isso as chaves de WhatsApp ficam por último e só 8h–20h.
   Use um número que você aceite perder. Se for banido, os avisos no sino do site continuam; só o WhatsApp para.

---

## Passo 0. Conferir os números antes de dar a cortesia [só leitura]

Mostre estes números ao Raniel **antes** de aplicar as migrações.

**A. Quantas lojas e vendedores PF ganhariam a cortesia de 30 dias** (pagam, estão ativos e não têm selo):

```sql
select v.tipo, count(*) as quantas
from vitrines_lojas v
cross join lateral plano_efetivo(v) p
where v.status = 'ativa'
  and p.codigo is not null and p.acesso_radar and not p.e_teste and p.preco_centavos > 0
  and not coalesce(case when v.tipo = 'loja' then v.selo_loja_verificada
        else (select pf.selo_negociador_certificado and pf.verificacao_pf_em is not null from perfis pf where pf.id = v.dono_id) end, false)
group by v.tipo;
```

**B. Lojas pagas sem selo, por plano** (as mesmas, em lista):

```sql
select v.nome, v.tipo, v.plano, v.plano_expira_em
from vitrines_lojas v
cross join lateral plano_efetivo(v) p
where v.status = 'ativa'
  and p.codigo is not null and p.acesso_radar and not p.e_teste and p.preco_centavos > 0
  and not coalesce(case when v.tipo = 'loja' then v.selo_loja_verificada
        else (select pf.selo_negociador_certificado and pf.verificacao_pf_em is not null from perfis pf where pf.id = v.dono_id) end, false)
order by v.nome;
```

**C. Selos dados na mão (sem data de conferência do CNPJ).** Quando a reconferência mensal for ligada (passo 8),
essas lojas serão conferidas na Receita e **podem perder o selo** se o CNPJ não estiver ativo ou não for achado:

```sql
select count(*) as selos_manuais
from vitrines_lojas
where selo_loja_verificada and cnpj_conferido_em is null;
```

Para ver quais são: troque `count(*) as selos_manuais` por `nome, cnpj, cidade` e acrescente `order by nome`.
Decisão para o Raniel: se o número for alto, confira o CNPJ dessas lojas antes do passo 8.

---

## Passo 1. Migrações pelo editor SQL [precisa do sim do Raniel]

O que faz: cria as tabelas e funções do Radar v2, da verificação de lojas e da cortesia.
Risco: a migração da cortesia **já dá os 30 dias e manda o aviso no sino** para as lojas do Passo 0-A, na hora.
Não dá para "desavisar". Por isso o Passo 0 vem antes.

Ordem (arquivos da pasta `supabase/migrations`, cada um colado inteiro no editor, na ordem do nome):

1. Todos os `20261117*` do Radar v2 (que ainda não estiverem no banco).
2. Todos os `20261118*`, em ordem. O último é `20261118080000_cortesia_lancamento.sql` (a cortesia).

Dica de segurança: antes, faça backup (Supabase > Database > Backups) e confira com
`select max(version) from supabase_migrations.schema_migrations;` o que já foi aplicado.

Conferir depois:

```sql
select count(*) as cortesias_de_lancamento from radar_cortesias where criado_por = 'sistema';
```

Tem que bater com o número do Passo 0-A.

---

## Passo 2. Código na Vercel [precisa do sim do Raniel]

O que faz: publica o site novo (tela "Verificar minha loja", Radar v2). Conferir antes que a Vercel usa Node 22 ou mais.
Risco: site fora do ar se o deploy falhar; dá para voltar para o deploy anterior na Vercel (Deployments > ... > Promote to Production no deploy antigo).
Também confira nas variáveis da Vercel (só os **nomes**, sem mostrar valores) que a chave da IA (OpenRouter) e a chave das rotinas estão preenchidas.

---

## Passo 3. Conferir os crons [só leitura]

```sql
select jobname, schedule, active
from cron.job
where jobname in ('olaki-verificacao-loja','olaki-whatsapp-fila','olaki-verificacao-lembrete',
                  'olaki-verificacao-amostras','olaki-verificacao-reconferir','olaki-cortesia-fim')
order by jobname;
```

Têm que aparecer **6 linhas**, todas com `active = true`. Se faltar alguma, o pg_cron ou o pg_net não estão ligados
(Supabase > Database > Extensions) e a migração pulou o agendamento; peça ajuda antes de seguir.

---

## As chaves da verificação (todas começam desligadas)

Ficam na tabela `configuracoes`. Para **ligar**, rode o `update` da coluna "Ligar"; para **desligar**, o da coluna "Desligar".
Todas são **[precisa do sim do Raniel]**. Desligar é sempre seguro e imediato (vale na hora, sem deploy).

| Chave | O que faz | Ligar | Desligar |
|---|---|---|---|
| `verificacao.whatsapp_equipe` | Avisa a equipe por WhatsApp quando um pedido chega | `update configuracoes set valor = 'true' where chave = 'verificacao.whatsapp_equipe' and microrregiao_id is null;` | trocar `'true'` por `'false'` |
| `verificacao.ia_ativa` | A IA confere os documentos. Desligada, tudo vai para a equipe | `update configuracoes set valor = 'true' where chave = 'verificacao.ia_ativa' and microrregiao_id is null;` | trocar `'true'` por `'false'` |
| `verificacao.ia_ligada_em` | Data em que a IA foi ligada (começa os 14 dias de revisão total). Sem data, a equipe revisa tudo | `update configuracoes set valor = to_jsonb(now()::text) where chave = 'verificacao.ia_ligada_em' and microrregiao_id is null;` | `update configuracoes set valor = 'null'::jsonb where chave = 'verificacao.ia_ligada_em' and microrregiao_id is null;` |
| `verificacao.whatsapp_loja` | Avisa a loja por WhatsApp quando o pedido é decidido | `update configuracoes set valor = 'true' where chave = 'verificacao.whatsapp_loja' and microrregiao_id is null;` | trocar `'true'` por `'false'` |
| `verificacao.reconferencia_ativa` | Reconfere todo mês o CNPJ das lojas com selo na Receita. **Pode tirar selos** | `update configuracoes set valor = 'true' where chave = 'verificacao.reconferencia_ativa' and microrregiao_id is null;` | trocar `'true'` por `'false'` |

Também existem os números `verificacao.amostra` (padrão 10: depois dos 14 dias, a equipe revê 1 em cada 10 aprovações da IA),
`verificacao.dias_revisao_total` (padrão 14) e `verificacao.prazo_equipe_horas` (padrão 24). Não precisa mexer.

Ver como cada chave está agora [só leitura]:

```sql
select chave, valor from configuracoes where chave like 'verificacao.%' order by chave;
```

Se o `update` disser "0 rows", a migração das chaves não rodou (volte ao Passo 1).

---

## Passos 4 a 8: ligar, na ordem, um de cada vez

Espere e confira entre um passo e outro. Se algo estranho aparecer, desligue a chave do passo e me avise.

**Passo 4. `verificacao.whatsapp_equipe` [precisa do sim do Raniel].**
Faz: a equipe (suporte e administrador) recebe WhatsApp quando chega um pedido, só entre 8h e 20h (Fortaleza).
Risco: as primeiras mensagens automáticas do número Evolution; veja o aviso de banimento acima.
Conferir: faça um pedido de teste numa loja de teste e veja se a equipe é avisada.

**Passo 5. `verificacao.ia_ativa` junto com `verificacao.ia_ligada_em` [precisa do sim do Raniel].**
Rode os dois `update` da tabela, um depois do outro (primeiro a data, depois a chave).
Faz: a IA passa a conferir os documentos. Nos 14 primeiros dias a equipe revê **todas** as aprovações da IA; depois, 1 em cada 10.
Risco: gasto com a IA (limite no orçamento do robô) e a IA errar; por isso a revisão total.

**Passo 6. `verificacao.whatsapp_loja` [precisa do sim do Raniel].**
Faz: a loja recebe WhatsApp quando o pedido é decidido. Risco: mais mensagens pelo número Evolution.

**Passo 7. Esperar e olhar.** Deixe rodar alguns dias. Veja pedidos parados, erros e se a equipe responde em até 24 horas.

**Passo 8. `verificacao.reconferencia_ativa` [precisa do sim do Raniel] - por último, só depois de contar o Passo 0-C.**
Faz: todo mês as lojas com selo têm o CNPJ conferido na Receita (uma rotina diária pega as que estão vencidas, em lotes pequenos).
Risco: a loja cujo CNPJ estiver inativo ou não for achado **perde o selo** e a loja é avisada (e a equipe também). Selos manuais (Passo 0-C) entram nessa conta.

---

## Depois de 30 dias da cortesia

A cortesia vence sozinha: quem não verificou a loja deixa de atender o Radar naquele minuto (nada a fazer).
Sete dias antes, a loja recebe um aviso no sino (uma vez só). Quem verificar a tempo continua sem interrupção.
Para ver quem ainda está sem selo perto do fim [só leitura]:

```sql
select v.nome, v.tipo, c.ate
from radar_cortesias c join vitrines_lojas v on v.id = c.vitrine_id
where c.criado_por = 'sistema' and c.ate > now() and c.ate <= now() + interval '7 days'
order by c.ate;
```

## Se der errado

- Desligar qualquer chave: o `update` da coluna "Desligar". Vale na hora.
- Cortesia dada por engano a uma loja: no editor SQL, **[precisa do sim do Raniel]**:
  `update radar_cortesias set ate = now() where vitrine_id = '<id da loja>';` (encerra a cortesia sem apagar o registro).
- Site com problema depois do deploy: Vercel > Deployments > promover o deploy anterior.
