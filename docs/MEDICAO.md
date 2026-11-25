# Medição interna, contrato v1

Base V27, Onda A. Nenhum destino externo é carregado ou ativado. `DESTINOS` em `src/lib/metricas/contrato.ts` fixa GA4 e Meta em falso. Item 36 acrescenta configuração tipada por ambiente e adaptadores de ensaio com transporte injetado, sem SDK/rede e sem ligação aos coletores. A superfície externa é mais restrita que a interna; veja [integração futura e gates](INTEGRACOES-MEDICAO.md). Não basta trocar essa constante para ativar.

## Preferência e gates

`mr_privacidade_v1` guarda somente `{v:1,estatistica:boolean,marketing:boolean}` por 180 dias. Ausência, formato inválido ou versão desconhecida negam. Cookie SameSite=Lax, Secure em HTTPS; cópia local permite sinal de mudança entre abas. Não há registro individual de aceitação no banco. Aceitar e recusar têm mesmo destaque; Personalizar oferece finalidades separadas. A preferência pode ser revista no controle público e em `/privacidade`. Fechar a interface não aceita nada. Cookies bloqueados mantêm coleta negada; armazenamento de IDs indisponível impede pageviews.

Estatística controla a coleta interna opcional. Marketing não dispara nada nesta onda. Não muda termos de conta, consentimentos do Radar ou WhatsApp. Retirada limpa identificadores próprios, sessão, atribuição antiga e vistos, cancela fetch de visita e não guarda fila/retries. Outras abas releem o cookie ao sinal de storage. Requisições já recebidas pelo servidor podem terminar; não há retroenvio de navegações anteriores ao aceite nem recuperação de eventos perdidos. Se o navegador bloqueia sincronização de storage, gates ainda leem o cookie a cada envio e no servidor.

Gates comuns: `podeMedir()` no cliente e `permiteEstatistica()` no servidor. Servidor exige preferência estatística e Referer do mesmo host em rota pública permitida; sem Referer, nega conservadoramente. Nenhum IP ou user-agent é persistido na nova telemetria; user-agent serve apenas para rejeitar bots. IDs de conta só são usados para excluir a visita do próprio dono nas RPCs legadas; foram removidos do hash de medição. Não há vínculo com perfil de marketing ou fingerprint.

## Contrato para D/E

| Nome lógico | Gatilho e fonte atual | Propriedades permitidas e denominador |
| --- | --- | --- |
| `page_view` | Página pública visível, cliente global + `registrar_visita_consentida` | Rota neutra, navegador UUID, sessão UUID, ocorrência UUID, origem de catálogo, primeira, dispositivo de toque. Coorte `consentida_v1`; denominador páginas aceitas. |
| `search_completed` | Consulta textual principal da primeira página concluída sem erro e Referer público do mesmo host; gate capturado antes de `after` | Região e categoria existentes, faixa `zero`, `1-10`, `11+`. Contagem de consultas consentidas, sem texto, sem ID. Taxa zero = faixa zero / faixas observadas nessa população e no mesmo recorte. Filtros/categorias sem texto, chegada externa e entrada direta sem Referer ficam fora. |
| `view_item_list` | Lista visível em `MedirAparicoes`, função existente | IDs públicos de anúncios e posições limitadas, superfície enum. Agregado diário existente. Não equivale a viewport de cada card. |
| `view_item` | Anúncio montado, `registrarEvento(..., visualizacao)` | ID público de anúncio, tipo enum; navegador consentido. Janela de repetição legada continua, não equivale ao total de pageviews. |
| `view_store` | Vitrine montada, ação `registrarEventoLoja(..., visita)` existente | ID público de loja, tipo enum; navegador consentido, janela legada. |
| `contact_intent` | Clique de WhatsApp/mapa após ação real | Mesmo contrato legado e gates. Indica intenção, não conversa, venda ou pagamento. |
| `share` | Compartilhamento/cópia concluído pelo fluxo existente | Tipo `compartilhar`; falha ou cancelamento não é sucesso. |

