"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { Aviso, estiloBotao, estiloBotaoPerigo, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { Markdown } from "@/components/paginas/markdown";
import type { AjudaCategoria, AjudaPergunta, BlocoHome } from "@/lib/tipos-paginas";
import { enviarSemLimpar } from "./enviar-sem-limpar";
import { apagarCategoria, apagarPergunta, moverBloco, salvarBloco, salvarCategoria, salvarPergunta } from "./actions";

// Formulários da tela 12 (Página inicial e textos). Cada botão mostra "Salvando…" e trava
// enquanto envia (sem envio duplo). Os gatilhos do banco gravam cada mudança no histórico.

const rotulo = "block text-sm font-semibold text-beringela";

function Girando() {
  return <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />;
}

function Marcar({ nome, rotuloTexto, marcado, desligado, dica }: { nome: string; rotuloTexto: string; marcado: boolean; desligado?: boolean; dica?: string }) {
  return (
    <label className={`flex min-h-12 items-center gap-3 text-base text-beringela ${desligado ? "opacity-70" : ""}`}>
      <input type="checkbox" name={nome} defaultChecked={marcado} disabled={desligado} className="size-5 accent-laranja-escuro" />
      <span>
        {rotuloTexto}
        {dica && <span className="block text-[13px] text-texto-suave">{dica}</span>}
      </span>
    </label>
  );
}

/* ------------------------------- Ajuda -------------------------------- */

