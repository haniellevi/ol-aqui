"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SEM_SUGESTOES, termoSugestao, totalSugestoes, type Sugestao, type SugestoesBusca } from "@/lib/sugestoes-busca";

// Campo "O que você procura?" que mostra categorias, lojas e anúncios enquanto a pessoa digita.
// Setas e Enter escolhem; Esc ou sair do campo fecha; Enter sem escolha envia a busca normal (o formulário).
// Mesmo jeito de lista do campo de escolha do painel (components/admin/campo-busca.tsx).

const PAUSA_MS = 150;
const GRUPOS = [
  { chave: "categorias", rotulo: "Categorias" },
  { chave: "lojas", rotulo: "Lojas" },
  { chave: "anuncios", rotulo: "Anúncios" },
] as const;

export function EntradaComSugestoes({
  id,
  valor,
  autoFocus,
  className,
  placeholder = "Ex.: moto, geladeira, casa",
}: {
  id: string;
  valor: string;
  autoFocus: boolean;
  className: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const lista = useId();
  const [texto, setTexto] = useState(valor);
  // guarda junto o texto que pediu as sugestões: resultado de um texto antigo nunca aparece
  const [resposta, setResposta] = useState<{ chave: string; dados: SugestoesBusca }>({ chave: "", dados: SEM_SUGESTOES });
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const guardadas = useRef(new Map<string, SugestoesBusca>());

  const termo = termoSugestao(texto);
  const chaveAtual = termo.toLowerCase();
  const sugestoes = termo && resposta.chave === chaveAtual ? resposta.dados : SEM_SUGESTOES;
  const opcoes: Sugestao[] = [...sugestoes.categorias, ...sugestoes.lojas, ...sugestoes.anuncios];
  const visivel = aberto && opcoes.length > 0;

  useEffect(() => {
    if (!termo) return;
    const chave = termo.toLowerCase();
    const ja = guardadas.current.get(chave);
    if (ja) {
      setResposta({ chave, dados: ja });
      return;
    }
    const parar = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca/sugestoes?q=${encodeURIComponent(termo)}`, { signal: parar.signal });
        if (!r.ok) throw new Error();
        const s = (await r.json()) as SugestoesBusca;
        guardadas.current.set(chave, s);
        setResposta({ chave, dados: s });
      } catch {
        // sem sugestões (a busca normal com Enter continua funcionando); pedido cancelado não mexe em nada
        if (!parar.signal.aborted) setResposta({ chave, dados: SEM_SUGESTOES });
      }
    }, PAUSA_MS);
    return () => {
      clearTimeout(espera);
      parar.abort();
    };
  }, [termo]);

  function ir(s: Sugestao) {
    setAberto(false);
    router.push(s.href);
  }

  function mover(passo: number) {
    if (!opcoes.length) return;
    setAberto(true);
    setAtivo((a) => (a < 0 ? (passo > 0 ? 0 : opcoes.length - 1) : (a + passo + opcoes.length) % opcoes.length));
  }

  useEffect(() => {
    if (visivel && ativo >= 0) document.getElementById(`${lista}-${ativo}`)?.scrollIntoView({ block: "nearest" });
  }, [visivel, ativo, lista]);

  let posicao = 0;
  return (
    <>
      <input
        id={id}
        type="search"
        name="q"
        value={texto}
        placeholder={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        maxLength={120}
        autoFocus={autoFocus}
        className={className}
        role="combobox"
        aria-expanded={visivel}
        aria-controls={lista}
        aria-autocomplete="list"
        aria-activedescendant={visivel && ativo >= 0 ? `${lista}-${ativo}` : undefined}
        onChange={(e) => {
          setTexto(e.target.value);
          setAtivo(-1);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            mover(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            mover(-1);
          } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            // com uma sugestão marcada, vai direto para ela; sem marcar, o formulário faz a busca normal
            if (visivel && opcoes[ativo]) {
              e.preventDefault();
              ir(opcoes[ativo]);
            }
          } else if (e.key === "Escape" && visivel) {
            e.preventDefault(); // fecha a lista sem apagar o que foi digitado
            setAberto(false);
            setAtivo(-1);
          }
        }}
      />
      <ul
        id={lista}
        role="listbox"
        aria-label="Sugestões"
        hidden={!visivel}
        className="absolute top-full right-0 left-0 z-20 mt-1 max-h-[min(28rem,70vh)] overflow-y-auto rounded-campo border border-borda bg-cartao py-1 shadow-1"
      >
        {GRUPOS.map(({ chave, rotulo }) => {
          const itens = sugestoes[chave];
          if (!itens.length) return null;
          return (
            <li key={chave} role="presentation">
              <div id={`${lista}-${chave}`} className="px-3 pt-2 pb-1 text-legenda font-semibold text-texto-suave">
                {rotulo}
              </div>
              <ul role="group" aria-labelledby={`${lista}-${chave}`}>
                {itens.map((s) => {
                  const i = posicao++;
                  return (
                    <li
                      key={s.href}
                      id={`${lista}-${i}`}
                      role="option"
                      aria-selected={i === ativo}
                      onMouseDown={(e) => {
                        e.preventDefault(); // não tira o foco do campo antes de escolher
                        ir(s);
                      }}
                      onMouseEnter={() => setAtivo(i)}
                      className={`min-h-10 cursor-pointer px-3 py-2 text-base text-beringela ${i === ativo ? "bg-selecao" : ""}`}
                    >
                      <span className="block [overflow-wrap:anywhere]">{s.nome}</span>
                      {s.detalhe && <span className="block text-legenda text-texto-suave">{s.detalhe}</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
      <span className="sr-only" role="status" aria-live="polite">
        {visivel ? `${totalSugestoes(sugestoes)} sugestões. Use as setas para escolher.` : ""}
      </span>
    </>
  );
}
