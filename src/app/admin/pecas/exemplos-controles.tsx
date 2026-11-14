"use client";

import { useState } from "react";
import { Campo } from "@/components/ui/campo";
import { Chip } from "@/components/ui/chip";
import { Botao } from "@/components/ui/botao";
import { Seletor } from "@/components/conta/seletor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folha, FolhaContent, FolhaDescription, FolhaHeader, FolhaTitle, FolhaTrigger } from "@/components/ui/folha";

export function ExemplosControles() {
  const [ativo, setAtivo] = useState(false);

  return (
    <>
      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="pecas-acoes">
        <h2 id="pecas-acoes" className="text-xl font-semibold">Botões e filtros</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Botao tamanho="toque">Salvar</Botao>
          <Botao tamanho="toque" variante="secundario">Ver anúncio e disponibilidade na minha região</Botao>
          <Botao tamanho="toque" variante="secundario" carregando textoCarregando="Salvando…">Salvar</Botao>
          <Botao tamanho="toque" variante="secundario" disabled>Indisponível</Botao>
        </div>
        <Chip tamanho="toque" className="self-start" ativo={ativo} onClick={() => setAtivo(!ativo)}>
          Produtos disponíveis para retirada em Corrente e nas cidades vizinhas
        </Chip>
      </section>
      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="pecas-campos">
        <h2 id="pecas-campos" className="text-xl font-semibold">Campos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo name="pecas-preco" rotulo="Preço" tamanho="toque" prefixo="R$" inputMode="decimal" defaultValue="1.250,00" dica="Informe o valor total." />
          <Seletor name="pecas-cidade" rotulo="Cidade da retirada" tamanho="toque" erro="Selecione a cidade onde o comprador pode retirar.">
            <option value="">Escolha a cidade</option>
            <option value="corrente">Corrente</option>
            <option value="formosa">Formosa do Rio Preto</option>
          </Seletor>
        </div>
      </section>
      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="pecas-abas">
        <h2 id="pecas-abas" className="text-xl font-semibold">Abas e folha</h2>
        <Tabs defaultValue="anuncios">
          <TabsList aria-label="Seções do exemplo">
            <TabsTrigger value="anuncios">Meus anúncios</TabsTrigger>
            <TabsTrigger value="propostas">Propostas recebidas</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios da loja na região</TabsTrigger>
          </TabsList>
          <TabsContent value="anuncios">Acompanhe seus anúncios publicados e em revisão.</TabsContent>
          <TabsContent value="propostas">Compare as propostas que chegaram pelo Radar.</TabsContent>
          <TabsContent value="relatorios">Consulte os números da sua vitrine.</TabsContent>
        </Tabs>
        <Folha>
          <FolhaTrigger render={<Botao tamanho="toque" variante="secundario" className="self-start">Abrir exemplo da folha</Botao>} />
          <FolhaContent>
            <FolhaHeader>
              <FolhaTitle>Editar dados do anúncio</FolhaTitle>
              <FolhaDescription>Confira as informações antes de publicar.</FolhaDescription>
            </FolhaHeader>
            <Campo name="pecas-titulo" rotulo="Título do anúncio" tamanho="toque" defaultValue="Mesa de madeira com seis cadeiras" />
          </FolhaContent>
        </Folha>
      </section>
    </>
  );
}