IDs públicos de produto/loja ficam apenas nas métricas internas existentes. `eventoPermitido()` oferece envelope mínimo, estrito, sem IDs para futuros destinos: nome enum, rota neutra, faixa opcional, fonte `interno`, coorte `consentida_v1`. Campos extras são rejeitados. Não envia eventos; não existe dataLayer. Não transformar envelope externo futuro em espelho das RPCs internas.

Rotas permitidas: `/`, `/busca`, `/lojas`, `/categorias`, anúncio, loja e categoria com segmento único convertido a marcador. Query, hash, título e referrer bruto nunca são payload. Desconhecidas, conta, login, convite, cupom, conversa, Radar, admin e API negam. Regiões/categorias da procura são validadas no banco. Categoria não reconhecida fica sem categoria; região desconhecida não grava. Isso não representa busca zero.

Origem aceita `origem` antes de `utm_source`, preservando o gerador legado; códigos já semeados no painel formam allowlist fechada e precisam estar ativos no banco. Sem origem válida, direto. A origem é fixada ao criar o fluxo de pageviews; outro link/UTM não reatribui o fluxo vigente. O banco revalida se o código permanece ativo em cada gravação. `campanha`/`utm_campaign`, `utm_content`, `utm_medium` e `utm_term` livres não são persistidos nesta onda: falta catálogo aprovado. Não inferir origem por Referer nem recuperar atribuição perdida. Novas origens personalizadas precisarão de revisão da allowlist.

## Séries e retenção

`visitas.coorte=legado` preserva os registros anteriores; nova coleta usa `consentida_v1`, sessão e ocorrência. Índice único de ocorrência impede retry duplicado. Re-render não conta; A → B → A conta três; query de filtro não é pageview; recarregar cria nova ocorrência. Sessão observada é um fluxo de despachos de pageview no sessionStorage, renovado no próximo despacho após 30 minutos ou mais sem pageview. Leitura, cliques e visibilidade na mesma página não renovam o relógio; não há evento automático ao expirar. Reload/revisita reaproveitam o fluxo antes do limite e criam outro após ele. Um opener pode copiar o sessionStorage: abas então podem iniciar com o mesmo UUID e depois evoluir independentemente. Não há isolamento garantido nem contagem de pessoas ou de abas. O resumo conta fluxos distintos observados no período, inclusive os iniciados antes dele. Falha de fetch não renova tentativa nem gera fila; o relógio local representa despacho, não confirmação do servidor. Navegador é UUID local, não pessoa: apagar storage/retirar consentimento/reaceitar cria nova identidade. Não somar com usuários externos.

`admin_medicao_resumo` separa pageviews, navegadores, sessões e `sem_dados`. Esse estado indica ausência de observações, não prova falta de visitantes ou causa específica. `admin_visitas` mantém formato legado e período, filtra a coorte antiga e oculta páginas/campanhas livres. Rótulos antigos passam a Navegadores e legado. A nova visão de Admin pertence à Onda D.

Eventos e agregados diários de produto/loja continuam nos mesmos recursos. `metricas_marcos` registra a data efetiva da mudança. O marco inicio registra a aplicação SQL, não a implantação da aplicação. aplicacao_inicio/aplicacao_fim ficam nulos até confirmação operacional autorizada; não são inferidos do primeiro evento. O dia do corte e a janela real de rollout podem ser mistos; não comparar esse dia como coorte homogênea nem concatenar séries antes/depois sem quebra explícita. Favoritos, anúncios publicados, lojas, resgates e pagamentos continuam fatos do banco, sem eventos espelhados.

`buscas_faixas_dia` inicia série independente. Coleta antiga de termos do site/Lia é encerrada. Histórico não é apagado; acesso direto autenticado a termos/visitas é retirado, e RPCs de relatórios mantêm o formato com termos vazios ou categorias. Meu Marketing conserva sugestões e contagens antigas, usando nome da categoria em lugar de termo pessoal. Não atribuir a essa série nova a demanda histórica por palavras.

### Retenção aprovada: 180 dias civis

