# Ativação lojistas Implementation Plan

> Execução nativa pelo worker, sem delegação, conforme despacho e desenho integrado aprovado.

**Goal:** entrada até primeiro anúncio compreensível, sem etapa redundante nem alteração de direitos.
**Architecture:** reutilizar consultas autenticadas, componentes oficiais e ações atuais. Nenhum SQL, endpoint ou rastreio novo.
**Tech Stack:** Next/React existentes, testes node com fronteiras simuladas.
**Spec:** /home/raniel-linux/.orca/bots/bot-mercado-regiao/scratch/item30-plano-integrado.md (Onda C).

## Restrições
Sem rede remota, cobrança, convite ou resgate real; preservar Slim/Full e pagamento pendente; respeitar DESIGN.md; não editar vitrine pública da onda B nem coleta da A.

## Revisão
Convites inválidos e sem acesso não revelam dados; cupom repetido/inválido não preenche; benefício não elimina pagamento pendente; PF/gerente conservam localização normal; falha de upload permite retentar.

### 1. Entrada e cupom
Arquivos: receber-loja/page, convite-loja/page, plano/page e voucher; testes/ativacao-lojista.test.cjs.
- [x] Escrever e observar falhas dos testes de saída, preservação de destino, código validado e CTA sem loja.
- [x] Implementar orientação genérica pré-login, saídas e formulário pré-preenchido por código normalizado sem resgate automático.
- [x] Testar promoção ativa, Slim vigente/vencido e pagamento pendente preservando ações existentes; commit.

### 2. Loja pronta e imagem
Arquivos: novo componentes/anunciar/loja-pronta, form-loja, revisao-loja-ia, form-loja-ia, Minha loja.
- [x] Testes falhando para próximos passos compartilhados e envio reduzido.
- [x] Reusar CopiarLinkLoja, links de vitrine e compartilhar manual, fechamento comum e checklist em Minha loja; reduzirFoto antes do envio com metadados corretos.
- [x] Testar retorno, sucesso, falha de envio e ausência de efeitos externos; commit.

### 3. Local e provas
Arquivos: anunciar/local/page, form-local, envio-fotos; testes/ativacao-lojista.test.cjs.
- [x] Testes falhando: lojista com endereço/cidade válidos confirma local, PF e gerente mantêm formulário.
- [x] Pré-preencher cidade/bairro da loja e confirmar sem redigitar, opção corrigir, prévia 4:3.
- [x] Rodar suíte sintética, lint, tipos, conferidor e capturas 320/360/390 de fixtures locais.
- [x] Revisar diff, documentar gatilhos de início/sucesso para A e limitações; commit e relatório externo com SHA limpo.

## Registro de execução

Executado pelo próprio worker, conforme despacho. Testes vermelhos observados antes dos novos componentes e funções, seguidos de implementação e testes verdes; um mock de envio foi atualizado para verificar redução e metadados. A suíte encontrou um caso nulo de localização que foi corrigido e revalidado. Nenhum SQL ou serviço remoto alterado. Provas e limites no relatório externo Item 33; integração de eventos documentada em docs/ativacao-lojistas.md.