export function FormPergunta({ pergunta, categorias }: { pergunta?: AjudaPergunta; categorias: AjudaCategoria[] }) {
  const [estado, acao, pendente] = useActionState(salvarPergunta, null);
  const [apagado, apagar, apagando] = useActionState(apagarPergunta, null);
  const [resposta, setResposta] = useState(pergunta?.resposta ?? "");
  const [previa, setPrevia] = useState(false);
  const id = pergunta?.id ?? "nova";
  const ref = useRef<HTMLFormElement>(null);
  // pergunta nova: depois de criar, o formulário volta em branco (só quando deu certo)
  useEffect(() => {
    if (estado?.ok && !pergunta) {
      ref.current?.reset();
      setResposta("");
    }
  }, [estado, pergunta]);
  return (
    <div className="space-y-3">
      <form ref={ref} onSubmit={enviarSemLimpar(acao)} className="space-y-3">
        {pergunta && <input type="hidden" name="id" value={pergunta.id} />}
        <div>
          <label htmlFor={`cat-${id}`} className={rotulo}>
            Assunto
          </label>
          <select id={`cat-${id}`} name="categoria" defaultValue={pergunta?.categoria ?? categorias[0]?.slug ?? ""} className={estiloCampo}>
            {categorias.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nome}
                {c.ativa ? "" : " (escondido)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`perg-${id}`} className={rotulo}>
            Pergunta
          </label>
          <input id={`perg-${id}`} name="pergunta" defaultValue={pergunta?.pergunta ?? ""} maxLength={200} required className={estiloCampo} />
        </div>
        <div>
          <label htmlFor={`resp-${id}`} className={rotulo}>
            Resposta
          </label>
          <textarea
            id={`resp-${id}`}
            name="resposta"
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            maxLength={4000}
            rows={Math.min(14, Math.max(5, resposta.split("\n").length + 1))}
            required
            className={`${estiloCampo} h-auto py-2`}
          />
          <p className="mt-1 text-[13px] text-texto-suave">
            Frases curtas. **negrito**, lista com &quot;- &quot; no começo da linha, link assim: [Planos](/planos). HTML não funciona.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6">
          <div className="w-28">
            <label htmlFor={`ord-${id}`} className={rotulo}>
              Posição
            </label>
            <input id={`ord-${id}`} name="ordem" inputMode="numeric" defaultValue={pergunta?.ordem ?? 0} className={estiloCampo} />
          </div>
          <Marcar nome="ativo" rotuloTexto="Aparece na Ajuda" marcado={pergunta?.ativo ?? true} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pendente} className={pergunta ? estiloBotaoSec : estiloBotao}>
            {pendente && <Girando />}
            {pendente ? "Salvando…" : pergunta ? "Salvar" : "Criar pergunta"}
          </button>
          <button type="button" onClick={() => setPrevia((v) => !v)} className={estiloBotaoSec} aria-expanded={previa}>
            {previa ? "Esconder prévia" : "Ver como fica"}
          </button>
          {estado?.ok && <span className="text-sm font-semibold text-verde-escuro">{estado.ok}</span>}
        </div>
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      </form>
      {previa && (
        <div className="rounded-card border border-borda bg-fundo p-3">
          <p className="mb-2 text-[13px] font-semibold uppercase text-texto-suave">Prévia</p>
          <Markdown texto={resposta || "(vazio)"} />
        </div>
      )}
      {pergunta && (
        <form
          action={apagar}
          onSubmit={(e) => {
            if (!window.confirm("Apagar esta pergunta da Ajuda? Para só esconder, desmarque \"Aparece na Ajuda\".")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={pergunta.id} />
          <button disabled={apagando} className={estiloBotaoPerigo}>
            {apagando && <Girando />}
            {apagando ? "Apagando…" : "Apagar pergunta"}
          </button>
          {apagado?.erro && <Aviso tipo="erro">{apagado.erro}</Aviso>}
        </form>
      )}
    </div>
  );
}

export function FormCategoria({ categoria, quantas }: { categoria?: AjudaCategoria; quantas?: number }) {
  const [estado, acao, pendente] = useActionState(salvarCategoria, null);
  const [apagado, apagar, apagando] = useActionState(apagarCategoria, null);
  const id = categoria?.slug ?? "novo";
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok && !categoria) ref.current?.reset();
  }, [estado, categoria]);
  return (
    <div className="space-y-3">
      <form ref={ref} onSubmit={enviarSemLimpar(acao)} className="space-y-3">
        {categoria && <input type="hidden" name="original" value={categoria.slug} />}
        <div>
          <label htmlFor={`cnome-${id}`} className={rotulo}>
            Nome do assunto
          </label>
          <input id={`cnome-${id}`} name="nome" defaultValue={categoria?.nome ?? ""} maxLength={60} required className={estiloCampo} />
        </div>
        <div>
          <label htmlFor={`cdesc-${id}`} className={rotulo}>
            Frase curta (opcional)
          </label>
          <input id={`cdesc-${id}`} name="descricao" defaultValue={categoria?.descricao ?? ""} maxLength={160} className={estiloCampo} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6">
          <div className="w-28">
            <label htmlFor={`cord-${id}`} className={rotulo}>
              Posição
            </label>
            <input id={`cord-${id}`} name="ordem" inputMode="numeric" defaultValue={categoria?.ordem ?? 0} className={estiloCampo} />
          </div>
          <Marcar nome="ativa" rotuloTexto="Aparece na Ajuda" marcado={categoria?.ativa ?? true} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pendente} className={estiloBotaoSec}>
            {pendente && <Girando />}
            {pendente ? "Salvando…" : categoria ? "Salvar assunto" : "Criar assunto"}
          </button>
          {estado?.ok && <span className="text-sm font-semibold text-verde-escuro">{estado.ok}</span>}
        </div>
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      </form>
      {categoria && (
        <form
          action={apagar}
          onSubmit={(e) => {
            if (!window.confirm(`Apagar o assunto "${categoria.nome}"?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="slug" value={categoria.slug} />
          <button disabled={apagando || (quantas ?? 0) > 0} className={estiloBotaoPerigo} title={(quantas ?? 0) > 0 ? "Tem perguntas neste assunto" : undefined}>
            {apagando && <Girando />}
            {apagando ? "Apagando…" : "Apagar assunto"}
          </button>
          {(quantas ?? 0) > 0 && <p className="mt-1 text-[13px] text-texto-suave">Só dá para apagar assunto sem perguntas.</p>}
          {apagado?.erro && <Aviso tipo="erro">{apagado.erro}</Aviso>}
        </form>
      )}
    </div>
  );
}

/* ---------------------------- Página inicial ----------------------------- */

const NOMES_CAMPO = { titulo: "Título", texto: "Texto", botao: "Texto do botão" } as const;
// nome do campo quando ele quer dizer outra coisa naquele bloco
const NOMES_CAMPO_BLOCO: Partial<Record<BlocoHome["chave"], Partial<Record<keyof typeof NOMES_CAMPO, string>>>> = {
  recentes: { texto: "Frase quando ainda não tem anúncio" },
};
const MAX_CAMPO = { titulo: 80, texto: 200, botao: 30 } as const;

export function FormBloco({ bloco }: { bloco: BlocoHome }) {
  const [estado, acao, pendente] = useActionState(salvarBloco, null);
  return (
    <form onSubmit={enviarSemLimpar(acao)} className="space-y-3">
      <input type="hidden" name="chave" value={bloco.chave} />
      {/* bloco que não desliga: o campo vai marcado (o navegador não envia checkbox desativado) */}
      {!bloco.pode_desligar && <input type="hidden" name="ativo" value="on" />}
      <Marcar
        nome="ativo"
        rotuloTexto="Aparece na página inicial"
        marcado={bloco.ativo}
        desligado={!bloco.pode_desligar}
        dica={!bloco.pode_desligar ? "Este não desliga: tem anúncios pagos ou é a lista principal. Só muda de lugar." : undefined}
      />
      {bloco.campos.map((c) => (
        <div key={c}>
          <label htmlFor={`${bloco.chave}-${c}`} className={rotulo}>
            {NOMES_CAMPO_BLOCO[bloco.chave]?.[c] ?? NOMES_CAMPO[c]}
          </label>
          <input id={`${bloco.chave}-${c}`} name={c} defaultValue={bloco[c] ?? ""} maxLength={MAX_CAMPO[c]} className={estiloCampo} />
        </div>
      ))}
      {bloco.campos.includes("titulo") && <p className="text-[13px] text-texto-suave">Use {"{lugar}"} para mostrar a cidade ou região da pessoa.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pendente} className={estiloBotaoSec}>
          {pendente && <Girando />}
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        {estado?.ok && <span className="text-sm font-semibold text-verde-escuro">{estado.ok}</span>}
      </div>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </form>
  );
}

export function MoverBloco({ chave, primeiro, ultimo }: { chave: string; primeiro: boolean; ultimo: boolean }) {
  const [estado, acao, pendente] = useActionState(moverBloco, null);
  return (
    <form onSubmit={enviarSemLimpar(acao)} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="chave" value={chave} />
      <button
        name="direcao"
        value="subir"
        disabled={pendente || primeiro}
        className="flex h-12 items-center gap-1 rounded-campo border border-borda bg-cartao px-3 text-sm font-semibold text-beringela disabled:opacity-40"
      >
        <ArrowUp className="size-4" aria-hidden /> Subir
      </button>
      <button
        name="direcao"
        value="descer"
        disabled={pendente || ultimo}
        className="flex h-12 items-center gap-1 rounded-campo border border-borda bg-cartao px-3 text-sm font-semibold text-beringela disabled:opacity-40"
      >
        <ArrowDown className="size-4" aria-hidden /> Descer
      </button>
      {pendente && <Girando />}
      {estado?.erro && (
        <span role="alert" className="basis-full text-sm text-perigo">
          {estado.erro}
        </span>
      )}
    </form>
  );
}
