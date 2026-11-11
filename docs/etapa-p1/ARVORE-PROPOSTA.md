# Etapa P1 — Proposta da árvore de categorias (para revisão)

Status: **aprovada em 11/11/2026 e programada** na migração
`supabase/migrations/20261112010000_categorias_3_niveis.sql` (ainda não aplicada em produção).
Base: OLX (Anexo A de `docs/PLANO-PRODUTOS.md`) + o que já existe no Mercado da Região + o regional.
As diferenças entre esta proposta e o que foi programado estão em "O que mudou na programação", no fim.

Como ler:
- **Grande › Sub › Tipo**.
- Os tipos (3º nível) só aparecem onde ajudam a achar o produto. O resto cresce pelas sugestões ("Sugerir categoria").
- **Campos**: \* = obrigatório. Os outros são opcionais. "lista" = o vendedor escolhe entre opções, e o campo vira filtro.
- `(slug atual)` = a categoria já existe com esse endereço, então os anúncios não mudam de lugar.
- **Campos comuns** (valem em quase todas as categorias de produto): Estado (Novo, Seminovo, Usado), lista, opcional.

## Árvore

### 1. Veículos `(veiculos)`
- Carros `(carros)` — Marca\*, Modelo\*, Ano\*, Km, Câmbio, Combustível, Cor
- Motos `(motos)` — Marca\*, Modelo\*, Ano\*, Km, Cilindrada, Cor
- Caminhões e utilitários `(caminhoes-e-utilitarios)` — Marca\*, Modelo\*, Ano\*, Km, Combustível
- Ônibus e vans *(novo)* — Marca\*, Ano\*, Lugares
- Peças e acessórios `(pecas-e-acessorios)` — Para qual veículo (lista: Carro, Moto, Caminhão)\*, Estado
  - Tipos: Peças de motor, Pneus e rodas, Som e multimídia, Acessórios, Peças de moto

### 2. Imóveis `(imoveis)`
- Casas `(casas)` — Venda ou aluguel\*, Quartos\*, Banheiros, Vagas, Área (m²)
- Apartamentos `(apartamentos)` — Venda ou aluguel\*, Quartos\*, Banheiros, Vagas, Área
- Kitnets e quartos *(novo)* — Venda ou aluguel\*, Mobiliado (sim/não)
- Terrenos e lotes `(terrenos-e-lotes)` — Venda ou aluguel\*, Área\*
- Fazendas e sítios `(fazendas-e-sitios)` — Venda ou aluguel\*, Área (ha)\*
- Pontos comerciais `(pontos-comerciais)` — Venda ou aluguel\*, Área
- Temporada *(novo)* — Hóspedes\*, Quartos

### 3. Agro `(agro)` — forte na região
- Tratores e máquinas `(tratores-e-maquinas)` — Marca\*, Modelo\*, Ano\*, Horas, Potência
- Implementos `(implementos)` — Tipo de implemento (lista)\*, Marca, Ano
- Peças para tratores e máquinas *(novo)* — Marca da máquina, Estado
- Gado e animais `(gado-e-animais)` — Espécie (lista)\*, Quantidade\*, Raça, Sexo, Idade média, Peso médio
  - Tipos: Bovinos, Equinos, Caprinos e ovinos, Suínos, Aves
- Sementes e insumos `(sementes-e-insumos)` — Quantidade, Unidade (lista: kg, saca, litro)\*
  - Tipos: Sementes, Adubos e fertilizantes, Defensivos, Rações para criação, Sal mineral
- Grãos `(graos)` — Grão (lista: Soja, Milho, Feijão, Arroz, Outro)\*, Quantidade (sacas)\*
- Apicultura *(novo)* — Produto (lista: Mel, Colmeias, Equipamentos)\*

### 4. Pet *(nova grande; hoje é "Outros › Animais de estimação")*
- Cachorros *(novo)* — Raça, Idade, Sexo, Vacinado (sim/não), Castrado (sim/não), Doação (sim/não)\*
- Gatos *(novo)* — mesmos campos de Cachorros
- Outros animais `(animais-de-estimacao)` — Espécie (lista: Pássaro, Peixe, Roedor, Coelho, Réptil, Outro)\*, Doação\*
- Produtos para pets *(novo)* — Para qual animal (lista: Cachorro, Gato, Pássaro, Peixe, Roedor, Outro)\*, Marca
  - Tipos: **Ração** (Peso da embalagem em kg\*, Fase: Filhote, Adulto, Sênior), Petiscos, Coleiras e guias, Camas e casinhas, Brinquedos, Higiene e saúde, Aquários e gaiolas

