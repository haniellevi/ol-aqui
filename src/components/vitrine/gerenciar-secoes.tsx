"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { apagarSecao, criarSecao, mostrarSecao, moverSecao, renomearSecao } from "@/app/(conta)/minha-conta/loja/vitrine-actions";
import { LINK_LOJA_SECOES } from "@/lib/rotas";
import type { MinhaSecao } from "@/lib/tipos-vitrine";
import type { Resultado } from "@/lib/tipos";
import { Alert } from "@/components/ui/alert";

// Seções próprias da loja: criar, renomear, subir/descer, esconder, apagar e escolher os produtos.
// O limite do plano é conferido no banco; aqui só avisamos antes.

export function GerenciarSecoes({
  secoes,
  maximo,
  podeCriar,
}: {
  secoes: MinhaSecao[];
  /** Quantas seções o plano mostra (null = sem limite). */
  maximo: number | null;
  podeCriar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [emCurso, setEmCurso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [apagar, setApagar] = useState<MinhaSecao | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);

  function rodar(chave: string, fn: () => Promise<Resultado<unknown>>, depois?: () => void) {
    setErro(null);
    setEmCurso(chave);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro.mensagem);
      else {
        depois?.();
        router.refresh();
      }
      setEmCurso(null);
    });
  }

  // Seções ativas além do limite do plano não aparecem na vitrine (nada é apagado)
  let ativasAteAgora = 0;
  const visivel = new Map<string, boolean>();
  for (const s of secoes) {
    if (!s.ativa) {
      visivel.set(s.id, false);
      continue;
    }
    ativasAteAgora++;
    visivel.set(s.id, maximo === null || ativasAteAgora <= maximo);
  }

  return (
    <div className="flex flex-col gap-4">
      {podeCriar && (
        <form
          className="flex flex-col gap-2 rounded-card bg-cartao p-4 shadow-1"
          onSubmit={(e) => {
            e.preventDefault();
            rodar("criar", () => criarSecao(nome), () => setNome(""));
          }}
        >
          <Campo
            rotulo="Nova seção"
            name="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={40}
            placeholder="Ex.: Promoções, Linha infantil"
            dica="De 2 a 40 letras."
          />
          <Botao type="submit" variante="secundario" icone={<Plus />} carregando={emCurso === "criar"} textoCarregando="Criando..." disabled={pendente} className="sm:w-fit">
            Criar seção
          </Botao>
        </form>
      )}

      <div aria-live="polite">
        {erro && (
          <Alert variant="destructive" role="alert">
            {erro}
          </Alert>
        )}
      </div>

      {secoes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {secoes.map((s, i) => {
            const aparece = visivel.get(s.id);
            return (
              <li key={s.id} className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
                {editando === s.id ? (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      rodar(`renomear-${s.id}`, () => renomearSecao(s.id, nomeEdicao), () => setEditando(null));
                    }}
                  >
                    <Campo rotulo="Nome da seção" name={`nome-${s.id}`} value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} maxLength={40} autoFocus />
                    <div className="flex flex-wrap gap-2">
                      <Botao type="submit" variante="secundario" icone={<Check />} carregando={emCurso === `renomear-${s.id}`} textoCarregando="Salvando..." disabled={pendente}>
                        Salvar nome
                      </Botao>
                      <Botao variante="texto" icone={<X />} onClick={() => setEditando(null)} disabled={pendente}>
                        Cancelar
                      </Botao>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <h2 className="text-lg font-bold break-words">{s.nome}</h2>
                      <p className="text-sm text-texto-suave">
                        {s.anuncios.length === 0 ? "Nenhum produto ainda" : s.anuncios.length === 1 ? "1 produto" : `${s.anuncios.length} produtos`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-legenda font-bold ${
                        aparece ? "bg-sucesso-fundo text-verde-escuro" : "bg-fundo text-texto-suave"
                      }`}
                    >
                      {aparece ? "Aparece na vitrine" : s.ativa ? "Escondida (passa do plano)" : "Escondida"}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Link
                    href={`${LINK_LOJA_SECOES}/${s.id}`}
                    className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-card border border-beringela bg-cartao px-4 text-base font-semibold hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
                  >
                    <ListChecks className="size-5" aria-hidden /> Escolher produtos
                  </Link>
                  <Botao
                    variante="secundario"
                    icone={<ArrowUp />}
                    className="px-3"
                    aria-label={`Subir a seção ${s.nome}`}
                    disabled={pendente || i === 0}
                    carregando={emCurso === `subir-${s.id}`}
                    onClick={() => rodar(`subir-${s.id}`, () => moverSecao(s.id, "subir"))}
                  >
                    Subir
                  </Botao>
                  <Botao
                    variante="secundario"
                    icone={<ArrowDown />}
                    className="px-3"
                    aria-label={`Descer a seção ${s.nome}`}
                    disabled={pendente || i === secoes.length - 1}
                    carregando={emCurso === `descer-${s.id}`}
                    onClick={() => rodar(`descer-${s.id}`, () => moverSecao(s.id, "descer"))}
                  >
                    Descer
                  </Botao>
                  <Botao
                    variante="secundario"
                    icone={s.ativa ? <EyeOff /> : <Eye />}
                    className="px-3"
                    disabled={pendente}
                    carregando={emCurso === `mostrar-${s.id}`}
                    onClick={() => rodar(`mostrar-${s.id}`, () => mostrarSecao(s.id, !s.ativa))}
                  >
                    {s.ativa ? "Esconder" : "Mostrar"}
                  </Botao>
                  <Botao
                    variante="secundario"
                    icone={<Pencil />}
                    className="px-3"
                    disabled={pendente}
                    onClick={() => {
                      setEditando(s.id);
                      setNomeEdicao(s.nome);
                    }}
                  >
                    Renomear
                  </Botao>
                  <Botao
                    variante="perigo"
                    icone={<Trash2 />}
                    className="col-span-2 px-3"
                    disabled={pendente}
                    onClick={() => {
                      setApagar(s);
                      setErro(null);
                      dialogo.current?.showModal();
                    }}
                  >
                    Apagar
                  </Botao>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-apagar-secao"
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-folha bg-cartao p-5 text-texto shadow-2 backdrop:bg-beringela/50"
      >
        <h2 id="titulo-apagar-secao" className="text-xl font-semibold">
          Apagar a seção {apagar ? `"${apagar.nome}"` : ""}?
        </h2>
        <p className="mt-1 text-base text-texto-suave">Os produtos continuam na loja. Só a seção some. Para só tirar da vitrine por um tempo, use &quot;Esconder&quot;.</p>
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
            carregando={emCurso === "apagar"}
            textoCarregando="Apagando..."
            disabled={pendente}
            onClick={() => apagar && rodar("apagar", () => apagarSecao(apagar.id), () => dialogo.current?.close())}
          >
            Sim, apagar
          </Botao>
          <Botao variante="secundario" larguraTotal disabled={pendente} onClick={() => dialogo.current?.close()}>
            Não, manter
          </Botao>
        </div>
      </dialog>
    </div>
  );
}
