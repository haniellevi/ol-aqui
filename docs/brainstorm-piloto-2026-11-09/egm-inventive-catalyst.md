# Catalisador inventivo Brainstormer

Modo: BRAINSTORM. Recorte: `2f00c55df54cad2a4a687e4641a821566c800630`. Status: parecer concluído; recomendações não aprovadas.

Critério de sucesso: identificar apenas contradições sustentadas no piloto acompanhado, propor a menor ação que preserve negociação e aprendizado, declarar seu custo secundário e fornecer aceite verificável.

Princípio: separar uma exigência de integridade de uma escolha operacional. A prova de posse do telefone exige confirmação válida; essa restrição não desaparece com um padrão de arquitetura. Já o acompanhamento humano e a observação do resultado podem ser separados sem ampliar a plataforma.

Encontrei duas contradições materiais no desenho do experimento. São tensões entre o comportamento comprovado no código e o aprendizado desejado, ainda sem resultado empírico do piloto. Nenhum Blocker foi estabelecido nesta lente. Isso não certifica a abertura nem substitui a verificação das condições reais de operação.

## 1. Major: o acompanhamento pode produzir o retorno que o piloto pretende observar

**Dimensão:** eliminação de contradições e transformações inventivas.

**Contradição sustentada:** aumentar a intervenção da equipe favorece a descoberta dos pedidos e o avanço das propostas, mas reduz a capacidade de atribuir o retorno à iniciativa dos participantes. A ausência de resposta também fica ambígua: pode indicar falta de interesse comercial, falta de aviso percebido ou dificuldade de uso. No modo de propostas privadas, essa tensão é concreta porque o aviso comercial funciona dentro do site.

**Código comprovado:** `src/components/conta/sino-avisos.tsx:19-43` consulta a contagem quando a página está visível, a cada minuto e ao recuperar foco. `src/lib/tipos-relatorios.ts:40-41` mantém somente `notificacao` entre os canais ativos; `src/app/admin/mensagens/form-modelo.tsx:138-144` informa que os demais ainda não enviam. A versão cumulativa de `radar_aviso`, em `supabase/migrations/20261108060000_mensagens_relatorios.sql:304-340`, grava por `notificar`, cujo canal padrão é `app` em `supabase/migrations/20261108020000_radar_completo.sql:162-181`. O envio via Evolution examinado é específico de OTP (`src/lib/whatsapp/servico.ts:46-62`); sua existência não comprova avisos comerciais por WhatsApp. A origem do pedido diferencia `site` e `aki` (`supabase/migrations/20261108020000_radar_completo.sql:46-52`), sem identificar ajuda humana nessa coluna.

**Padrões úteis do catálogo:** *Segmentation* para separar a etapa acompanhada da janela de observação, com resultados registrados em grupos distintos; *Preliminary Action* para definir antes do primeiro pedido o horário de observação, a forma de pedir ajuda e o que contará como intervenção. São aplicações ao protocolo do piloto, sem nova camada de software. O primeiro padrão acrescenta coordenação e comparação entre grupos; o segundo exige preparação e pode deixar tempo reservado sem utilização.

**Menor ação proporcional:** usar uma única ficha do piloto, identificada por participante e pedido, com horário de criação, primeira resposta útil, intervenção da equipe, motivo e retorno posterior. Registrar se houve ajuda no cadastro, lembrete de pedido, ajuda para enviar proposta ou acompanhamento solicitado. Depois da primeira execução acompanhada, observar uma janela previamente combinada sem lembrete individual de retorno. Ajuda solicitada ou necessária continua disponível e fica registrada. Uma resposta útil deve tratar disponibilidade e próximo passo, com preço ou motivo claro para sua ausência; um simples contato não basta. O prazo e a duração dessa janela são parâmetros de teste a definir com os participantes, sem presumir equipe disponível.

**Custo operacional secundário:** a equipe precisa preencher horários e motivos com disciplina. Uma janela sem lembrete pode gerar menos negócios no curto prazo; interrompê-la para resolver um problema importante é aceitável, desde que o caso saia da contagem de retorno sem intervenção. A ficha precisa de acesso restrito e não precisa copiar conversas ou telefones.

**Resultado ideal:** a mesma operação consegue ajudar quem precisa e informar, separadamente, quanto resultado exigiu ajuda, quanto veio de retorno sem lembrete e qual esforço foi necessário. O resultado não exige um provedor adicional de mensagens nem instrumentação geral de navegação.