### 5. Celulares e telefonia *(nova grande)*
- Celulares `(celulares)` — Marca (lista)\*, Modelo\*, Armazenamento (lista), Estado
- Acessórios de celular — Tipos: Capas e películas, Carregadores e cabos, Fones, Suportes
- Peças de celular — Tela, Bateria, Outras
- Smartwatches — Marca\*
- Telefonia fixa

### 6. Informática `(informatica, vira grande)`
- Notebooks — Marca\*, Processador, Memória (lista), Armazenamento
- Computadores — Processador, Memória, Armazenamento
- Monitores — Tamanho (pol.)
- Tablets e leitores — Marca\*
- Impressoras e scanners
- Periféricos — Tipos: Teclados e mouses, Webcams, Caixas de som, Estabilizadores e nobreaks
- Peças e componentes — Tipos: Placas de vídeo, Memória RAM, Processadores, HD e SSD
- Redes e internet — Tipos: Roteadores, Antenas, Cabos

### 7. Games `(games, vira grande)`
- Consoles — Plataforma (lista: PlayStation, Xbox, Nintendo, Outro)\*
- Jogos — Plataforma\*
- Acessórios de games — Plataforma

### 8. TV, áudio e foto *(nova grande; junta "TV e som")*
- TVs `(tv-e-som)` — Tamanho (pol.)\*, Marca
- Som e caixas — Tipos: Caixas de som, Aparelhos de som, Som profissional
- Fones de ouvido
- Streaming e TV box
- Projetores
- Câmeras e drones — Tipos: Câmeras, Drones, Lentes e acessórios

### 9. Eletro `(eletrodomesticos, vira grande)`
- Geladeiras e freezers — Voltagem (lista: 110 V, 220 V, Bivolt)\*
- Fogões e fornos — Bocas (lista)
- Máquinas de lavar e secadoras — Capacidade (kg), Voltagem\*
- Ar-condicionado e ventiladores — Voltagem\*, BTUs
- Portáteis de cozinha — Voltagem\* (Liquidificador, Air fryer, Micro-ondas…)
- Cuidados pessoais — Voltagem

### 10. Móveis `(moveis, vira grande)`
- Sofás e poltronas
- Camas e colchões — Tamanho (lista: Solteiro, Casal, Queen, King)\*
- Guarda-roupas e cômodas
- Mesas e cadeiras
- Racks e estantes
- Móveis de escritório

### 11. Casa e decoração `(casa-e-moveis, renomeada)`
- Decoração `(decoracao)`
- Cozinha e utensílios
- Cama, mesa e banho
- Iluminação
- Jardim e área externa
- Limpeza e organização
- Segurança e casa inteligente

### 12. Materiais de construção `(construcao, vira grande)`
- Ferramentas — Tipos: Elétricas, Manuais
- Elétrica e hidráulica
- Louças, metais e pias
- Portas e janelas
- Pisos e revestimentos
- Tintas e pintura
- Alvenaria e estrutura

### 13. Moda e beleza `(moda-e-beleza)`
- Roupas `(roupas)` — Para quem (lista: Feminino, Masculino, Unissex)\*, Tamanho (lista: PP–GG, 34–56)
- Calçados `(calcados)` — Para quem\*, Número\*
- Bolsas e acessórios `(bolsas)`
- Joias e relógios
- Beleza e perfumaria `(beleza)`

### 14. Infantil `(infantil, vira grande)`
- Roupas infantis — Tamanho
- Calçados infantis — Número
- Brinquedos e jogos
- Carrinhos e cadeirinhas
- Móveis infantis
- Maternidade

### 15. Esporte e lazer `(esporte, vira grande)`
- Bicicletas e ciclismo — Aro (lista)
- Academia e fitness
- Futebol e esportes de quadra
- Pesca e camping
- Roupas e calçados esportivos

### 16. Música e hobbies *(nova grande)*
- Instrumentos musicais — Tipos: Cordas, Teclados, Percussão, Sopro, Equipamentos
- Livros e revistas
- Colecionáveis e antiguidades
- Artesanato

### 17. Comércio e escritório *(nova grande)*
- Equipamentos para comércio
- Gastronomia e food service
- Equipamentos de saúde e estética
- Uniformes e EPIs
- Papelaria e escritório

