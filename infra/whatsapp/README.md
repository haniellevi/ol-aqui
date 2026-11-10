# WhatsApp de verificação do OL-AKI

Serviço exclusivo em `/srv/olaki/whatsapp`, projeto Compose `olaki-whatsapp`. Não reutiliza instâncias, volumes, redes, números ou chaves de outros sistemas. API em `127.0.0.1:8087`, Postgres e Redis sem portas publicadas. O HTTPS usa o hostname da VPS `srv2031318.hstgr.cloud`; somente `connectionState` e `sendText` da instância `olaki-verificacao` são publicados. Administração e QR exigem túnel SSH.

A imagem Evolution 2.3.7 e as imagens auxiliares estão fixadas por digest. A série 2.4 consultada estava em pré-lançamento e exige ativação de licença. Não usar `latest` nem atualizar junto com outros projetos.

## Instalação e configuração

1. Verificar memória, CPU, disco, portas, serviços existentes e identidade da VPS. Guardar IDs e datas de início dos contêineres antes da instalação.
2. Criar o diretório exclusivo e `.env` de permissão 600, com senhas aleatórias independentes. Usar `.env.example` como referência, nunca valores reais no Git.
3. Validar `docker compose --env-file .env config --quiet`, executar `up -d` somente neste projeto. Limites: API 768 MiB/0,5 CPU; Postgres 256 MiB/0,25 CPU; Redis 96 MiB/0,1 CPU.
4. Instalar o virtual host HTTP exclusivo, validar `nginx -t` e recarregar. Emitir certificado pelo webroot `/srv/olaki/acme`, sem modificar certificados de outros domínios.
5. Instalar `nginx.conf` e o hook `renovar-certificado.sh` em `/etc/letsencrypt/renewal-hooks/deploy/olaki-whatsapp`. Validar novamente antes de recarregar.
6. Criar uma instância `WHATSAPP-BAILEYS` com token próprio. Usar esse token na aplicação, nunca a chave administrativa. Desabilitar leitura de mensagens/status, histórico completo, rejeição automática de chamadas e webhooks.
7. Parear o número exclusivo com QR pelo túnel local. Uma sessão pode desconectar e exigir novo pareamento; o QR não é uma etapa garantidamente única.
8. Criar Turnstile gerenciado, sem pré-liberação e com domínios exatos. Colocar os sete valores de `.env.example` da raiz na Vercel. Chaves e segredo HMAC devem ficar como variáveis sensíveis.

A Evolution exige `Origin` autorizado inclusive para chamadas servidor a servidor; o adaptador usa a origem fixa configurada. Não imprimir chaves nem respostas de envio completas. A resposta contém o texto do código. O serviço não guarda histórico de mensagens/contatos/chats; cache Redis é volátil e tem TTL curto. Credenciais da sessão do WhatsApp permanecem privadas nos volumes e no banco.

## Publicação e validação

Aplicar primeiro `20261110012622_confirmacao_whatsapp.sql` (aditiva). Publicar a aplicação nova com variáveis configuradas e serviço pareado. Aplicar `20261110012623_whatsapp_obrigatorio.sql` no corte de produção. Confirmar entrega real e uso único pelo formulário com conta de teste autorizada. O formulário usa o usuário autenticado no Clerk; a posse do WhatsApp é confirmada separadamente.

Código de seis dígitos criptograficamente aleatório, HMAC por conta e desafio, cinco minutos, três erros e consumo transacional. Novo pedido invalida o anterior. Intervalo de 60 segundos por conta/destinatário, cinco solicitações por conta e destinatário em 24 horas, cem solicitações globais em 24 horas. Falhas também consomem cota. Reavaliar estes limites com volume real, sem desabilitar CAPTCHA. O painel antigo não pode liberar negociação com número sem confirmação.

Em timeout de envio não há repetição automática. O código pode ter chegado; a pessoa pode digitá-lo ou aguardar para solicitar outro. Falha explícita do provedor invalida o desafio. Uma troca pendente preserva o telefone confirmado atual. A sincronização do Clerk não sobrepõe confirmação da Evolution.

Os registros de desafio com mais de dois dias são eliminados no próximo pedido; os códigos vencem em cinco minutos mesmo sem limpeza. A exclusão/anonimização da conta remove os desafios. O número comercial de uma loja continua separado do celular confirmado do titular; esta entrega não certifica a posse de todos os contatos comerciais.

## Operação e recuperação

- Verificar estado `open`, recursos e rejeição de chave ausente. Um HTTP 200 de saúde não comprova entrega.
- Observar falhas sem registrar destinatário, código ou segredo nos logs da aplicação. Não compartilhar o QR ou arquivos de sessão.
- Antes de atualizar, fazer backup protegido do Postgres e do volume de instâncias. Manter o digest anterior. Restaurar exige compatibilidade das migrações da Evolution.
- Para parar somente este serviço: `docker compose -p olaki-whatsapp -f /srv/olaki/whatsapp/compose.yaml --env-file /srv/olaki/whatsapp/.env stop`. Não usar `down -v`.
- Não retornar ao aplicativo antigo após confirmar telefones externos: aquela sincronização do Clerk pode apagá-los. Em incidente, manter as verificações e informar indisponibilidade; nunca marcar números como confirmados sem código.
- O serviço não cobra tarifa por mensagem, mas consome VPS e manutenção. Automação de WhatsApp Web pode desconectar ou sofrer bloqueio. CAPTCHA e cotas reduzem abuso, sem eliminar esse risco.

Referências verificadas: [Evolution 2.3.7](https://github.com/evolution-foundation/evolution-api/releases/tag/2.3.7), [validação Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Para reconectar: abra túnel SSH local `127.0.0.1:3110` para `127.0.0.1:8087` da VPS e execute `python3 infra/whatsapp/parear.py /caminho/privado/aplicacao.json`. Abra `http://127.0.0.1:3111/`. O QR acompanha atualizações da sessão sem reconectá-la repetidamente. Pare o servidor local e o túnel após concluir.