**Aceite:** todo retorno incluído no resultado tem origem classificada como sem lembrete observado, após intervenção ou desconhecida; toda primeira resposta útil tem horário e indicação de assistência. Casos sem informação ficam como desconhecidos. A apresentação do piloto mostra os grupos separadamente e relata os minutos de suporte. Novos pedidos ou propostas observáveis podem comprovar retorno; visitas que o mecanismo atual não captura permanecem fora da conclusão. Esse desenho produz evidência descritiva, sem alegar causalidade ou taxa de retenção populacional.

**Contra-argumento:** um piloto pequeno pode ter apenas a finalidade de destravar o fluxo. Nesse caso, acompanhar todos integralmente é coerente, desde que o resultado seja descrito como conclusão assistida. A recomendação continua necessária enquanto a hipótese incluir aprendizado sobre retorno dos participantes. Automatizar lembretes agora apenas mudaria a origem da intervenção e criaria custo operacional adicional.

## 2. Major: sair rapidamente para o WhatsApp reduz o atrito e também a observação do desfecho

**Dimensão:** eliminação de contradições e transformações inventivas.

**Contradição sustentada:** deixar a negociação prosseguir no canal familiar facilita o contato, mas o produto deixa de observar a conversa e o negócio. Exigir que toda conclusão aconteça dentro do aplicativo ampliaria o fluxo justamente antes de comprovar demanda. O falso compromisso seria tratar escolha ou encerramento como venda para evitar esse trabalho de observação.

**Código comprovado:** `src/app/radar/actions.ts:139-151` escolhe a proposta e retorna um link `wa.me`. `src/components/radar/propostas-recebidas.tsx:84-107` navega para esse link e atualiza a tela; não recebe confirmação de mensagem enviada ou de negócio. `supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:209-214` grava `escolhida` e `escolhida_em` e devolve o contato. Em `supabase/migrations/20261108020000_radar_completo.sql:475-491`, apenas o comprador encerra o próprio pedido como `resolvido`, que vira `atendido`, sem exigir proposta escolhida ou confirmação da loja. O relatório existente (`supabase/migrations/20261108060000_mensagens_relatorios.sql:505-530`) agrega eventos e vendas declaradas de anúncios, sem fornecer o desfecho bilateral do Radar.

**Padrões úteis do catálogo:** *Segmentation* para manter contato solicitado, oferta escolhida, negócio relatado e negócio confirmado como estados distintos no instrumento de avaliação; *Extraction / Taking Out* para retirar a coleta do desfecho da jornada comercial e fazê-la numa ficha curta vinculada ao pedido. O primeiro adiciona estados a classificar; o segundo cria um artefato operacional que precisa ser conciliado com os registros do aplicativo. Não há razão demonstrada para criar chat, checkout, fila de eventos ou serviço externo apenas para isso.

**Menor ação proporcional:** acrescentar à mesma ficha um resultado do comprador, um resultado da loja e a data de cada resposta, com referência ao pedido e à oferta quando houver. A equipe faz uma verificação curta depois do prazo combinado para o negócio. A marca de oferta escolhida registra intenção de conversar. Um relato de apenas uma parte fica como negócio relatado. Só a concordância das duas partes sobre a negociação correspondente recebe a classificação de confirmado pelos participantes. Divergência, desistência e ausência de resposta ficam visíveis; não viram falha nem sucesso por suposição. A pergunta pode ser feita sem solicitar valor sensível, comprovante bancário ou cópia da conversa.

**Custo operacional secundário:** duas confirmações exigem disponibilidade da equipe e dos participantes; o não retorno gera casos inconclusivos. O contato de avaliação também pode estimular uma nova visita, por isso entra como intervenção no achado anterior. Confirmação bilateral é um relato concordante, sem equivaler a auditoria de pagamento ou garantia contra fraude.

**Resultado ideal:** a negociação segue no canal escolhido e o piloto consegue ligar cada conclusão declarada à origem, ao esforço de ajuda e à evidência disponível, sem alterar o status comercial do banco para satisfazer o relatório.

**Aceite:** a consolidação apresenta as quatro etapas em contagens distintas; nenhum clique, link aberto, oferta escolhida ou pedido `atendido` é promovido automaticamente a negócio confirmado. Cada confirmação tem duas respostas correspondentes, com casos inconclusivos e divergentes separados. O uso da mesma ficha permite conferir se a coleta de resultado provocou o retorno observado.

**Contra-argumento:** se o objetivo fosse apenas comprovar que o contato pode ser aberto, a classificação atual de escolha seria suficiente. Como a hipótese pede negociações reais, conclusão e retorno, a menor evidência adicional é o relato das partes. Incorporar esse processo ao produto só passa a fazer sentido se o volume e o custo manual medidos justificarem a mudança.

