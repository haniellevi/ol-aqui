# Minha loja: edição e validação

Escopo: logo, capa, nome, WhatsApp, cidade, bairro, endereço, horários, Instagram, apresentação, pagamento e entrega. Identidade Mercado da Região e recursos existentes de seções, fixados, destaque e planos preservados. Nenhuma migração de produção é necessária.

## Correções

- Salvamentos exigem sessão, loja própria e confirmação da linha alterada. Zero linhas, erro de banco ou falha de rede não geram sucesso nem exclusão da foto anterior.
- Leitura indisponível nas telas de edição mostra recuperação, sem sugerir que uma loja existente precisa ser criada novamente.
- Campos permanecem preenchidos após erros. O reset automático do formulário é cancelado para preservar também as caixas de meia-noite. Controles ficam bloqueados durante salvamento ou envio.
- Uploads validam formato e propriedade; logo e capa são reduzidas no aparelho, com limite de origem de 20 MB. Capa mantém recorte 3:1 e a foto guardada em plano menor. Imagens substituídas só são limpas após confirmação, com verificação de referências no banco.
- Horários preservam 24:00, têm identificação por dia para leitores de tela e cópia para dias úteis. Sobreposição e intervalos invertidos são recusados.
- O contato explica a alternativa de WhatsApp confirmado do perfil quando o campo fica vazio. Mudanças de identidade e contato invalidam também anúncios, busca e início.
- Capa e horários aparecem antes das opções comerciais; todas as opções anteriores continuam disponíveis.

## Evidências e limites

165 testes Node, TypeScript e build de produção passaram. A suíte PostgreSQL executou todas as migrações e testes em contêiner descartável sem rede, incluindo `250_minha_loja.sql`: alteração por dono, bloqueio de outra conta, pasta das imagens, privilégios protegidos, horários até meia-noite e atualização da vitrine pública. Lint sem erros, com os 10 avisos preexistentes em componentes de demonstração.

Interface exercitada pelo navegador em 320 x 740, 390 x 844 e 1440 x 1000. Sem transbordamento horizontal nas telas verificadas. Foi usado o código real das páginas, componentes e ações, substituindo apenas autenticação e serviços externos por fixtures locais. Upload real pelo seletor de arquivos, redimensionamento e recorte em canvas, persistência em servidor local e recarregamento foram exercitados.

Casos conferidos: validação do nome, falha de conexão e nova tentativa sem perder campos; adicionar e remover logo; capa por cor/modelo e foto; preservação ao reduzir e restaurar plano; copiar horários, salvar e reler meia-noite, rejeitar fechamento anterior à abertura; atualizar WhatsApp e cidade; salvar Instagram, pagamento e entrega; abrir a vitrine e conferir link de contato com o número atualizado. Nenhuma conversa foi enviada, nenhuma localização real foi coletada e nenhuma loja real foi alterada.

Capturas locais: `minha-loja-celular.png` e `minha-loja-desktop.png` na pasta de artefatos do chat. A loja e os números nessas capturas são fictícios.

A gravação autenticada contra Clerk e Storage de produção não foi exercitada, pois não havia sessão de lojista disponível. A publicação exige build final aprovado e conferência da implantação correspondente ao commit. Em produção, verificar o acesso público e o redirecionamento das páginas privadas para login.

## Roteiro reutilizável

1. Confirmar a loja da sessão e registrar valores existentes antes de editar.
2. Testar mudança válida, validação recusada, falha temporária e recarregamento em celular e computador.
3. Conferir a vitrine pública e o destino do contato sem enviar mensagens.
4. Executar testes Node, banco isolado, TypeScript, lint e build sem fixtures.
5. Publicar o commit validado e conferir SHA, estado READY e domínio de produção.
