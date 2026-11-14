# Piloto de cadastro de loja com IA

A configuração começa sem convite. Guarde o convite para a conta que o responsável escolher na hora do teste. As demais contas usam o cadastro manual.

## Preparar o ambiente de teste

1. Aplicar as migrações da branch do piloto no banco do ambiente. Conferir as políticas do bucket privado `loja-ia` e usar as credenciais do Clerk e do Supabase desse mesmo ambiente.
2. No Vault desse banco, configurar `olaki_loja_ia_endpoint` com o URL HTTPS completo da rota `/api/interno/loja-ia` da aplicação correspondente. O agendamento `olaki-loja-ia` usa `olaki_moderacao_ia_token`, que precisa corresponder a `MODERACAO_IA_SECRET` no servidor. Sem esse URL, o agendamento não faz chamadas. Verificar a execução no pg_cron e a resposta HTTP sem registrar segredos.
3. Confirmar o modelo de texto do Merc e a cota no ambiente de teste. Consultas de CNPJ começam desligadas e dependem de autorização para usar o provedor já configurado. Perfil comercial da Evolution é opcional, somente com autorização e número confirmado. As opções de configuração ficam no [runbook do WhatsApp](../../infra/whatsapp/README.md).
4. Abrir o piloto pela tabela `loja_ia_convites`, com o ID da conta escolhida. Para interromper novas coletas e consultas, retirar o convite. A vitrine criada permanece acessível.
5. Verificar fila e HTTP se o rascunho não evoluir. O retorno da rota interna informa contagens de conclusões e erros. Verificar separadamente a fila de saída do WhatsApp e, se houver erro persistente de imagens, o estado de descarte e a fila `loja_ia_imagens_lixeira`.

## Teste com a conta escolhida

1. Confirmar o acesso a **Criar com IA** e **Preencher manualmente**. Em outra conta, verificar que o rascunho e a imagem privada ficam inacessíveis.
2. Iniciar a coleta, escolher o material da loja e marcar o aviso se desejar. Após **Gerar rascunho**, sair e retornar por **Minhas lojas**. Confirmar se houve entrega da mensagem no aparelho. Registrar fonte e status de cada consulta.
3. Revisar a origem dos campos e tentar novamente uma fonte indisponível. Verificar que as edições permanecem e que a foto selecionada está acessível somente pelo dono antes da publicação. O modelo de capa do Merc é criado localmente. Fotos próprias como capa seguem a disponibilidade do plano. O link do Maps abre a consulta no Google.
4. Confirmar **Criar minha loja** uma vez e conferir o resultado. Sites e perfis publicados respeitam a política atual de exibição de contatos na vitrine. Registrar o que funcionou e as pendências de cada provedor.

## Limites da validação local

Os testes SQL usam Postgres isolado. A verificação no Chromium usou os componentes reais com ações simuladas em desktop e celular, incluindo upload para um servidor local, retomada após pular as redes, revisão parcial, retentativa, preservação de edições e confirmação. Credenciais, execução do agendamento no ambiente publicado, Storage hospedado e entrega de WhatsApp ficam para o teste do ambiente com a loja escolhida.
