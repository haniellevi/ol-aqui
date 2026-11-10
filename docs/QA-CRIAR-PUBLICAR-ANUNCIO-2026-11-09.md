# Criação e publicação de anúncio

Base: `9c73f54c17c4f24e44cf66683e7c4ca761cff0a0`.
Escopo: início explícito, fotos, categoria, detalhes, preço, localização e revisão/publicação. Identidade visual Mercado da Região preservada.

## Correções

- Abrir ou pré-carregar `/anunciar` não insere registros. O botão cria um rascunho com identificador reutilizável em tentativas da mesma operação.
- Fotos só recebem confirmação depois do upload e da persistência da lista. Uma falha de persistência permite repetir usando o arquivo já enviado.
- Trocar capa ou remover foto só altera a tela após o salvamento. A comparação atômica da lista anterior impede sobrescrever mudanças de outra janela ou do Aki.
- Fotos com erro impedem avançar ou salvar e sair até repetir ou remover. Links e fechamento de página sinalizam envios pendentes. O texto não promete funcionamento offline.
- Limite de 20 MB antes da decodificação, redução para até 1600 px e prazo de 90 segundos para upload. Exclusão de arquivo consulta referências para preservar fotos ainda utilizadas; erro de consulta mantém o arquivo.
- Preço colado não é mascarado silenciosamente. `1500.50` e `1.500,50` são persistidos como 150050 centavos; valores inválidos recebem mensagem e foco no campo.
- Cidade vem da lista regional. Lista indisponível não libera texto arbitrário nem limpa silenciosamente a cidade já salva.
- Formulários mantêm dados em falha de rede, bloqueiam submissões concorrentes e possuem ação React para impedir envio nativo dos campos pela URL antes da hidratação.
- Falhas de leitura de rascunhos não são tratadas como lista vazia ou anúncio inexistente.

## Verificação

- `npm test`: 88 testes passaram, incluindo ações reais com fronteiras externas substituídas.
- `npm run test:db`: todas as verificações passaram em PostgreSQL 17 descartável, sem rede, portas ou volumes persistentes. Inclui criação/edição/publicação, RLS, repetição de publicação, contato público, comparação de listas de fotos e limite de plano sob concorrência.
- `npm run lint`: zero erros; 10 avisos anteriores nos componentes de demonstração.
- `npm run typecheck` e build de produção local concluídos.
- Navegador: 390 × 844, 320 × 740 e 1440 × 1000. Sem rolagem horizontal nos cenários verificados. Controles de fotos com pelo menos 48 px de altura e 57 px de largura na tela de 320 px.
- Fluxos exercitados: rascunho vazio, upload de um e de vários arquivos, falha após upload, nova tentativa, troca de capa, falha ao reordenar, remoção, salvar/sair/retomar, conflito entre duas abas, categoria pela busca e pelo grupo, detalhes obrigatórios, falha de salvamento preservando texto, preço decimal e a combinar, cidade vazia, cidade selecionada, revisão e publicação com falha seguida de sucesso.

Os testes visuais usaram as páginas, componentes e ações reais com autenticação e acesso ao banco/Storage substituídos temporariamente por fixtures locais. Foram utilizados apenas ícones públicos do projeto como fotos fictícias. Nenhum anúncio comercial foi criado em produção. As substituições, rotas de teste e arquivo auxiliar foram removidos antes do build e do commit; middleware, layouts de autenticação e cliente Supabase foram restaurados.

A validação em navegador cobre dimensões de celular em Chromium; não substitui um ensaio em aparelho físico nem testa captura por uma câmera real. A publicação real no banco foi validada pelo SQL isolado; o teste local de interface não é evidência de envio ao Storage remoto.

Capturas de fotos, revisão e sucesso local foram guardadas na pasta de visualizações desta conversa. A disponibilidade da prévia e da produção é confirmada separadamente na Vercel antes da entrega.
