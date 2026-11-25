# Ativação de lojistas, Onda C

Base V27. Plano: `superpowers/plans/2026-11-25-item33-ativacao.md`.

## Caminhos e limites

Convites de dono e gerente mantêm a consulta autenticada e o destino codificado até completar o perfil. Antes da conta autorizada, mostram instrução genérica, volta ao início e ajuda. O nome e demais dados da loja continuam vindos da RPC existente, sem acesso público novo.

`/minha-conta/plano?cupom=EXEMPLO#cupom` apenas sugere código válido de 4 a 32 caracteres (letras, números e hífen). Parâmetros repetidos ou inválidos não preenchem o campo. Resgate exige envio explícito e segue integralmente a validação existente; Slim/Full pago vigente e pagamento pendente não são alterados. Benefício ativo dá prioridade à vitrine; uma intenção explícita por plano ou pagamento continua abrindo o caminho de compra atual, e o histórico conserva retomada.

Criação manual, criação com IA e recebimento concluído usam LojaPronta para anunciar, abrir vitrine e compartilhar manualmente. O checklist de Minha loja usa as rotas existentes e não certifica automaticamente que a loja está pronta. A foto da coleta IA passa por reduzirFoto com qualidade 0,9 e mantém o original quando o resultado seria maior; nome, MIME e tamanho acompanham o arquivo efetivamente enviado.

Localização de anúncio novo de lojista dono pode confirmar cidade/bairro da loja com endereço preenchido e cidade válida na região, sem redigitar. Não se copia endereço exato para o anúncio. Corrigir abre os campos existentes; PF, gerente, equipe, edição e anúncio com local já salvo mantêm seu caminho. A validação no servidor é a mesma.

## Pontos para posterior integração com A

Nenhuma coleta foi adicionada ou modificada. Antes de instrumentar, aplicar o contrato de finalidade, consentimento e deduplicação definido por A.

| Percurso | Início local | Sucesso autorizado/fato |
|---|---|---|
| Convite | renderização de receber-loja ou convite-loja | aceitarLoja e ação de gerente, após resposta autorizada da RPC |
| Loja manual | FormLoja | estado.feito de criarLoja |
| Loja IA | FormLojaIa | estado.feito de confirmar, exibido por LojaIaConcluida |
| Cupom | formulário Voucher | resgatarVoucher retorna ok, somente após RPC bem-sucedida |
| Primeiro anúncio | abrir anúncio/rascunho via caminho existente | publicarAnuncio, confirmação existente do servidor |
| Compartilhar | ação explícita de abrir compartilhamento ou copiar | cópia confirmada é cópia, abertura do WhatsApp não prova envio |

Nunca enviar token, código de cupom, slug individual, nome, endereço, WhatsApp ou outros dados da conta na coleta. A ocorrência de fatos persistidos deve continuar sendo fonte de negócio; recarregar telas de sucesso não significa uma segunda conversão.

## Verificação e validação futura

Testes node usam fronteiras simuladas e componentes reais. Provas HTML estáticas locais verificam apresentação, sem confirmar integração real de login, teclado virtual, TalkBack, upload remoto ou pagamento. Sem alteração SQL, a suíte de banco é dispensada nesta onda. O piloto em cinco lojas, Android físico e seis produtos reais por loja permanece validação futura, sem resultado alegado.
