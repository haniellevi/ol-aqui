"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Search } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CirculoCategoria } from "@/components/ui/icone-categoria";
import { salvarCategoria } from "@/app/(conta)/anunciar/actions";
import { buscarFolhas, caminhoAte, ehFolha, nomeCaminho, percorrer, type NoCategoria } from "@/lib/categorias-arvore";
import type { CategoriaComFilhas } from "@/lib/tipos";
import { AvisoErro } from "./aviso-erro";
import { useEnvioAnuncio } from "./enviar";
import { BarraContinuar } from "./barra-continuar";
import { classesCampo } from "@/components/ui/input";

// Passo 2 · Categoria em até 3 níveis: Grande › Sub › Tipo. Quem tem filhas abre a lista de dentro;
// só a folha (sem filhas) recebe o anúncio. A busca acha em todos os níveis e mostra o caminho.

const OPCAO =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-card border border-borda bg-cartao p-3 pr-3 text-base font-semibold " +
  "hover:bg-fundo has-[:checked]:border-beringela has-[:checked]:bg-selecao has-[:focus-visible]:outline-3 " +
  "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-laranja-escuro";

const RAMO =
  "flex min-h-14 w-full items-center gap-3 rounded-card border border-borda bg-cartao p-3 text-left text-base font-semibold hover:bg-fundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

