# Minha conta: perfil, foto e WhatsApp

Base: `8124c1bc1d475c08474a57c984090250af2efe00`.

## Comportamento

Minha conta mantém os acessos anteriores e ganha um título visível e um atalho direto para editar perfil, foto e WhatsApp. A edição usa as cores, tipografia e componentes OL-AKI, com duas colunas no computador e sequência única no celular.

Nome, cidade e bairro usam formulário controlado: erros preservam o preenchimento, campos inválidos recebem foco e envios duplicados ficam bloqueados. O servidor valida sessão, identidade, limites, tipos e cidade da região; só retorna sucesso quando o banco devolve o identificador da própria conta. Uma falha ao carregar as cidades não vira campo livre que aceita qualquer localização. A localização de anúncios existentes continua sendo editada nos próprios anúncios.

A foto tem seleção, redução para até 512 px, prévia, salvar, cancelar e remoção com confirmação. O original deve ter até 20 MB. Erro de envio mantém a prévia; erro após o envio oferece uma nova sincronização sem exigir outro upload. A foto da conta continua no Clerk. A sincronização agora atualiza e remove o avatar independentemente de mudanças no telefone, sem sobrescrever nome e localização editados no site.

WhatsApp sem confirmação pode ser editado quando a configuração regional permite contato sem código. O número brasileiro é normalizado e validado, inclusive DDD 55. A ação consulta novamente o usuário autenticado no Clerk, respeita a configuração regional e condiciona a escrita à ausência de confirmação, inclusive em caso de concorrência. Não aceita identidade ou confirmação enviada pelo formulário.

O número confirmado é trocado no componente de conta do Clerk. A página orienta a definir o novo número como principal e inclui Concluir e voltar ao perfil, que sincroniza dados confiáveis antes do retorno. Não se escolhe silenciosamente um telefone secundário antigo quando o principal deixou de ser confirmado. O contato digitado sem código é preservado quando a conta não tem celular confirmado. O WhatsApp da loja permanece separado do contato pessoal.

## Evidência de testes

- `npm test`: 129 testes aprovados. Novos casos cobrem autenticação, identidade divergente, campos permitidos, validações, zero linhas alteradas, erros de rede/banco, configuração regional, confirmação concorrente e atualização/remoção da foto.
- `npm run test:db`: passou, incluindo a nova suíte 220. Verifica edição própria, bloqueio de outra conta e de sessão ausente, preservação de privilégios e impossibilidade de forjar confirmação. As suítes de anúncios, busca, Radar, notificações e concorrência continuam passando.
- TypeScript e ESLint aprovados. Permanecem os 10 avisos anteriores em componentes de demonstração.
- Chromium em 1440 × 1000, 390 × 844 e 320 × 740: editar e persistir perfil; validação e foco; erro e nova tentativa; WhatsApp inválido, DDD 55, erro e recuperação; foto com prévia, envio, remoção, cancelamento e persistência; arquivo acima de 20 MB e arquivo corrompido recusados; erro de sincronização com nova tentativa; falha das cidades; código obrigatório; conclusão e retorno ao contato confirmado. Sem estouro horizontal em 320 px.
- O resumo Minha conta refletiu nome e avatar salvos. A lista manteve Radar, Favoritos, Notificações, Meus dados, Privacidade, Ajuda e Sair. Os acessos condicionais de vendedor foram preservados no código.

Os testes de interface usaram páginas, componentes e ações reais com autenticação, Clerk e banco substituídos temporariamente por dados fictícios locais. O PostgreSQL foi testado separadamente em contêiner descartável sem rede. Os 16 arquivos substituídos foram restaurados e os quatro arquivos auxiliares removidos antes do build. Uma advertência de desenvolvimento causada pela troca da lista de dependências de um efeito durante hot reload não voltou após recarregar; não houve outro erro de aplicação na inspeção.

Não foram enviados SMS nem mensagens de WhatsApp, nem alterados perfis reais. A confirmação por código foi simulada na fronteira do Clerk; o envio real de SMS não foi validado neste ensaio. Os tamanhos móveis são emulação de viewport, sem ensaio em aparelho físico ou Safari.

## Publicação

Sem alteração de esquema ou configuração de produção. A configuração regional já permitia contato sem código e foi apenas consultada. O build de produção e a prévia da Vercel são conferidos antes do merge. Após o merge, verificar deployment READY, SHA e alias de produção, além da proteção das rotas privadas no navegador.
