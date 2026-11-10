# Anúncio e contato com vendedor, 09/11/2026

## Alterações

- Identidade Mercado da Região mantida: logo, cores, Poppins, cartões e botão verde de WhatsApp.
- Vendedor junto das informações principais em celular e desktop, caminho da categoria visível no celular e texto longo sem transbordamento.
- Galeria com setas também no celular, navegação por setas/Home/End, respeito a movimento reduzido, foto ampliada, bloqueio de rolagem do fundo e retorno do foco à foto selecionada. Foto indisponível recebe alternativa legível.
- Compartilhamento nativo quando disponível, cópia do link canônico e endereço selecionável quando o navegador não permite copiar. Cancelamento não registra compartilhamento.
- Descrição pode ser expandida e recolhida por botão com estado acessível.
- Contato ausente ou número inválido recebe mensagem clara; vendido e prévia privada continuam sem botão de WhatsApp. Links externos preservam `noopener noreferrer`.
- Falha de consulta principal vai para o tratamento de erro em vez de simular anúncio inexistente. Falha em recomendações não impede a página principal.
- Favorito recupera estado após falha, denúncias tratam indisponibilidade de rede e autenticação, e eventos secundários não interrompem a navegação.
- Conteúdo do anúncio separado da leitura de dados para permitir teste do mesmo componente usado em produção.

## Validação

- 63 testes Node aprovados: 18 novos cobrindo contato, status, privacidade, HTML/JSON-LD seguro, endereço inválido, falhas de leitura e autenticação, compartilhamento e recuperação.
- ESLint sem erros. Permanecem os 10 avisos anteriores em `src/components/demo/kit`.
- Build de produção local aprovado, incluindo verificação de tipos, com configuração original de layout e middleware. A rota de teste não aparece no build.
- Suíte PostgreSQL descartável aprovada. O teste `170_anuncio_contato.sql` verifica loja ativa, vendido, pausado, rascunho, prévia do dono, telefone de pessoa física sem confirmação, confirmação posterior e loja suspensa. Testes anteriores de busca, RLS e concorrência também passaram.
- Chromium integrado em 320 e 390 px e desktop 1280 x 900, com dados fictícios locais: navegação e ampliação de fotos, arquivo indisponível, Esc, foco, descrição, copiar link, falha no favorito, sem foto, sem contato, vendido e prévia do dono. Texto longo foi corrigido e conferido sem rolagem horizontal.
- Número, mensagem e URL de WhatsApp conferidos no link gerado. Nenhuma mensagem foi enviada e nenhum vendedor real foi contatado.

## Limites e isolamento

O catálogo público estava vazio. A conferência visual preenchida usou `tests/fixtures/anuncio.cjs` e o próprio `ConteudoAnuncio` numa rota local temporária. Layout/autenticação foram isolados apenas durante essa conferência; os arquivos originais foram restaurados, a rota removida e o servidor encerrado antes do build e commit. A configuração de autenticação publicada permanece a original. O protocolo de leitura e proteção dos contatos foi exercitado no PostgreSQL descartável, sem criar dados em produção.

Os testes de compartilhamento nativo e cancelamento usam a API do navegador simulada. A cópia do link foi exercitada no navegador. A simulação de viewport não substitui uma conferência posterior em aparelhos físicos.

## Repetição

Antes de publicar: `npm test`, `npm run lint`, `npm run typecheck`, `npm run test:db` e build. Conferir uma galeria com mais de uma foto, foto indisponível, ausência de contato, anúncio vendido, expansão/recolhimento, cópia do endereço e falha no favorito. Usar somente dados de teste isolados. Depois do deploy, confirmar SHA/alias, página inexistente e navegação pública.
