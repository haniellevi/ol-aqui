# Mercado da Região · Guia de usabilidade · 07/11/2026

Para quem estamos desenhando: gente de **Corrente e região**, de 16 a 70 anos, quase sempre no **celular Android de entrada**, muitas vezes com **internet fraca ou pacote de dados acabando**, que usa **WhatsApp o dia todo** e pouco mais que isso. Muitos leem devagar, alguns quase não leem, muitos mandam **áudio** em vez de escrever. Comerciantes ocupados, com uma mão no balcão.

Se uma tela funciona para a **dona Maria, 62 anos, vendendo uma geladeira com o celular do neto**, funciona para todo mundo.

---

## As 12 regras

**1. Celular primeiro, uma mão só.**
Desenhar primeiro para tela de 360px de largura. Botões importantes na metade de baixo da tela, onde o polegar alcança. Barra de navegação embaixo, não menu escondido no "três risquinhos".

**2. Um objetivo por tela, um botão principal.**
Cada tela responde uma pergunta só ("qual o preço?"). O botão laranja diz o que acontece: "Publicar anúncio", não "OK" nem "Enviar".

**3. Escrever o mínimo.**
Botões grandes no lugar de digitar (ano, estado, câmbio, cidade). Teclado de número para preço e celular. Cidade e bairro já preenchidos. O código do celular se preenche sozinho. Foto e voz antes de texto.

**4. Palavras do dia a dia.**
| Use | Não use |
|---|---|
| Entrar | Login, autenticar |
| Anunciar, vender | Cadastrar item, criar listing |
| Chamar no WhatsApp | Contatar anunciante |
| Pedir no Radar | Criar demanda |
| Destacar | Impulsionar, boost |
| Meus anúncios | Gerenciar publicações |
| "Algo deu errado. Tente de novo." | "Erro 500" |
Frases curtas, sem gerúndio enrolado, sem inglês. Números como as pessoas falam: "R$ 8 mil", "há 2 dias".

**5. Ícone sempre com palavra.**
Só lupa, coração, X e seta voltar podem ficar sem texto. O resto tem nome escrito embaixo.

**6. Letra grande e contraste forte.**
Texto mínimo 16, legenda mínima 13. Respeitar a letra grande que a pessoa colocou no celular. Contraste conferido (ver DESIGN-SYSTEM.md): nada de texto branco no laranja, nada de cinza clarinho. Tem que dar para ler **no sol do meio-dia**.

**7. Toque fácil.**
Tudo que se toca tem pelo menos 48 × 48 px e 8 px de espaço do vizinho. Nada de gesto escondido (apertar e segurar, deslizar para apagar) como único jeito de fazer algo.

**8. Leve e tolerante à internet ruim.**
- Mostrar o esqueleto da tela na hora e preencher depois.
- Fotos reduzidas antes de enviar e carregadas em tamanho pequeno primeiro.
- Rascunho do anúncio salvo a cada passo; se cair, volta de onde parou.
- Sem internet: aviso claro "Você está sem internet. O que você preencheu está guardado."
- Botão que envia algo trava depois do primeiro toque (evita anúncio duplicado).
- Nada de vídeo tocando sozinho, nada de animação pesada.

**9. Não pedir conta antes da hora.**
Ver, buscar e chamar no WhatsApp: sem conta. O "entre com seu celular" só aparece quando a pessoa quer favoritar, anunciar ou pedir no Radar, e depois volta para o que ela estava fazendo.

**10. Sempre uma saída.**
Nenhuma tela vazia sem caminho: busca sem resultado oferece Radar e Aki; lista de favoritos vazia mostra "Toque no ♡ dos anúncios que gostar"; erro oferece "Tentar de novo". Sempre dá para voltar.

**11. Confiança visível.**
- "Patrocinado" sempre escrito em anúncio pago.
- Aviso "nunca pague antes de ver o produto" em todo anúncio.
- Selo da loja verificada com nome ("Loja verificada"), não só um escudinho.
- Mostrar quanto tempo o vendedor está no Mercado da Região e se responde rápido.
- Endereço exato de pessoa física nunca aparece; só bairro.
- O Aki sempre se apresenta como robô.

**12. Confirmar o que não tem volta, desfazer o que tem.**
Excluir anúncio e excluir conta pedem confirmação. Pausar, marcar como vendido e tirar favorito mostram "Desfazer" por alguns segundos.

---

## Acessibilidade (lei e bom senso)

Meta: **WCAG 2.1 nível AA** (é a referência da Lei Brasileira de Inclusão).
- Todo botão e imagem com nome para leitor de tela (TalkBack no Android). Foto do anúncio: "Foto 1 de 8 de Moto Titan 2015".
- Ordem de leitura igual à ordem visual.
- Erro de formulário escrito ao lado do campo, em texto, não só borda vermelha.
- Nada depende só de cor (selo "Vendido" tem palavra, não só cinza).
- Funciona com zoom de 200% sem cortar texto.
- Fase 2: botão "ouvir" na descrição do anúncio (leitura em voz alta do próprio celular) e anunciar por áudio pelo Aki.

---

## Como testar com gente de verdade (antes e depois do lançamento)

**Teste de corredor, 5 pessoas, 20 minutos cada** (pega uns 80% dos problemas):
- 2 comerciantes do centro de Corrente, 2 pessoas acima de 50 anos, 1 jovem.
- Celular **delas**, na internet **delas**.
- Tarefas, sem ajudar: (1) "Ache uma moto até R$ 10 mil e chame o vendedor." (2) "Anuncie esta cadeira" (tirando foto na hora). (3) "Peça uma geladeira no Radar."
- Anotar: onde travou, o que perguntou, quanto tempo levou, palavras que não entendeu.
- Repetir a cada versão grande. Dá para fazer com o link de prévia da Vercel antes de ir para o ar.

**Metas para o piloto (medidas no painel):**
| O que | Meta |
|---|---|
| Anunciar do início ao fim | menos de 2 minutos |
| Quem começa um anúncio e termina | mais de 70% |
| Do Início ao WhatsApp do vendedor | 3 toques |
| Página do anúncio abrir no 3G | até 3 segundos |
| Pedidos no Radar com pelo menos 1 proposta | mais de 60% |

---

## Checklist antes de aprovar qualquer tela

- [ ] Funciona com uma mão numa tela de 360px?
- [ ] Tem só um botão laranja, e ele diz o que faz?
- [ ] Dá para fazer sem digitar quase nada?
- [ ] Alguma palavra técnica ou em inglês?
- [ ] Letra mínima 16 (13 em legenda) e contraste conferido?
- [ ] Botões com 48px?
- [ ] O que acontece com internet lenta, sem internet e com erro?
- [ ] Tela vazia tem saída?
- [ ] Pede conta só quando precisa?
- [ ] O leitor de tela consegue ler?