### 18. Festas e eventos *(nova grande)*
- Decoração de festa
- Aluguel para festas
- Lembrancinhas e convites
- Noivas e noivos

### 19. Serviços `(servicos)` — sem campos, o anunciante descreve
- Pedreiro `(pedreiro)`, Eletricista `(eletricista)`, Fretes e mudanças `(fretes)`, Diaristas `(diaristas)`, Aulas `(aulas)`
- *(novos)* Encanador, Pintor, Mecânico, Conserto de celular e informática, Beleza e estética, Buffet e eventos
- Outros serviços `(outros-servicos)`

### 20. Empregos `(empregos)`
- Vagas `(vagas)` — Tipo (lista: CLT, Diária, Freelance, Estágio)\*
- Procuro trabalho `(procuro-trabalho)`

### 21. Outros `(outros)`
- Diversos `(diversos)` — a última opção, sempre presente

## Tabela de troca (o que muda para os anúncios de hoje)

| Hoje | Vai para | Precisa o dono confirmar? |
|---|---|---|
| Veículos, Imóveis, Agro, Serviços, Empregos (todas as subs) | mesma categoria (o slug fica) | não |
| Casa e móveis › Móveis | Móveis (grande) — o anúncio fica sem sub | **sim**, escolher a sub |
| Casa e móveis › Eletrodomésticos | Eletro (grande) | **sim** |
| Casa e móveis › Decoração | Casa e decoração › Decoração | não |
| Casa e móveis › Construção | Materiais de construção (grande) | **sim** |
| Eletrônicos › Celulares | Celulares e telefonia › Celulares | não |
| Eletrônicos › Informática | Informática (grande) | **sim** |
| Eletrônicos › TV e som | TV, áudio e foto › TVs | **sim** (pode ser som) |
| Eletrônicos › Games | Games (grande) | **sim** |
| Moda › Roupas, Calçados, Bolsas, Beleza | mesmas | não |
| Outros › Esporte | Esporte e lazer (grande) | **sim** |
| Outros › Infantil | Infantil (grande) | **sim** |
| Outros › Animais de estimação | Pet › Outros animais | **sim** (pode ser cachorro, gato ou produto) |
| Outros › Diversos | Outros › Diversos | não |

"Sim" = o anúncio continua no ar, mas aparece em "Revise suas categorias" com uma sugestão.
O campo "Estado" continua igual para todos. Campos novos obrigatórios **não** tiram do ar anúncios antigos: só serão pedidos na próxima edição.

## Para o Raniel decidir na revisão
1. Os nomes das 21 categorias grandes estão bons? (Ex.: "Pet" ou "Animais e pet"?)
2. Falta alguma categoria forte em Corrente e no sul do Piauí?
3. Os campos obrigatórios (\*) estão poucos o bastante?

## O que mudou na programação
- **Pet** usa o slug já existente `animais-de-estimacao` (não muda o endereço dos anúncios de hoje). "Outros animais" usa `outros-animais`.
- Categorias que já existiam **mantêm os campos que tinham**; a migração só põe campos nas novas.
- O campo de **doação** é opcional em todas.
- **TV e som** virou subcategoria "TV e som" (dentro de TV, áudio e foto), com os tipos TVs, Som e caixas e Outros.
- A antiga **Eletrônicos** (`eletronicos`) foi desligada: suas filhas mudaram de mãe e ela some do menu.
- No **Radar**, pedido antigo do tipo "móvel" agora aponta para **Móveis** (`moveis`).
- Toda categoria que tem filhas fica sem campos e sem faixa de preço: os campos ficam no último nível.
- Anúncio que estava numa categoria que ganhou filhas continua no ar e recebe uma sugestão de folha (pela palavra do título), que o dono confirma em "Revise suas categorias".
- Categoria que já existe **continua ligada ou desligada** como o admin deixou; a carga não religa nada.
- Depois da troca, quando o admin cria uma subcategoria dentro de uma categoria que já tem anúncios,
  esses anúncios ganham a subcategoria nova como sugestão em "Revise suas categorias".
- A sugestão automática só usa **palavra inteira** do título (aceita plural simples): "hd" não casa com "hdmi".
- **Antes de aplicar em produção:** conferir se há subcategoria ligada dentro de "Eletrônicos" ou de outra
  categoria desligada que não está nesta árvore. Se houver, a migração para no fim e nada muda.
