"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Aviso, estiloBotao, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { Markdown } from "@/components/paginas/markdown";
import { contarMudancas, diffLinhas, type LinhaDiff } from "@/lib/diff-linhas";
import { NOME_DOCUMENTO, type DocumentoLegal, type TipoDocumento } from "@/lib/tipos-paginas";
import { marcarRevisado, publicarDocumento } from "./actions";

// Publicar uma versão nova dos termos ou da privacidade: edita o texto, confere a diferença com a
// versão no ar (linha a linha) e a prévia, e confirma. A versão anterior continua guardada e pública.

const rotulo = "block text-sm font-semibold text-beringela";

function Diferencas({ linhas }: { linhas: LinhaDiff[] }) {
  // mostra só o que mudou e 2 linhas iguais de cada lado (o resto vira "…")
  const mostrar = linhas.map((l, i) => l.tipo !== "igual" || linhas.slice(Math.max(0, i - 2), i + 3).some((x) => x.tipo !== "igual"));
  const saida: React.ReactNode[] = [];
  let pulou = false;
  linhas.forEach((l, i) => {
    if (!mostrar[i]) {
      if (!pulou) saida.push(<li key={`p${i}`} className="px-3 text-texto-suave">…</li>);
      pulou = true;
      return;
    }
    pulou = false;
    const cor = l.tipo === "mais" ? "bg-sucesso-fundo text-verde-escuro" : l.tipo === "menos" ? "bg-perigo-fundo text-perigo line-through" : "text-texto-suave";
    const sinal = l.tipo === "mais" ? "+ " : l.tipo === "menos" ? "− " : "  ";
    saida.push(
      <li key={i} className={`whitespace-pre-wrap break-words px-3 ${cor}`}>
        <span aria-hidden>{sinal}</span>
        <span className="sr-only">{l.tipo === "mais" ? "Entrou: " : l.tipo === "menos" ? "Saiu: " : ""}</span>
        {l.texto || " "}
      </li>,
    );
  });
  return <ol className="max-h-[28rem] overflow-y-auto rounded-card border border-borda bg-cartao py-2 font-mono text-[13px] leading-5">{saida}</ol>;
}