## Onde não encontrei um falso compromisso a resolver

**Ativação e integridade: No false compromise detected.** O bloqueio sem telefone confirmado é uma fronteira de integridade explícita. A migração cumulativa `supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:3-30` remove a antiga opção de dispensar confirmação e protege operações no banco. `src/app/completar-perfil/page.tsx:29-37` encaminha a pessoa para confirmar. A reserva de OTP possui cotas e consumo único (`supabase/migrations/20261110012622_confirmacao_whatsapp.sql:39-76`), e a indisponibilidade preserva a recusa (`src/app/confirmar-celular/page.tsx:20-25`; `src/app/confirmar-celular/actions.ts:20-30`). Facilitar o piloto desligando essa exigência contradiz a própria garantia. A dependência do provedor é real, mas não comprova necessidade de redundância agora. Uma verificação prévia com conta nova e canal para reagendar quando indisponível é proporcional; exige tempo de preparação e não deve apagar a medição da dificuldade de cadastro. A execução dessa verificação não ocorreu nesta revisão.

**Custo e automação: No false compromise detected.** O Aki já possui liga/desliga, limite por pessoa e reserva de estimativa no orçamento (`supabase/migrations/20261107031000_robo_aki.sql:271-292,306-337`; `src/lib/aki/motor.ts:193-205`). Isso permite definir o experimento sem impor a presença da IA em todo fluxo. Os valores correntes, a suficiência das estimativas e os custos externos não foram verificados. A decisão proporcional é manter as automações existentes sob limites definidos e registrar minutos de apoio antes de contratar ou construir outra automação. O custo dessa escolha é disciplina operacional e eventual trabalho manual durante o piloto.

**Acesso comercial e teste de retorno: No false compromise detected.** A semente define três propostas para o teste, e `propostas_restantes` conta o consumo desde a criação da vitrine enquanto o plano for de teste (`supabase/migrations/20261107010100_painel_admin.sql:63-68,177-195`). Esses valores são editáveis e não comprovam a configuração em produção. Somar dias de cortesia ao teste não repõe propostas. A versão cumulativa de `admin_acao_loja` já permite a um administrador conceder um plano por período, com motivo e histórico (`supabase/migrations/20261108050000_equipe_compliance.sql:520-535,544-574,597-605`). Antes de medir repetição, convém conferir se cada convidado tem acesso e cota suficientes para o experimento; concessões individuais devem ter prazo, registro e comunicação explícita. Isso evita confundir cota esgotada com desinteresse, sem mexer em segurança nem depender de cobrança real. A contrapartida é administrar concessões e não interpretar uso subsidiado como disposição a pagar.

## Grau de evidência e limites

**Código comprovado:** as constatações acima são leituras estáticas do commit fixado, incluindo a busca de redefinições posteriores das funções citadas. Não afirmam que o banco ou a implantação em produção estejam nesse estado.

**QA histórico:** os documentos de Radar e plano relatam regressões e uso de fixtures; o QA do plano informa sandbox e ausência de cobrança real. O QA de WhatsApp relata recebimento e confirmação reais numa prévia, persistência e posterior publicação. São relatos históricos lidos integralmente, sem repetição desses ensaios nesta lente. O texto anterior do QA de plano que ainda tratava a confirmação como pendente foi superado no código e no documento de WhatsApp; não foi usado como defeito atual.

**Hipóteses:** utilidade comercial das propostas, retorno sem ajuda, custo de acompanhamento e suficiência dos limites para a amostra. Não há números observados de conversão, retenção, disponibilidade ou custo de suporte nesta revisão.

**Produção não verificada:** entrega atual de OTP, preferências e avisos efetivamente vistos, regiões ativas, cotas correntes, catálogo de planos, sessão e dispositivo dos convidados, agendamentos e dados persistidos. Nenhuma recomendação autoriza convites, mensagens, publicação, cobrança ou execução de alterações.

Não executei testes, build, banco, serviços externos ou auditoria das alterações concorrentes de moderação por IA. Não li memórias, conversas, concepts_brief.md, verificacao-atual.md, roteiro-piloto.md ou pareceres alheios. A única escrita desta lente é este arquivo.

## Registro de leituras

A persona foi lida integralmente, incluindo os dez padrões embutidos. Trechos que guiaram a avaliação: “Verify Contradiction Existence”, “Every architectural pattern introduces secondary operational trade-offs” e “How could this system deliver its core function with minimal added operational overhead?”. Não foi buscado catálogo adicional. A hipótese foi lida integralmente, incluindo “Distinguir contato iniciado, oferta escolhida, negócio relatado e negócio confirmado pelos participantes”.

