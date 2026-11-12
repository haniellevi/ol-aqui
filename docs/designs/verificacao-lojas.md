# Verificação automática de lojas — decisões do produto (12/11/2026)

Decidido com o Raniel em 4 rodadas de perguntas. Vale para o selo de loja verificada (`selo_loja_verificada`),
que hoje é dado só à mão pela equipe. Pessoa física entra no mesmo sistema logo depois (ver "Ordem de entrega").

**Objetivo:** a loja se verifica sozinha, sem esperar a equipe. A IA e regras fixas conferem os dados.
Qualquer dúvida ou problema chama a equipe humana, que decide junto com o parecer da IA.

## Pré-requisito
O PR do Radar v2 (`claude/radar-v2`) entra na main primeiro: este trabalho usa a cortesia do Radar
(`radar_cortesias`, `dar_cortesia_radar`) e o aviso "Verificar minha loja" que já estão lá.

## Quem pode se verificar
- Loja com **CNPJ**. Quem não tem CNPJ usa a verificação de pessoa física (`/minha-conta/verificacao`, já existe).
- Só com **celular confirmado** (`perfis.whatsapp_verificado_em`), como a pessoa física hoje.
- A pessoa que cadastra **não precisa ser sócia** da empresa.
- O botão **"Verificar minha loja"** (hoje leva para `/minha-conta/loja`) passa a levar para a página nova.

## Página da loja (nova)
- Uma pergunta por tela, Modo fácil (letra 18px, botões de 48px), sem ícone sem texto.
- Passos: 1) número do CNPJ; 2) comprovante de endereço; 3) foto da fachada (opcional, com "Pular");
  4) resumo + aviso de que uma IA confere os documentos + "Enviar para conferência".
- Arquivos: PDF, JPG ou PNG, até 2 MB cada (mesmo limite da pessoa física). Comprovante obrigatório.
- Limite: **3 envios por dia** por loja e **1 pedido pendente** por vez.
- Depois de enviar, a página mostra o estado: "Conferindo…", "Falta algo" (com o motivo e botão para reenviar),
  "Com a equipe" (prazo "até 1 dia útil"), "Verificada" ou "Recusada" (com o motivo em palavras simples).

## O que é conferido (tudo automático)
1. **Receita (BrasilAPI, consulta pública e gratuita):** situação do CNPJ, razão social, nome fantasia,
   endereço, município, sócios, data de abertura.
2. **Comprovante (IA lê a imagem):** nome do titular e endereço. Compara com a razão social e os sócios
   da Receita (nome pode ser da empresa **ou de um sócio**) e com o endereço/cidade do cadastro da loja.
3. **Fachada (IA lê a imagem, se enviada):** é uma fachada de verdade? O nome da loja aparece?
   A fachada nunca derruba o pedido sozinha: foto estranha só chama a equipe.

## Quem decide o quê
| Situação | O que acontece |
|---|---|
| Tudo bate | Selo na hora, sozinho |
| Foto ilegível / arquivo ruim | A IA pede novo envio, com o motivo |
| CNPJ baixado, suspenso ou inapto | Recusa com explicação |
| IA em dúvida | Equipe |
| Nome do comprovante diferente da empresa e dos sócios | Equipe |
| CNPJ já usado em outra loja do site | Equipe |
| Cidade da Receita fora da microrregião do site | Equipe |
| Receita fora do ar | 3 tentativas automáticas em 30 minutos; depois, equipe |
| 3ª recusa no mesmo dia | Equipe fala com a loja |
| Empresa com menos de 90 dias | **Não** chama a equipe (decidido) |

## Equipe
- Cada caso entra numa **fila no painel** (`/admin/lojas`, e como tarefa em `/admin/hoje`) com o parecer da IA:
  o que bateu e o que não bateu.
- **Aviso no WhatsApp** para quem tem o papel suporte (ou administrador) e WhatsApp confirmado,
  **só entre 8h e 20h**; o resto espera até as 8h.
- Meta de resposta: **24 horas**. Passou disso, o aviso volta e o caso fica vermelho no painel.
- A equipe aprova, pede correção ou recusa (mesmo fluxo de `admin_revisar_loja`, com o parecer da IA ao lado).

## Conferir a IA
- Nas **2 primeiras semanas**, a equipe revê **toda** aprovação da IA (o selo já vale).
- Depois, uma amostra de **1 em cada 10**.
- Se a equipe achar erro: tira o selo, chama a loja e anota o motivo (usado para ajustar as regras).

## Depois do selo
- **Todo mês** o sistema reconfere o CNPJ na Receita. Se ficar baixado, suspenso ou inapto:
  o selo sai, a loja e a equipe são avisadas, e a loja pode se verificar de novo.
- Mudar **CNPJ, endereço, cidade ou WhatsApp** refaz a verificação (derruba o selo até passar).
- Mudar **nome ou Instagram** mantém o selo e só põe um aviso na fila da equipe.
- Lojas que já têm o selo dado à mão continuam com ele.

## Privacidade (LGPD)
- O formulário avisa claramente que uma IA confere os documentos.
- O serviço de IA (OpenRouter) é configurado para **não guardar nem treinar** com os arquivos.
- Os arquivos são **apagados na decisão** (aprovada, recusada ou enviada à equipe e decidida), como na pessoa física.
  Fica só o **parecer** (o que bateu e o que não bateu), sem a imagem e sem nome nem endereço copiados do documento.
- **Exceção (ajuste do plano, 12/11):** uma aprovação da IA que cai na revisão da equipe (2 primeiras semanas ou
  amostra de 1 em 10) guarda os arquivos **até a equipe revisar, no máximo 7 dias**; depois são apagados de qualquer jeito.
  Sem isso a equipe não teria como conferir se a IA acertou.
- Os arquivos não vão para o Storage público: ficam no banco só enquanto o pedido está aberto.

## Avisos para a loja
- Estado na página, no sino do site e no **WhatsApp só nos momentos importantes**
  (selo concedido, falta algo, recusa). Sem tarifa por mensagem (usa o número do Evolution que já manda o código de confirmação), mas há risco de a conta ser banida; a chave do WhatsApp começa desligada.

## Ordem de entrega
1. Radar v2 vai primeiro (PR dele). Lojas que **já pagam** e estão sem selo ganham **30 dias de cortesia**
   do Radar automática, para se verificar.
2. Esta verificação é entregue; só então o Radar é aplicado na produção.
3. Antes de aplicar, contar quantas lojas pagas estão sem selo e mostrar o número ao Raniel.
4. Primeiro a loja; a pessoa física entra no mesmo sistema logo depois.

## Fora desta versão
- Selfie e documento de identidade do responsável da loja.
- Conferir Instagram, site ou Google Maps da loja.
- A IA pode errar com documento falso bem feito: por isso a revisão por amostra e a reconferência mensal.