export function EscolhaCategoria({
  id,
  editar,
  formId,
  arvore,
  selecionadaId,
}: {
  id: string;
  editar: boolean;
  formId: string;
  arvore: CategoriaComFilhas[];
  selecionadaId: string | null;
}) {
  const [estado, onSubmit, enviando, enviar] = useEnvioAnuncio(salvarCategoria);
  // ids das categorias abertas (Grande, Sub...). Vazio = mostra as grandes.
  const [abertas, setAbertas] = useState<string[]>((caminhoAte(arvore, selecionadaId ?? "") ?? []).slice(0, -1).map((c) => c.id));
  const [filhaId, setFilhaId] = useState<string | null>(selecionadaId);
  const [busca, setBusca] = useState("");
  // Categoria sugerida pela pessoa (quando a busca não acha nada). Vai junto ao salvar a categoria.
  const [sugestao, setSugestao] = useState<string | null>(null);

  const aberta = useMemo(() => {
    let nivel = arvore;
    let caminho: CategoriaComFilhas[] = [];
    for (const id of abertas) {
      const no = nivel.find((c) => c.id === id);
      if (!no) break;
      caminho = [...caminho, no];
      nivel = no.filhas;
    }
    return caminho.length ? { no: caminho[caminho.length - 1], caminho } : null;
  }, [abertas, arvore]);

  const itens = aberta ? aberta.no.filhas : arvore;
  const achadas = useMemo(() => buscarFolhas(arvore, busca), [busca, arvore]);
  const escolhida = useMemo(() => percorrer(arvore).find((x) => x.no.id === filhaId) ?? null, [filhaId, arvore]);
  const outros = arvore.find((p) => p.slug === "outros");
  const diversos = outros?.filhas.find((f) => f.slug === "diversos");

  function opcao({ no, caminho }: NoCategoria, mostrarCaminho: boolean) {
    return (
      <li key={no.id}>
        <label className={OPCAO}>
          <input
            type="radio"
            name="escolha-categoria"
            value={no.id}
            checked={filhaId === no.id}
            onChange={() => setFilhaId(no.id)}
            className="sr-only"
          />
          <CirculoCategoria nome={no.icone || caminho[0].icone} />
          <span className="flex flex-1 flex-col">
            <span>{no.nome}</span>
            {mostrarCaminho && caminho.length > 1 && <span className="text-sm font-normal text-texto-suave">{nomeCaminho(caminho)}</span>}
          </span>
          {filhaId === no.id && <Check className="size-6 text-beringela" aria-hidden />}
        </label>
      </li>
    );
  }

  // Categoria com filhas: botão que abre a lista de dentro.
  function ramo(no: CategoriaComFilhas) {
    return (
      <li key={no.id}>
        <button type="button" onClick={() => setAbertas([...abertas, no.id])} className={RAMO}>
          <CirculoCategoria nome={no.icone} />
          <span className="flex-1">{no.nome}</span>
          <ChevronRight className="size-5 text-texto-suave" aria-hidden />
        </button>
      </li>
    );
  }

  // Lista de um nível: folhas escolhem; categorias com filhas abrem.
  function nivel(lista: CategoriaComFilhas[], caminhoBase: CategoriaComFilhas[]) {
    return lista.map((f) => (ehFolha(f) ? opcao({ no: f, caminho: [...caminhoBase, f] }, false) : ramo(f)));
  }

  return (
    <form id={formId} action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="editar" value={editar ? "1" : ""} />
      <input type="hidden" name="categoria_id" value={filhaId ?? ""} />

      <AvisoErro mensagem={estado?.erro?.mensagem} />
      <input type="hidden" name="sugestao_categoria" value={sugestao ?? ""} />

      {sugestao && (
        <div role="status" className="flex flex-col gap-2 rounded-card border border-borda bg-fundo p-3 text-base">
          <p>Escolha abaixo a categoria mais parecida. Seu anúncio vai ao ar nela enquanto a equipe analisa a sugestão.</p>
          <p className="text-sm text-texto-suave">
            Sugestão: <strong>{sugestao}</strong>
          </p>
          <Botao variante="texto" className="self-start" onClick={() => setSugestao(null)}>
            Tirar a sugestão
          </Botao>
        </div>
      )}

      {escolhida && (
        <p className="rounded-card bg-selecao p-3 text-base" aria-live="polite">
          Escolhida: <strong>{nomeCaminho(escolhida.caminho)}</strong>
          {selecionadaId && selecionadaId !== filhaId && (
            <span className="mt-1 block text-sm">A troca mantém os dados compatíveis. Os demais detalhes precisarão ser preenchidos na nova categoria.</span>
          )}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="busca-categoria" className="text-base font-semibold">
          Procurar categoria
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-suave" aria-hidden />
          <input
            id="busca-categoria"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: moto, geladeira, ração"
            autoComplete="off"
            className={`${classesCampo} h-10 pl-10`}
          />
        </div>
      </div>

      {busca.trim() ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-semibold" aria-live="polite">
            {achadas.length ? `${achadas.length} ${achadas.length === 1 ? "encontrada" : "encontradas"}` : "Nenhuma categoria encontrada"}
          </legend>
          {achadas.length ? (
            <ul className="flex flex-col gap-2">{achadas.map((x) => opcao(x, true))}</ul>
          ) : (
            <>
              <p className="text-sm text-texto-suave">
                {diversos ? "Procure a categoria mais próxima. Se nenhuma servir, escolha Outros › Diversos." : "Tente uma palavra mais ampla ou veja a lista de categorias."}
              </p>
              {busca.trim().length >= 2 && (
                <Botao
                  variante="secundario"
                  className="self-start"
                  onClick={() => {
                    setSugestao(busca.trim().replace(/\s+/g, " ").slice(0, 60));
                    setBusca("");
                    setAbertas([]);
                  }}
                >
                  Sugerir a categoria “{busca.trim()}”
                </Botao>
              )}
              <Botao variante="secundario" className="self-start" onClick={() => { setBusca(""); setAbertas([]); }}>Ver todas as categorias</Botao>
              {outros && diversos && <ul>{opcao({ no: diversos, caminho: [outros, diversos] }, true)}</ul>}
            </>
          )}
        </fieldset>
      ) : aberta ? (
        <fieldset className="flex flex-col gap-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <legend className="text-base font-semibold">Qual destes em {nomeCaminho(aberta.caminho)}?</legend>
            <Botao variante="texto" onClick={() => setAbertas(abertas.slice(0, -1))}>
              Voltar
            </Botao>
          </div>
          <ul className="flex flex-col gap-2">{nivel(itens, aberta.caminho)}</ul>
        </fieldset>
      ) : (
        <section aria-labelledby="titulo-grandes" className="flex flex-col gap-2">
          <h2 id="titulo-grandes" className="text-base font-semibold">
            Escolha a categoria
          </h2>
          <ul className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">{nivel(arvore, [])}</ul>
        </section>
      )}

      <BarraContinuar>
        <Botao type="submit" name="acao" value="seguir" larguraTotal carregando={enviando} textoCarregando="Salvando...">
          Continuar
        </Botao>
      </BarraContinuar>
    </form>
  );
}