Os hashes abaixo são SHA-256; os curtos mostram os primeiros 16 caracteres. Todos os arquivos rastreados foram obtidos com `git show` do recorte fixado, inclusive quando a cópia de trabalho poderia divergir. “Trechos” identifica leitura parcial orientada por símbolos; não significa revisão integral do arquivo.

- Persona e catálogo: `/home/raniel-linux/.codex/plugins/cache/egm/egm/0.1.1/agents/inventive_catalyst.md`. Leitura integral. SHA-256 `e766638298dfa42859172df62d1c0a4faa9ade143bcfc92837b5843a684e1da4`.
- Hipótese: `/home/raniel-linux/workspace/OLAQUI/docs/brainstorm-piloto-2026-11-09/hipotese.md`. Leitura integral. SHA-256 `c0246331ecc893954193f1a59be96a670a90696fe63d2c510a4a1a0bdf496d44`.

| Fonte | Leitura efetiva | SHA-256 curto |
|---|---|---|
| `README.md` | Integral | `eefff69f2382183b` |
| `package.json` | Integral | `1b49959e46284d49` |
| `docs/CORRECOES-FLUXO-2026-11-09.md` | Integral | `85a98209cf498811` |
| `docs/QA-RADAR-2026-11-09.md` | Integral | `4adf95b28cf27d60` |
| `docs/QA-WHATSAPP-2026-11-09.md` | Integral | `79269508ee0cc14e` |
| `docs/QA-MEU-PLANO-2026-11-09.md` | Integral | `66b5265a9eb8c317` |
| `docs/etapa5/relatorios.md` | Integral | `610fed3364604f3b` |
| `docs/etapa4/paginas.md` | Integral | `fa04d3fac0bd3f0c` |
| `src/lib/whatsapp/servico.ts` | Integral | `8b4f3529de927ef4` |
| `src/app/confirmar-celular/actions.ts` | Integral | `a28791cc7e775bf2` |
| `src/app/confirmar-celular/page.tsx` | Integral | `d18696c8b838887f` |
| `src/middleware.ts` | Integral | `8b27dc9dfba4171e` |
| `supabase/migrations/20261110014434_whatsapp_obrigatorio.sql` | Integral | `d526e6624a79e9df` |
| `supabase/migrations/20261110012622_confirmacao_whatsapp.sql` | Integral | `b1a96362202fe9d2` |
| `src/app/completar-perfil/page.tsx` | Integral | `ee06572749c7e925` |
| `supabase/migrations/20261109195657_notificacoes_confiaveis.sql` | Integral | `2ba668ac439ec13e` |
| `src/components/conta/sino-avisos.tsx` | Integral | `3759999df56718ee` |
| `src/app/admin/mensagens/form-modelo.tsx` | Integral | `94693a1631864a6c` |
| `src/components/radar/propostas-recebidas.tsx` | Integral | `9beaa057e7e88f7e` |
| `src/app/radar/actions.ts` | Trechos 1-167 | `f398c555622fbe9b` |
| `src/lib/tipos-relatorios.ts` | Trechos 1-44 | `eb390b7b18e0b3ec` |
| `supabase/migrations/20261108020000_radar_completo.sql` | Trechos 45-81,117-132,162-207,465-494,890-966 | `568b33b506a890b5` |
| `supabase/migrations/20261108060000_mensagens_relatorios.sql` | Trechos 284-343,505-540 | `e823e2d5e43b237b` |
| `supabase/migrations/20261107010100_painel_admin.sql` | Trechos 48-72,167-200 | `5565d1c6c7ffad49` |
| `supabase/migrations/20261108010000_cobranca_planos.sql` | Trechos 1020-1118; confrontado com substituição posterior | `bee97c9cb1dea1da` |
| `supabase/migrations/20261108050000_equipe_compliance.sql` | Trechos 490-624 | `96be2cb4c2e5750f` |
| `src/lib/aki/motor.ts` | Trechos 44-115,190-255,379-405 | `37e132c2a45f86ae` |
| `supabase/migrations/20261107031000_robo_aki.sql` | Trechos 1-62,200-337,343-385 | `d0c747de5d6bf9d8` |

Também consultei o inventário rastreado em `src` e `supabase/migrations` e buscas de definições e usos de fechamento do Radar, relatórios, avisos, confirmação de WhatsApp, cotas, concessão de planos e custos do Aki. Essas buscas serviram para localizar a implementação cumulativa, sem tomar a documentação antiga como lista atual de defeitos.