export function PublicarDocumento({ tipo, atual }: { tipo: TipoDocumento; atual: DocumentoLegal | null }) {
  const [estado, acao, pendente] = useActionState(publicarDocumento, null);
  const [titulo, setTitulo] = useState(atual?.titulo ?? NOME_DOCUMENTO[tipo]);
  const [conteudo, setConteudo] = useState(atual?.conteudo ?? "");
  const [ver, setVer] = useState<"nada" | "diferencas" | "previa">("nada");
  const [confirmar, setConfirmar] = useState(false);

  const linhas = useMemo(() => (ver === "diferencas" || confirmar ? diffLinhas(atual?.conteudo ?? "", conteudo) : []), [ver, confirmar, atual?.conteudo, conteudo]);
  const mudancas = contarMudancas(linhas);
  const igual = !!atual && atual.conteudo.trim() === conteudo.trim() && atual.titulo.trim() === titulo.trim();
  const proxima = (atual?.versao ?? 0) + 1;

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="tipo" value={tipo} />
      <div>
        <label htmlFor={`titulo-${tipo}`} className={rotulo}>
          Título
        </label>
        <input id={`titulo-${tipo}`} name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} required className={estiloCampo} />
      </div>
      <div>
        <label htmlFor={`texto-${tipo}`} className={rotulo}>
          Texto (versão {proxima})
        </label>
        <textarea
          id={`texto-${tipo}`}
          name="conteudo"
          value={conteudo}
          onChange={(e) => {
            setConteudo(e.target.value);
            setConfirmar(false);
          }}
          rows={18}
          maxLength={100000}
          required
          className={`${estiloCampo} h-auto py-2 font-mono text-[15px] leading-6`}
        />
        <p className="mt-1 text-[13px] text-texto-suave">
          ## para título de seção, &quot;- &quot; para lista, **negrito**, [texto](/endereco) para link. HTML não funciona.
        </p>
      </div>
      <div>
        <label htmlFor={`resumo-${tipo}`} className={rotulo}>
          O que mudou (aparece no aviso para as pessoas)
        </label>
        <input id={`resumo-${tipo}`} name="resumo" maxLength={500} placeholder="Ex.: Explicamos melhor como apagar a conta." className={estiloCampo} />
      </div>
      <label className="flex min-h-12 items-center gap-3 text-base text-beringela">
        <input type="checkbox" name="revisado" className="size-5 accent-laranja-escuro" />
        <span>
          Um advogado revisou este texto
          <span className="block text-[13px] text-texto-suave">Deixe desmarcado se ninguém revisou: a versão fica marcada como RASCUNHO no painel.</span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={estiloBotaoSec} aria-pressed={ver === "diferencas"} onClick={() => setVer((v) => (v === "diferencas" ? "nada" : "diferencas"))}>
          {ver === "diferencas" ? "Esconder diferenças" : "Ver diferenças"}
        </button>
        <button type="button" className={estiloBotaoSec} aria-pressed={ver === "previa"} onClick={() => setVer((v) => (v === "previa" ? "nada" : "previa"))}>
          {ver === "previa" ? "Esconder prévia" : "Ver como fica"}
        </button>
      </div>

      {(ver === "diferencas" || confirmar) && (
        <div className="space-y-2">
          <p className="text-sm text-texto-suave">
            Comparado com a versão {atual?.versao ?? "—"}: {mudancas.mais} {mudancas.mais === 1 ? "linha entrou" : "linhas entraram"}, {mudancas.menos}{" "}
            {mudancas.menos === 1 ? "linha saiu" : "linhas saíram"}.
          </p>
          {mudancas.mais + mudancas.menos > 0 && <Diferencas linhas={linhas} />}
        </div>
      )}
      {ver === "previa" && (
        <div className="rounded-card border border-borda bg-fundo p-4">
          <p className="mb-2 text-[13px] font-semibold uppercase text-texto-suave">Prévia</p>
          <h3 className="mb-2 text-[22px] font-semibold leading-7">{titulo}</h3>
          <Markdown texto={conteudo || "(vazio)"} />
        </div>
      )}

      {igual && <p className="text-sm text-texto-suave">O texto está igual ao que está no ar. Mude alguma coisa para publicar.</p>}

      {!confirmar ? (
        <button type="button" disabled={igual || conteudo.trim().length < 50} className={estiloBotao} onClick={() => setConfirmar(true)}>
          Publicar versão {proxima}
        </button>
      ) : (
        <div className="space-y-3 rounded-card bg-aviso-fundo p-4">
          <p className="text-base text-aviso">
            A versão {proxima} entra no ar agora e a {atual?.versao ?? "anterior"} deixa de valer. Todo mundo que entrar vai ver o aviso para aceitar de novo.
            Confira as diferenças acima.
          </p>
          <div className="flex flex-wrap gap-2">
            <button disabled={pendente} className={estiloBotao}>
              {pendente && <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />}
              {pendente ? "Publicando…" : `Sim, publicar versão ${proxima}`}
            </button>
            <button type="button" disabled={pendente} className={estiloBotaoSec} onClick={() => setConfirmar(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </form>
  );
}

/** Liga/desliga o selo "revisado por advogado" da versão no ar. */
export function MarcarRevisado({ id, revisado }: { id: string; revisado: boolean }) {
  const [estado, acao, pendente] = useActionState(marcarRevisado, null);
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!revisado && !window.confirm("Confirma que um advogado revisou ESTA versão do texto?")) e.preventDefault();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="revisado" value={revisado ? "0" : "1"} />
      <button disabled={pendente} className={estiloBotaoSec}>
        {pendente && <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />}
        {pendente ? "Salvando…" : revisado ? "Voltar para RASCUNHO" : "Um advogado revisou esta versão"}
      </button>
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </form>
  );
}
