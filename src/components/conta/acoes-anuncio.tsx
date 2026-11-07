"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pause, Pencil, Play, Sparkles, Trash2, ArrowRight } from "lucide-react";
import { linkDestacar } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { excluirRascunho, marcarVendido, pausarAnuncio, reativarAnuncio } from "@/app/(conta)/minha-conta/anuncios/actions";
import type { Resultado, StatusAnuncio } from "@/lib/tipos";

// Botões de cada anúncio em "Meus anúncios" (T32) e a pergunta "Vendeu pelo OLAKI?" (F8).

type Acao = "pausar" | "reativar" | "vendido-sim" | "vendido-nao" | "excluir";

export function AcoesAnuncio({ id, status, titulo }: { id: string; status: StatusAnuncio; titulo: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [emCurso, setEmCurso] = useState<Acao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const dialogoVendi = useRef<HTMLDialogElement>(null);
  const dialogoExcluir = useRef<HTMLDialogElement>(null);

  function rodar(acao: Acao, fn: () => Promise<Resultado<unknown>>, depois?: (r: Resultado<unknown>) => void) {
    setErro(null);
    setAviso(null);
    setEmCurso(acao);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro.mensagem);
      else {
        depois?.(r);
        dialogoVendi.current?.close();
        dialogoExcluir.current?.close();
        router.refresh();
      }
      setEmCurso(null);
    });
  }

  const ocupado = pendente;
  const editar = `/anunciar/detalhes?rascunho=${id}&editar=1`;
  const podeVender = status === "ativo"; // o banco só aceita vendido para anúncio no ar
  const podeReativar = status === "pausado" || status === "expirado";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {status === "rascunho" ? (
          <>
            <Botao href={`/anunciar/fotos?rascunho=${id}`} icone={<ArrowRight />} className="px-3">
              Continuar
            </Botao>
            <Botao variante="perigo" icone={<Trash2 />} className="px-3" onClick={() => dialogoExcluir.current?.showModal()} disabled={ocupado}>
              Excluir
            </Botao>
          </>
        ) : (
          <>
            {status !== "congelado" && status !== "em_analise" && status !== "vendido" && (
              <Botao href={editar} variante="secundario" icone={<Pencil />} className="px-3">
                Editar
              </Botao>
            )}
            {status === "ativo" && (
              <Botao
                variante="secundario"
                icone={<Pause />}
                className="px-3"
                carregando={emCurso === "pausar"}
                disabled={ocupado}
                onClick={() => rodar("pausar", () => pausarAnuncio(id))}
              >
                Pausar
              </Botao>
            )}
            {status === "ativo" && (
              <Botao href={linkDestacar(id)} variante="secundario" icone={<Sparkles />} className="col-span-2 px-3">
                Destacar
              </Botao>
            )}
            {podeReativar && (
              <Botao
                variante="secundario"
                icone={<Play />}
                className="px-3"
                carregando={emCurso === "reativar"}
                disabled={ocupado}
                onClick={() =>
                  rodar("reativar", () => reativarAnuncio(id), (r) => {
                    if (r.ok && r.dados === "em_analise") setAviso("Seu anúncio foi para análise. Avisamos quando for liberado.");
                  })
                }
              >
                Reativar
              </Botao>
            )}
            {podeVender && (
              <Botao icone={<CheckCircle2 />} className="col-span-2 px-3" onClick={() => dialogoVendi.current?.showModal()} disabled={ocupado}>
                Vendi
              </Botao>
            )}
          </>
        )}
      </div>

      <div aria-live="polite">
        {erro && (
          <p role="alert" className="text-sm font-semibold text-perigo">
            {erro}
          </p>
        )}
        {aviso && <p className="text-sm font-semibold text-aviso">{aviso}</p>}
      </div>

      {/* F8 · Vendeu pelo OLAKI? */}
      <dialog
        ref={dialogoVendi}
        aria-labelledby={`vendi-${id}`}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-folha bg-cartao p-5 text-texto shadow-2 backdrop:bg-beringela/50"
      >
        <h2 id={`vendi-${id}`} className="text-xl font-bold">
          Vendeu pelo OLAKI?
        </h2>
        <p className="mt-1 text-base text-texto-suave">
          O anúncio <strong className="text-texto">{titulo}</strong> sai da busca e quem tiver o link vê &quot;Vendido&quot;.
        </p>
        {erro && (
          <p role="alert" className="mt-2 text-sm font-semibold text-perigo">
            {erro}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <Botao
            larguraTotal
            carregando={emCurso === "vendido-sim"}
            disabled={ocupado}
            onClick={() => rodar("vendido-sim", () => marcarVendido(id, true))}
          >
            Sim, vendi pelo OLAKI
          </Botao>
          <Botao
            variante="secundario"
            larguraTotal
            carregando={emCurso === "vendido-nao"}
            disabled={ocupado}
            onClick={() => rodar("vendido-nao", () => marcarVendido(id, false))}
          >
            Não, vendi por fora
          </Botao>
          <Botao variante="texto" larguraTotal disabled={ocupado} onClick={() => dialogoVendi.current?.close()}>
            Voltar
          </Botao>
        </div>
      </dialog>

      {/* Confirmação para excluir rascunho */}
      <dialog
        ref={dialogoExcluir}
        aria-labelledby={`excluir-${id}`}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-folha bg-cartao p-5 text-texto shadow-2 backdrop:bg-beringela/50"
      >
        <h2 id={`excluir-${id}`} className="text-xl font-bold">
          Excluir este rascunho?
        </h2>
        <p className="mt-1 text-base text-texto-suave">O rascunho e as fotos dele serão apagados. Não dá para desfazer.</p>
        {erro && (
          <p role="alert" className="mt-2 text-sm font-semibold text-perigo">
            {erro}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <Botao
            variante="perigo"
            larguraTotal
            icone={<Trash2 />}
            carregando={emCurso === "excluir"}
            textoCarregando="Excluindo..."
            disabled={ocupado}
            onClick={() => rodar("excluir", () => excluirRascunho(id))}
          >
            Sim, excluir
          </Botao>
          <Botao variante="secundario" larguraTotal disabled={ocupado} onClick={() => dialogoExcluir.current?.close()}>
            Não, manter
          </Botao>
        </div>
      </dialog>
    </div>
  );
}