A migração aditiva 35400 define `medicao_limpar_opcionais()` sem parâmetro de relógio. Uma execução diária às 06:15 UTC (03:15 em Fortaleza), pelo job SQL interno único `olaki-medicao-retencao`, remove métricas cujo dia é **anterior a hoje menos 180 dias**, sempre em America/Fortaleza. Idades de 179 e 180 dias permanecem; 181 é elegível. A remoção ocorre na próxima execução bem-sucedida, não no aniversário exato em horas. Falhas ou agendamento ausente atrasam a remoção e devem ser monitorados pelo operador. A instalação não dispara a rotina; não há HTTP, chamada a fornecedor nem dependência de nova visita.

| Fonte/colunas | Limpeza e delimitação |
| --- | --- |
| `visitas` (`criado_em`, `coorte`, navegador/sessão/ocorrência e demais campos da linha) | Apaga somente `coorte='consentida_v1'` anterior à meia-noite do corte. `legado` permanece, mesmo com sessão preenchida. |
| `buscas_faixas_dia` (`dia`, `vezes`, região/categoria/faixa) | Apaga dias elegíveis da coorte explícita `consentida_v1`, inclusive quando rollout ainda está nulo. |
| `eventos_anuncio` (`criado_em`, `tipo`, `visitante_hash`) | Apaga visualização, clique WhatsApp e compartilhar apenas nos dias completos seguros; `favoritar` permanece como fato. |
| `eventos_loja` (`criado_em`, `visitante_hash`, tipo visita/WhatsApp/mapa) | Apaga somente eventos dos dias completos seguros. |
| `anuncios_aparicoes_dia` (`dia`, aparições e soma de posição por página) | Apaga linhas dos dias completos seguros. |
| `anuncios_numeros_dia` | Zera somente aparições, soma de posição, visualizações, cliques e compartilhamentos dos dias completos seguros. Preserva a linha e a coluna `favoritos`. Não apaga a linha mista. |

Dia completo seguro começa no dia seguinte ao maior dia entre `metricas_marcos.inicio` e `aplicacao_fim`, com início/fim finitos, ordenados e fim não futuro. Enquanto a implantação estiver sem confirmação, eventos e agregados sem coorte permanecem. Os dias do SQL, da implantação e anteriores ficam preservados: não se consegue separar com segurança população antiga e nova nessas células. Isso é uma exceção real de histórico/transição. Não somar essas populações como série homogênea. O Admin bloqueia comparação de tráfego quando a janela anterior ultrapassa o limite de dados retidos, mesmo se ainda restar alguma observação.

Não há nova retenção mais curta efetiva nessas fontes no código inventariado. A limpeza legada de visitas usa `visitas.guardar_dias` (padrão 400) de forma probabilística dentro da RPC antiga; a nova rotina não altera seu valor, não amplia esse prazo nem chama a RPC antiga. Exclusões em cascata preexistentes de anúncios/lojas continuam podendo reduzir o histórico antes dos 180 dias.

Ficam fora da rotina: termos e séries anteriores (`anuncios_termos_dia`, `buscas_termos`, `robo_buscas_vazias`), acumulados vitalícios mistos em `anuncios.visualizacoes`/`cliques_whatsapp`, favoritos/fatos de conta, venda declarada, pagamentos, vouchers, pedidos/propostas, logs, documentos/aceites e provas/snapshots de compliance. Acumulados sem dia e históricos mistos não permitem subtrair só a parcela nova; ficam classificados como histórico misto, sem criar espelho nem recalcular fatos. A rotina não reabre, publica ou restaura dados. Não altera termos já aceitos nem liga GA4/Meta.

O proprietário aprovou a correção da política pelo fluxo administrativo atual com novo aceite. Publicar nova versão com texto e resumo revisados, preservando versões e aceites anteriores, sem atribuir aceite de estatística pelo aceite do documento. A preferência mínima continua `{v:1,estatistica,marketing}` por 180 dias, independente da retenção das métricas. Não afirmar conformidade jurídica.

## Integração B/C

B mantém `registrarEventoLoja` e `MedirAparicoes`, já gated; não adicionar tag, fetch ou identificação próprios. Montar visita apenas depois da vitrine existir, excluir preview/loja própria pela RPC e chamar intenção apenas no clique. Esta frente alterou somente a ação compartilhada da vitrine, sem layout/componentes de B.

