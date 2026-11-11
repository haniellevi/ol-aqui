"use client";

import { Botao } from "@/components/ui/botao";
import { TextoSaldoAki, useImagemAki } from "@/components/aki/imagem-aki";

export function FotoProdutoAki({
  anuncio, original, travado, aplicar, fechar,
}: {
  anuncio: string;
  original: string;
  travado: boolean;
  aplicar: (url: string) => void;
  fechar: () => void;
}) {
  const aki = useImagemAki(`aki:produto:${anuncio}:${original}`, new URLSearchParams({ tipo: "produto", anuncio, foto: original }).toString());
  const ocupado = aki.ocupado || travado;

  return (
    <section aria-labelledby="foto-aki-titulo" className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
      <h2 id="foto-aki-titulo" className="text-lg font-semibold text-beringela">Melhorar foto com o Aki</h2>
      <p className="text-sm">O Aki limpa o fundo e procura preservar os detalhes do produto. Compare o resultado com a foto original antes de escolher.</p>
      <TextoSaldoAki saldo={aki.saldo} />
      <div className="grid grid-cols-2 gap-3">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- foto do anúncio no Storage */}
          <img src={original} alt="Foto original do produto" className="aspect-[4/3] w-full rounded-campo bg-fundo object-contain" />
          <figcaption className="text-sm font-semibold">Original</figcaption>
        </figure>
        {aki.imagem && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- resultado do Aki no Storage */}
            <img src={aki.imagem.url} alt="Foto tratada do produto" className="aspect-[4/3] w-full rounded-campo bg-fundo object-contain" />
            <figcaption className="text-sm font-semibold">Versão do Aki</figcaption>
          </figure>
        )}
      </div>
      {aki.erro && <p role="alert" className="text-sm text-perigo">{aki.erro}</p>}
      <div className="flex flex-wrap gap-2">
        {aki.imagem && <Botao type="button" disabled={ocupado} onClick={() => aplicar(aki.imagem!.url)}>Usar versão do Aki</Botao>}
        <Botao type="button" variante="secundario"
          disabled={ocupado || (!aki.pendente && (aki.saldo?.disponivel === false || aki.saldo?.restantes === 0))}
          carregando={aki.ocupado} textoCarregando="O Aki está tratando a foto..."
          onClick={() => { void aki.gerar({ tipo: "produto", id: crypto.randomUUID(), anuncio, foto: original }); }}>
          {aki.pendente ? "Conferir pedido" : aki.imagem ? "Gerar outra versão · usa 1 crédito" : "Melhorar foto · usa 1 crédito"}
        </Botao>
        <Botao type="button" variante="texto" disabled={ocupado} onClick={fechar}>Manter original</Botao>
      </div>
    </section>
  );
}
