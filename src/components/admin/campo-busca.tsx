"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estiloCampo } from "@/components/admin/ui";

// Campo de escolha com filtro: a pessoa digita algumas letras e a lista encolhe na hora.
// Não aceita valor fora da lista. O valor escolhido vai no formulário por um campo escondido.

export type OpcaoBusca = { valor: string; nome: string; detalhe?: string };

const MAX_NA_TELA = 80;

/** Minúsculas e sem acento: "Produção" acha "producao". */
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CampoBusca({
  nome,
  opcoes,
  valorInicial = "",
  placeholder = "Digite para filtrar",
  onEscolher,
  desativado = false,
  rotulo,
}: {
  /** Nome do campo no formulário (fica escondido). Sem nome, só avisa por onEscolher. */
  nome?: string;
  opcoes: OpcaoBusca[];
  valorInicial?: string;
  placeholder?: string;
  onEscolher?: (valor: string) => void;
  desativado?: boolean;
  /** Texto para leitores de tela quando não há <label> em volta. */
  rotulo?: string;
}) {
  const id = useId();
  const [valor, setValor] = useState(valorInicial);
  const [texto, setTexto] = useState(() => opcoes.find((o) => o.valor === valorInicial)?.nome ?? "");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);

  const escolhida = opcoes.find((o) => o.valor === valor);
  // enquanto o texto é o nome da opção escolhida, mostra a lista toda
  const filtro = escolhida && texto === escolhida.nome ? "" : normal(texto.trim());
  const filtradas = useMemo(() => {
    if (!filtro) return opcoes;
    const partes = filtro.split(/\s+/);
    return opcoes.filter((o) => {
      const alvo = normal(`${o.nome} ${o.valor} ${o.detalhe ?? ""}`);
      return partes.every((p) => alvo.includes(p));
    });
  }, [opcoes, filtro]);
  const visiveis = filtradas.slice(0, MAX_NA_TELA);

  function escolher(o: OpcaoBusca) {
    setValor(o.valor);
    setTexto(o.nome);
    setAberto(false);
    onEscolher?.(o.valor);
  }

  function mover(passo: number) {
    if (!visiveis.length) return;
    const novo = (ativo + passo + visiveis.length) % visiveis.length;
    setAtivo(novo);
    lista.current?.children[novo]?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="relative">
      {nome && <input type="hidden" name={nome} value={valor} />}
      <input
        type="text"
        role="combobox"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={aberto && visiveis[ativo] ? `${id}-${ativo}` : undefined}
        autoComplete="off"
        disabled={desativado}
        value={texto}
        placeholder={placeholder}
        className={estiloCampo}
        onFocus={(e) => {
          e.currentTarget.select();
          setAberto(true);
        }}
        onChange={(e) => {
          setTexto(e.target.value);
          setAtivo(0);
          setAberto(true);
        }}
        onBlur={() => {
          // ao sair do campo sem escolher, volta a mostrar a opção que já estava escolhida
          setTimeout(() => {
            setAberto(false);
            setTexto(escolhida?.nome ?? "");
          }, 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!aberto) setAberto(true);
            else mover(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            mover(-1);
          } else if (e.key === "Enter") {
            if (aberto && visiveis[ativo]) {
              e.preventDefault();
              escolher(visiveis[ativo]);
            }
          } else if (e.key === "Escape") {
            setAberto(false);
          }
        }}
      />
      {aberto && !desativado && (
        <ul
          ref={lista}
          id={`${id}-lista`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-campo border border-borda bg-cartao py-1 shadow-1"
        >
          {visiveis.length === 0 && <li className="px-3 py-3 text-sm text-texto-suave">Nada encontrado com “{texto}”.</li>}
          {visiveis.map((o, i) => (
            <li
              key={o.valor}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.valor === valor}
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(o);
              }}
              onMouseEnter={() => setAtivo(i)}
              className={`min-h-12 cursor-pointer px-3 py-2 text-base text-beringela ${i === ativo ? "bg-selecao" : ""} ${
                o.valor === valor ? "font-semibold" : ""
              }`}
            >
              <span className="block">{o.nome}</span>
              {o.detalhe && <span className="block text-[13px] text-texto-suave">{o.detalhe}</span>}
            </li>
          ))}
          {filtradas.length > MAX_NA_TELA && (
            <li className="px-3 py-2 text-[13px] text-texto-suave">
              Mostrando {MAX_NA_TELA} de {filtradas.length}. Digite mais letras para achar o seu.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
