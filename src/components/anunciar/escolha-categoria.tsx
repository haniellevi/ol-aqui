"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { categoriasSugeridasIA, salvarCategoria } from "@/app/(conta)/anunciar/actions";
import { ArvoreCategorias } from "@/components/categorias/arvore-categorias";
import { nomeCaminho, percorrerLeve, type NoLeve } from "@/lib/categorias-arvore";
import type { CategoriaComFilhas } from "@/lib/tipos";
import { AvisoErro } from "./aviso-erro";
import { useEnvioAnuncio } from "./enviar";
import { BarraContinuar, BotaoPasso } from "./barra-continuar";
import { classesCampo } from "@/components/ui/input";

// Passo 2 · Categoria em até 3 níveis: Grande › Sub › Tipo. Só a folha (sem filhas) recebe o anúncio.
// No topo, "O que você está anunciando?": ao digitar, as categorias mais parecidas aparecem na hora
// (busca local, sem IA) e o texto já vira o começo do título, se o anúncio ainda não tem título.
// Etapa 2: 0,5 s depois que a pessoa para de digitar, a IA (JEV) sugere até 3 categorias, que vão para
// o topo dessa lista. Se a IA não responder, fica só a busca local, sem aviso.
// Embaixo, as usadas há pouco e a lista que abre no próprio lugar (ArvoreCategorias).

const MAX_TITULO = 90; // mesmo limite do banco (anuncios_titulo_check)
const ESPERA_IA_MS = 500;
const MIN_TEXTO_IA = 3;
const textoDaBusca = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, MAX_TITULO);

export function EscolhaCategoria({
  id,
  editar,
  daRevisao,
  formId,
  arvore,
  selecionadaId,
  tituloAtual,
}: {
  id: string;
  editar: boolean;
  daRevisao?: boolean;
  formId: string;
  arvore: CategoriaComFilhas[];
  selecionadaId: string | null;
  tituloAtual: string | null;
}) {
  const [estado, onSubmit, enviando, enviar] = useEnvioAnuncio(salvarCategoria);
  const [filhaId, setFilhaId] = useState<string | null>(selecionadaId);
  const [busca, setBusca] = useState("");
  // Categoria sugerida pela pessoa (quando a busca não acha nada). Vai junto ao salvar a categoria.
  const [sugestao, setSugestao] = useState<string | null>(null);
  // Sugestões da IA e o texto para o qual vieram (só valem enquanto o texto for o mesmo).
  const [ia, setIa] = useState<{ texto: string; ids: string[] }>({ texto: "", ids: [] });
  const rodada = useRef(0);

  useEffect(() => {
    const minha = ++rodada.current;
    const texto = textoDaBusca(busca);
    if (texto.length < MIN_TEXTO_IA) return;
    const t = setTimeout(async () => {
      try {
        const ids = await categoriasSugeridasIA(texto, id);
        if (minha === rodada.current) setIa({ texto, ids });
      } catch {
        // Sem IA agora: fica a busca local.
      }
    }, ESPERA_IA_MS);
    return () => clearTimeout(t);
  }, [busca, id]);

  const todos = useMemo(() => percorrerLeve(arvore), [arvore]);
  const escolhida = useMemo(() => todos.find((x) => x.no.id === filhaId) ?? null, [filhaId, todos]);
  const daIA = useMemo(
    () => (ia.texto && ia.texto === textoDaBusca(busca) ? ia.ids.map((i) => todos.find((x) => x.no.id === i)).filter((x): x is NoLeve => !!x) : []),
    [ia, busca, todos],
  );
  const outros = arvore.find((p) => p.slug === "outros");
  const diversos = outros?.filhas.find((f) => f.slug === "diversos");
  const temTitulo = !!tituloAtual?.trim();

  function escolher(x: NoLeve) {
    setFilhaId(x.no.id);
  }

  const semResultado = (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-texto-suave">
        {daIA.length
          ? diversos ? "Se nenhuma servir, escolha Outros › Diversos." : "Se nenhuma servir, veja a lista de categorias."
          : diversos ? "Tente uma palavra mais simples, como “moto” ou “sofá”. Se nenhuma servir, escolha Outros › Diversos." : "Tente uma palavra mais simples ou veja a lista de categorias."}
      </p>
      {busca.trim().length >= 2 && (
        <Botao
          variante="secundario"
          className="self-start"
          onClick={() => setSugestao(busca.trim().replace(/\s+/g, " ").slice(0, 60))}
        >
          Sugerir a categoria “{busca.trim().slice(0, 60)}”
        </Botao>
      )}
      <Botao variante="texto" className="self-start" onClick={() => setBusca("")}>
        Ver todas as categorias
      </Botao>
      {outros && diversos && !daIA.some((x) => x.no.id === diversos.id) && (
        <ul>
          <li>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-card border border-borda bg-cartao p-3 text-base font-semibold hover:bg-fundo has-[:checked]:border-beringela has-[:checked]:bg-selecao has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-laranja-escuro">
              <input
                type="radio"
                name="escolha-categoria"
                value={diversos.id}
                checked={filhaId === diversos.id}
                onChange={() => setFilhaId(diversos.id)}
                className="sr-only"
              />
              {nomeCaminho([outros, diversos])}
            </label>
          </li>
        </ul>
      )}
    </div>
  );

  return (
    <form id={formId} action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col gap-3 md:gap-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="editar" value={editar ? "1" : ""} />
      <input type="hidden" name="categoria_id" value={filhaId ?? ""} />
      <input type="hidden" name="sugestao_categoria" value={sugestao ?? ""} />
      {/* Texto cujas sugestões da IA estão na tela: o servidor só mede o acerto quando bate com a resposta guardada. */}
      <input type="hidden" name="texto_ia" value={ia.texto && ia.texto === textoDaBusca(busca) ? ia.texto : ""} />
      {!temTitulo && <input type="hidden" name="titulo_inicial" value={busca.trim().slice(0, MAX_TITULO)} />}

      <AvisoErro mensagem={estado?.erro?.mensagem} />

      <div className="flex flex-col gap-2">
        <label htmlFor="busca-categoria" className="text-base font-semibold">
          O que você está anunciando?
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-suave" aria-hidden />
          <input
            id="busca-categoria"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: moto Titan 160, geladeira, ração"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={MAX_TITULO}
            aria-describedby="ajuda-busca-categoria"
            className={`${classesCampo} h-11 pl-10 md:h-10`}
          />
        </div>
        <p id="ajuda-busca-categoria" className="text-sm text-texto-suave">
          {temTitulo ? "Escreva o que é e toque na categoria certa." : "O texto vira o começo do título."}
        </p>
      </div>

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
        <p className="rounded-card bg-selecao p-3 text-base text-beringela" aria-live="polite">
          Escolhida: <strong>{nomeCaminho(escolhida.caminho)}</strong>
          {selecionadaId && selecionadaId !== filhaId && (
            <span className="mt-1 block text-sm">A troca mantém os dados compatíveis. Os demais detalhes precisarão ser preenchidos na nova categoria.</span>
          )}
        </p>
      )}

      <ArvoreCategorias
        arvore={arvore}
        busca={busca}
        modo="escolher"
        selecionadaId={filhaId}
        aoEscolher={escolher}
        semResultado={semResultado}
        primeiras={daIA}
      />

      <BarraContinuar>
        <BotaoPasso editar={editar} daRevisao={daRevisao} salvando={enviando} />
      </BarraContinuar>
    </form>
  );
}
