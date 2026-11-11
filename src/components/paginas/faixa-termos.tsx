"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { aceitarTermos } from "@/app/(publico)/termos/actions";
import { linkDocumentoLegal } from "@/lib/rotas";
import { NOME_DOCUMENTO, type AvisoTermos } from "@/lib/tipos-paginas";
import { Alert } from "@/components/ui/alert";

// Faixa "Atualizamos os termos": aparece para quem está logado e ainda não aceitou a versão no ar.
// Não bloqueia nada: Aceitar, ler cada texto ou "Agora não" (some até a próxima visita ao site).

const CHAVE = "olaki_termos_depois";

export function FaixaTermos({ aviso }: { aviso: AvisoTermos }) {
  const router = useRouter();
  const ids = aviso.pendentes.map((p) => p.id);
  const marca = ids.join(",");
  const [escondida, setEscondida] = useState(true); // só aparece depois de ler o "Agora não" guardado
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    let depois: string | null = null;
    try {
      depois = sessionStorage.getItem(CHAVE);
    } catch {
      depois = null;
    }
    setEscondida(depois === marca);
  }, [marca]);

  function agoraNao() {
    try {
      sessionStorage.setItem(CHAVE, marca);
    } catch {
      /* sem armazenamento: só esconde agora */
    }
    setEscondida(true);
  }

  async function aceitar() {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    const r = await aceitarTermos(ids).catch(() => ({ ok: false as const, erro: "Sem conexão agora. Tente de novo.", mudou: false }));
    setEnviando(false);
    if (r.ok) {
      setFeito(true);
      router.refresh();
      return;
    }
    setErro(r.mudou ? "Os textos mudaram agora mesmo. Leia a versão nova." : r.erro);
    if (r.mudou) router.refresh();
  }

  if (feito) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-3">
        <Alert variant="success" role="status">
          Pronto, obrigado!
        </Alert>
      </div>
    );
  }
  if (escondida) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-3">
      <section aria-labelledby="faixa-termos-titulo" className="relative flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4 pr-14">
        <button
          type="button"
          onClick={agoraNao}
          aria-label="Fechar o aviso dos termos por agora"
          className="absolute top-1 right-1 grid size-10 place-items-center text-beringela"
        >
          <X className="size-5" aria-hidden />
        </button>
        <div className="flex flex-col gap-1">
          <h2 id="faixa-termos-titulo" className="text-lg leading-6 font-semibold">
            {aviso.titulo}
          </h2>
          <p className="text-base">{aviso.texto}</p>
        </div>
        <ul className="flex flex-col gap-1">
          {aviso.pendentes.map((p) => (
            <li key={p.id} className="flex flex-col">
              <Link
                href={linkDocumentoLegal(p.tipo)}
                className="inline-flex min-h-10 items-center gap-2 text-base font-semibold text-laranja-escuro underline underline-offset-4"
              >
                <FileText className="size-5 shrink-0" aria-hidden />
                Ler {NOME_DOCUMENTO[p.tipo].toLowerCase()} (versão {p.versao})
              </Link>
              {!p.primeira_vez && p.resumo_mudancas && <span className="text-sm text-texto-suave">O que mudou: {p.resumo_mudancas}</span>}
            </li>
          ))}
        </ul>
        {erro && (
          <Alert variant="destructive" role="alert">
            {erro}
          </Alert>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* secundário: a faixa não disputa com o botão principal da tela */}
          <Botao variante="secundario" carregando={enviando} textoCarregando="Aceitando…" onClick={() => void aceitar()} className="sm:w-auto" larguraTotal>
            Aceitar
          </Botao>
          <Botao variante="texto" onClick={agoraNao} disabled={enviando}>
            Agora não
          </Botao>
        </div>
      </section>
    </div>
  );
}
