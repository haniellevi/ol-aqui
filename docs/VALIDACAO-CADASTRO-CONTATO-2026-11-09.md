# Cadastro, pedido, proposta e contato

## Correções

- A conclusão de perfil agora usa `/completar-perfil`, fora do caminho `/entrar` controlado pelo Clerk. No teste anterior, o cadastro integrado voltava ao início; a tentativa de concluir perfil dentro de `/entrar/perfil` também perdia o destino em uma navegação interna. O endereço antigo continua atendido por compatibilidade.
- Login e cadastro passam pelo mesmo destino seguro, preservando texto e orçamento da busca. A conclusão de perfil sem sessão mantém esse destino ao solicitar login novamente.
- O pedido considera a cidade da busca, a escolha do visitante, o perfil e a sede da região. Não seleciona mais a primeira cidade em ordem alfabética. Cidade incompatível exige escolha explícita.
- Compartilhamento, metadados, vitrine e exportação de dados usam `NEXT_PUBLIC_SITE_URL`, com `https://ol-aqui.vercel.app` como padrão enquanto não há domínio próprio. Exemplos administrativos deixaram de indicar o domínio não registrado.
- Falhas na consulta de termos pendentes geram uma tentativa recuperável, sem simular que nada falta aceitar.
- A confirmação da proposta informa que ela já está disponível ao comprador. A mensagem anterior sugeria que as ofertas só seriam vistas no final do prazo, embora o comprador já pudesse escolher.
- O aviso de pedido recém-publicado desaparece quando ele é encerrado, mesmo que o endereço ainda contenha `novo=1`.

## Evidências de execução

Foram usadas duas contas fictícias do Clerk Development, com alias `+clerk_test` e código de teste documentado. Nenhum e-mail ou WhatsApp foi enviado a pessoas reais. As senhas não foram registradas neste documento ou no repositório.

1. Cadastro de comprador com confirmação de e-mail e criação do perfil no banco.
2. Busca por `Bicicleta TESTE E2E`, abertura do formulário, pedido com limite de R$ 1.500 e cidade Corrente.
3. Cadastro de vendedor, criação da `Loja TESTE E2E` e localização do pedido no Radar. O telefone do comprador não apareceu para a loja.
4. Upload autorizado de imagem gerada para o teste, envio de proposta de R$ 1.200 e exibição no pedido do comprador.
5. Clique do comprador em `Chamar no WhatsApp`, marcação `Você chamou` e abertura do WhatsApp com o telefone fictício da loja e o nome correto do pedido. O teste parou antes de enviar qualquer mensagem.
6. Reteste da autenticação na versão corrigida: passagem por `/completar-perfil` e retorno ao formulário com `Bicicleta`, orçamento de R$ 1.500 e Corrente preservados.

A opção `Agora não` foi usada nos avisos de termos; o aceite jurídico não foi realizado em nome do usuário. A validação de aceites no banco é independente deste teste de navegador. Google OAuth e SMS real não foram exercitados.

Pedido de teste: `9af0ae2b-d58b-43ad-a552-a28ff00f6ac9`.
Proposta de teste: `6bce5311-bafa-4c8c-a8e6-670e8ad9d83b`.
Vitrine de teste: `94fbd5dd-63bd-42a1-999f-4566d8d087a7`.

Ao concluir, o pedido foi cancelado pelo formulário e a vitrine foi suspensa, retirando os registros da área pública. As duas contas fictícias permanecem no Clerk de desenvolvimento, e os registros de teste ficam preservados para auditoria.

## Verificação reproduzível

- `npm test`: 25 casos de aplicação, incluindo os novos cenários de retorno, cidade, termos indisponíveis e domínio de compartilhamento.
- `npm run test:db`: PostgreSQL descartável; permissões, regiões, repetição de pedido, proposta, escolha, contato, encerramento e concorrência de cotas.
- `npm run typecheck`, `npm run lint` e build. O kit de demonstração mantém avisos preexistentes, sem erros.

## Clerk de produção

O site está publicado na Vercel, mas a autenticação ainda usa a instância de desenvolvimento do Clerk. O usuário confirmou que não possui domínio registrado e ainda está escolhendo a marca. A instância de produção exige domínio próprio com controle de DNS; `ol-aqui.vercel.app` não atende a essa condição.

O webhook da instância atual já está configurado para criação, alteração e exclusão de usuários, com segredo protegido na Vercel. Um evento assinado de teste respondeu 200; requisição sem assinatura foi rejeitada.

Quando houver domínio: conectar DNS e TLS, criar/configurar a instância de produção, configurar as credenciais dos provedores de acesso, trocar as chaves na Vercel e o emissor confiável no Supabase, conectar o webhook da nova instância e repetir os testes. Contas de desenvolvimento não migram automaticamente; o acesso administrativo deve ser reconciliado explicitamente com a nova conta antes de retirar a configuração anterior.

Referências: [produção Clerk](https://clerk.com/docs/guides/development/deployment/production), [redirecionamentos](https://clerk.com/docs/guides/development/customize-redirect-urls), [e-mails de teste](https://clerk.com/docs/guides/development/testing/test-emails-and-phones).
