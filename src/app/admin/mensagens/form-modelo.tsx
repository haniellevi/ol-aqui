"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Aviso, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { classesBotao } from "@/components/ui/botao";
import { erroVariaveis, previa, variaveisInvalidas } from "@/lib/admin/mensagens";
import { CANAIS_ATIVOS, EXEMPLOS_VARIAVEIS, LIMITES_CANAL, type ModeloMensagem } from "@/lib/tipos-relatorios";
import { enviarSemLimpar } from "../textos/enviar-sem-limpar";
import { salvarModelo, voltarTextoOriginal } from "./actions";

// Formulário de um modelo (mensagem + canal): título, texto, ligado, botões das variáveis,
// prévia ao vivo com valores de exemplo e aviso na hora de variável que não existe.
// Botões com "Salvando…" e travados enquanto enviam (sem envio duplo).

const rotulo = "block text-sm font-semibold text-beringela";

function Girando() {
  return <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />;
}

export function FormModelo({ modelo }: { modelo: ModeloMensagem }) {
  const [estado, acao, pendente] = useActionState(salvarModelo, null);
  const [voltou, voltar, voltando] = useActionState(voltarTextoOriginal, null);
  const [titulo, setTitulo] = useState(modelo.titulo ?? "");
  const [texto, setTexto] = useState(modelo.texto);
  const [ultimoCampo, setUltimoCampo] = useState<"titulo" | "texto">("texto");
  const refTitulo = useRef<HTMLInputElement>(null);
  const refTexto = useRef<HTMLTextAreaElement>(null);
  const limites = LIMITES_CANAL[modelo.canal];
  const temTitulo = limites.titulo !== null;
  const nomeTitulo = modelo.canal === "email" ? "Assunto" : "Título";
  const enviaHoje = CANAIS_ATIVOS.includes(modelo.canal);
  const id = modelo.id;

  // Depois de salvar ou voltar ao original, o servidor manda o texto novo: os campos acompanham.
  useEffect(() => {
    setTitulo(modelo.titulo ?? "");
    setTexto(modelo.texto);
  }, [modelo.atualizado_em, modelo.titulo, modelo.texto]);

  const erroTitulo = temTitulo ? erroVariaveis("título", variaveisInvalidas(titulo, modelo.variaveis), modelo.variaveis) : null;
  const erroTexto = erroVariaveis("texto", variaveisInvalidas(texto, modelo.variaveis), modelo.variaveis);
  const igualOriginal = (modelo.titulo ?? "") === (modelo.titulo_padrao ?? "") && modelo.texto === modelo.texto_padrao;

  /** Põe {variável} onde está o cursor do último campo tocado. */
  function inserir(v: string) {
    const marca = `{${v}}`;
    const campo = ultimoCampo === "titulo" && temTitulo ? refTitulo.current : refTexto.current;
    const valor = ultimoCampo === "titulo" && temTitulo ? titulo : texto;
    const definir = ultimoCampo === "titulo" && temTitulo ? setTitulo : setTexto;
    const inicio = campo?.selectionStart ?? valor.length;
    const fim = campo?.selectionEnd ?? valor.length;
    const novo = valor.slice(0, inicio) + marca + valor.slice(fim);
    definir(novo);
    requestAnimationFrame(() => {
      campo?.focus();
      campo?.setSelectionRange(inicio + marca.length, inicio + marca.length);
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={enviarSemLimpar(acao)} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        {temTitulo && (
          <div>
            <label htmlFor={`tit-${id}`} className={rotulo}>
              {nomeTitulo}
            </label>
            <input
              ref={refTitulo}
              id={`tit-${id}`}
              name="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onFocus={() => setUltimoCampo("titulo")}
              maxLength={limites.titulo ?? undefined}
              required
              aria-invalid={erroTitulo ? true : undefined}
              aria-describedby={erroTitulo ? `tit-erro-${id}` : undefined}
              className={`${estiloCampo} ${erroTitulo ? "border-perigo" : ""}`}
            />
            {erroTitulo && (
              <p id={`tit-erro-${id}`} className="mt-1 text-sm text-perigo">
                {erroTitulo}
              </p>
            )}
          </div>
        )}
        <div>
          <label htmlFor={`txt-${id}`} className={rotulo}>
            Texto
          </label>
          <textarea
            ref={refTexto}
            id={`txt-${id}`}
            name="texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onFocus={() => setUltimoCampo("texto")}
            maxLength={limites.texto}
            rows={Math.min(10, Math.max(3, Math.ceil(texto.length / 60) + 1))}
            required
            aria-invalid={erroTexto ? true : undefined}
            aria-describedby={`txt-conta-${id}${erroTexto ? ` txt-erro-${id}` : ""}`}
            className={`${estiloCampo} h-auto py-2 ${erroTexto ? "border-perigo" : ""}`}
          />
          <p id={`txt-conta-${id}`} className="mt-1 text-[13px] text-texto-suave">
            {texto.length.toLocaleString("pt-BR")} de {limites.texto.toLocaleString("pt-BR")} letras
          </p>
          {erroTexto && (
            <p id={`txt-erro-${id}`} className="mt-1 text-sm text-perigo">
              {erroTexto}
            </p>
          )}
        </div>

        {modelo.variaveis.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-beringela">Toque para colocar no texto</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {modelo.variaveis.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => inserir(v)}
                  className="inline-flex min-h-12 flex-col items-start justify-center rounded-campo border border-borda bg-cartao px-3 text-left active:brightness-90"
                >
                  <span className="text-[15px] font-semibold text-beringela">{`{${v}}`}</span>
                  <span className="text-[13px] text-texto-suave">{EXEMPLOS_VARIAVEIS[v]?.explica ?? v}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex min-h-12 items-center gap-3 text-base text-beringela">
          <input type="checkbox" name="ativo" defaultChecked={modelo.ativo} key={`${modelo.atualizado_em}`} className="size-5 accent-laranja-escuro" />
          <span>
            {enviaHoje ? "Ligada (a mensagem é mandada)" : "Ligada (vai ser mandada quando o envio começar)"}
            <span className="block text-[13px] text-texto-suave">
              {enviaHoje ? "Desligada, ninguém recebe este aviso." : "Hoje nada é mandado por este canal."}
            </span>
          </span>
        </label>

        <div className="rounded-card border border-borda bg-fundo p-3" aria-live="polite">
          <p className="mb-2 text-[13px] font-semibold uppercase text-texto-suave">Prévia com exemplo</p>
          {modelo.canal === "whatsapp" ? (
            <p className="min-w-0 max-w-sm [overflow-wrap:anywhere] whitespace-pre-line rounded-card bg-sucesso-fundo px-3 py-2 text-base text-texto shadow-1">
              {previa(texto, modelo.variaveis) || "(vazio)"}
            </p>
          ) : (
            <div className="min-w-0 max-w-sm [overflow-wrap:anywhere] rounded-card bg-cartao px-3 py-2 shadow-1">
              <p className="text-base font-semibold text-beringela">
                {modelo.canal === "email" && <span className="font-normal text-texto-suave">Assunto: </span>}
                {previa(titulo, modelo.variaveis) || "(sem título)"}
              </p>
              <p className="mt-1 break-words text-sm text-texto">{previa(texto, modelo.variaveis) || "(vazio)"}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pendente || !!erroTitulo || !!erroTexto} className={estiloBotaoSec}>
            {pendente && <Girando />}
            {pendente ? "Salvando…" : "Salvar"}
          </button>
          {estado?.ok && (
            <span role="status" className="text-sm font-semibold text-verde-escuro">
              {estado.ok}
            </span>
          )}
        </div>
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      </form>

      {!igualOriginal && (
        <form
          action={voltar}
          onSubmit={(e) => {
            if (!window.confirm("Voltar para o texto original? O texto de agora fica guardado no histórico.")) e.preventDefault();
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="id" value={id} />
          <button disabled={voltando} className={classesBotao("texto")}>
            {voltando && <Girando />}
            {voltando ? "Voltando…" : "Voltar ao texto original"}
          </button>
          {voltou?.erro && <Aviso tipo="erro">{voltou.erro}</Aviso>}
        </form>
      )}
      {/* Fora do formulário: depois de voltar, o texto fica igual ao original e o botão some */}
      {igualOriginal && voltou?.ok && (
        <p role="status" className="text-sm font-semibold text-verde-escuro">
          {voltou.ok}
        </p>
      )}
    </div>
  );
}
