# Piloto de cadastro de loja com IA

O lojista reúne o material que já tem, recebe um rascunho para editar e cria a vitrine quando estiver satisfeito com os dados. O piloto atende uma loja convidada, escolhida pelo responsável na hora do teste. O cadastro manual continua disponível. A fila de destaque pago e a categoria compartilhada seguem como entregas próprias.

## Abordagem proposta

Processar as fontes em segundo plano permite sair da página, retomar a revisão e aproveitar os resultados das fontes que funcionaram. O assistente síncrono atual sugere categoria e descrição a partir de um texto, o que mantém a interação simples, mas não atende à coleta de materiais, ao processamento em segundo plano e ao aviso de conclusão. O fluxo escolhido reaproveita o formulário e as validações do cadastro atual na revisão e na publicação.

## Cadastro e revisão

1. Mostrar **Criar com IA** e **Preencher manualmente** no início do cadastro de loja.
2. Pedir nome e cidade. Em seguida, pedir links do site, Instagram e Facebook e oferecer **Agora não**.
3. Receber, de forma opcional, fotos, logo, CNPJ e descrição. Se o lojista não informar links, arquivos ou outra fonte utilizável, pedir uma descrição curta. Oferecer a consulta do perfil comercial do WhatsApp Business mediante autorização específica e para número confirmado.
4. Começar o processamento apenas ao tocar em **Gerar rascunho**. Após o envio, mostrar que o lojista pode sair e acompanhar em **Minhas lojas**. Oferecer **Me avise quando ficar pronto** para o número confirmado.
5. Abrir o rascunho no cadastro existente. Mostrar a origem por campo e avisar quais fontes não responderam. O lojista pode editar tudo, remover imagens e retentar uma fonte que falhou. Uma retentativa preenche campos vazios e oferece novas sugestões para os demais, preservando as edições já feitas.
6. Confirmar com um único **Criar minha loja**. O lojista confere nome, cidade, WhatsApp, endereço quando informado e os demais dados que serão publicados. A criação da vitrine e o início do teste grátis seguem as regras aplicáveis ao cadastro existente.

## Fontes e dados

- **Site, Instagram e Facebook.** Links ou nomes de perfis informados pelo lojista identificam as fontes. Usar somente informações acessíveis em condições autorizadas. Se um serviço exigir acesso que o piloto não tem, mostrar que aquela fonte ficou indisponível e oferecer o envio manual.
- **WhatsApp Business.** Testar a leitura de dados comerciais que a Evolution consegue retornar para o número confirmado que o lojista autorizar. Usar acesso restrito no servidor, aproveitar apenas os campos comerciais necessários e manter as conversas fora da coleta. Se o número comercial for diferente, o lojista pode preenchê-lo e seguir o fluxo de verificação atual. O piloto usa a infraestrutura de avisos existente e dispensa a implantação da API oficial da Meta no Mercado.
- **CNPJ.** Campo opcional. Se houver provedor autorizado, usar o CNPJ para localizar dados da empresa e mostrar a origem. Sem consulta disponível, manter o dado como informado. O CNPJ recebido no piloto serve à consulta e à conferência.
- **Google Maps.** Mostrar um link para o lojista conferir o estabelecimento e as avaliações no Google. O endereço da vitrine vem do lojista ou de uma fonte autorizada.
- **Imagens.** Usar arquivos do lojista ou imagens que ele autorizar a reutilizar. Oferecer capa gerada pelo Merc, identificada como tal. As imagens ficam privadas no rascunho e só as selecionadas para publicação se tornam públicas. Logo e capa podem ser removidos na revisão.

## Processamento e limites

Manter um rascunho ativo por conta, acessível apenas pelo dono autenticado. Distinguir coleta, processamento, pronto para revisar e publicado. Guardar o progresso por fonte para retomar falhas sem refazer o que já funcionou. Quando não houver dados suficientes para sugerir um campo, deixá-lo em branco. Tratar texto obtido de páginas e perfis como dados da fonte. A IA só sugere conteúdo e a validação do servidor continua responsável pelos campos, pela titularidade da loja e pelas permissões.

Reaproveitar o envio e a validação atuais da vitrine, as cotas de IA e os componentes de imagens quando couberem no fluxo privado. Para a leitura de fontes externas, restringir os destinos a HTTPS público e validar também redirecionamentos. Limitar tempo de processamento e tamanho dos materiais. O mesmo rascunho deve gerar no máximo um aviso de conclusão e a mesma confirmação deve criar no máximo uma vitrine. A criação atual grava os dados básicos. A confirmação do piloto precisa tornar públicos, em conjunto, a vitrine e os campos e imagens aprovados. Se o preparo de uma imagem falhar, o rascunho fica disponível para corrigir ou remover o arquivo antes de tentar de novo. Uma retentativa após a publicação retorna à mesma vitrine e ao mesmo teste grátis. O status do aviso não interfere na revisão.

A decisão proposta para o piloto é reaproveitar a fila existente de WhatsApp e sua janela de envio. Se não for possível mandar a mensagem, o rascunho continua em **Minhas lojas**. A seleção da conta convidada fica sob controle da equipe. As demais contas usam o cadastro manual. O Facebook entra como fonte na primeira versão. O site e o Instagram reaproveitam os campos que já existem na vitrine. O plano de implementação deve prever o descarte de arquivos privados rejeitados ou que perderam a função após a publicação, preservando os arquivos do rascunho ativo.

## Critérios do piloto

- Uma loja escolhida pelo responsável percorre da coleta até a revisão e publicação. O formulário manual também abre.
- A loja pode pular redes sociais, fechar a tela durante o processamento, voltar pelo atalho e abrir o rascunho. Uma fonte indisponível deixa um resultado parcial que pode ser corrigido.
- Antes da confirmação, nenhuma vitrine fica pública e nenhum teste grátis começa. Após confirmar, a vitrine contém os dados e imagens que o lojista escolheu.
- O aviso sai para o WhatsApp confirmado quando solicitado. Se o número ou o canal não estiver disponível, a revisão segue pelo site. A consulta de perfil depende das fontes que a loja escolhida autorizar. O relatório do piloto registra cada fonte exercitada, inclusive se houve consulta real além do texto e dos arquivos enviados. Fontes indisponíveis ficam como pendências específicas de validação.
- Outra conta não consegue ler ou publicar o rascunho. Retentativas e envios simultâneos preservam as edições já feitas e a unicidade da vitrine e do aviso.