C mantém conta, convite, resgate, recebimento da loja e publicação em suas operações existentes. Somente resposta confirmada de persistência prova sucesso; cliques e tentativas falhas ficam fora. Convites abertos e demais rotas sensíveis não devem chamar telemetria comportamental. D pode consultar fatos por coorte autorizada: criação/recebimento em vitrines, publicação em anúncios, resgate em atribuições de voucher e confirmação em pagamentos. Não enviar código de convite/cupom, usuário, contato ou operação ao envelope externo. Nenhuma alteração de tela/fluxo de C foi feita.

## Verificação local

`npm test`, lint, typecheck e conferidor; `npm run test:db` faz ensaio de atualização: suíte legada completa antes da migração que encerra o contrato antigo, nova migração sobre esse banco, teste 910 e busca legítima novamente. `python3 supabase/testes/automatizados.py --item31` aplica todas as migrações primeiro e verifica o contrato novo. Ambos usam PostgreSQL descartável com `--network none` e tmpfs, sem credenciais remotas.

Fixture visual local usa componente real renderizado estaticamente e CSS real, 360×680. Ela não comprova hidratação Next/Clerk, duas abas reais, Android, TalkBack ou carregamento integrado da vitrine; esses limites precisam aparecer no relatório de entrega. O coletor real também é executado em harness de hooks com payloads sintéticos e fetch substituído.

## Correções da revisão Item 34

A candidata local ainda não publicada corrige 35000/35200; nenhuma migração V27 foi alterada e nenhum agregado histórico foi reclassificado. Novas buscas gravam dia civil explicitamente em America/Fortaleza, inclusive default da tabela, e admin_medicao_resumo aplica os limites nesse fuso mesmo quando chamado diretamente em sessão UTC.

prepararIdentidadeMedicao prepara sincronicamente UUID/cookie consentido antes da ação de montagem de anúncio/loja e é reutilizada pelo coletor global. Sem preferência aceita ou rota permitida, não cria identidade. Bloqueio de storage/cookie impede despacho dependente; retirada limpa os identificadores e o servidor reavalia o gate. Uma tentativa de montagem não ganha retry automático em falha. Aceitar depois da montagem não recupera aquela visualização; somente pageview global posterior ao aceite e novas ações explícitas são elegíveis. Requisições já aceitas no servidor podem terminar durante a retirada.

As séries diárias de Produtos, Meu Marketing e contatos podem somar regimes diferentes e perder linhas por cascata ao excluir anúncio. Representam agregados sobreviventes, sem histórico exaustivo. Tráfego só recebe comparação após janela de implantação confirmada, duas janelas encerradas posteriores ao maior dia entre marco SQL e término do rollout, com a mesma marca. Nenhuma comparação corrige cobertura de consentimento/Referer por inferência.

Referência de plataforma: [sessionStorage e cópia pelo opener](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage). O teste de cópia de armazenamento explicita a limitação; não promete isolamento universal entre navegadores.

### Implantação e reversão posteriores

35000 e 35200 foram ajustadas nesta candidata ainda não publicada; usar os hashes registrados no relatório de correções, sem reaplicar cegamente sobre banco que já recebeu uma versão local anterior. Bancos descartáveis são reconstruídos. Se alguma versão tiver sido aplicada fora do ensaio, exigir reconciliação autorizada e migração aditiva; nunca reescrever o histórico de uma migração publicada.

Antes de implantação autorizada: registrar separadamente horário da migração, início/fim reais do rollout da aplicação, versão da aplicação e eventuais pausas. Os campos aplicacao_inicio/aplicacao_fim não recebem defaults, não vêm do primeiro evento e só devem ser preenchidos pelo operador a partir da evidência real. Preservar a janela de transição em relatórios; não mover agregados existentes para outro dia por suposição. Produção e esse preenchimento não foram executados.

Rollback conservador: usar versão compatível que negue coleta opcional no gate comum, preservar schema/coortes/índices/histórico e corrigir por migração aditiva autorizada. Não reativar coleta antiga sem consentimento, termos livres ou acesso histórico removido. O pacote operacional do Item 38 inclui snapshot cifrado e ensaio local de reversão conservadora, sem executar produção. Manter a retenção agendada se compatível; se precisar suspender o job por falha, bloquear coleta opcional e registrar a suspensão. Não restaurar métricas corretamente expiradas.
