"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ImageOff, Sparkles } from "lucide-react";
import { decidirCategoria, decidirTodasCategorias, definirNicho } from "@/app/(conta)/minha-conta/loja/categorias/actions";
import type { Nicho, SugestaoCategoria, SugestaoNicho } from "@/lib/dados/categorias-ia";
import { Botao } from "@/components/ui/botao";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

// Vitrine com IA, etapa 4: a IA sugere, o lojista confirma com 1 toque.

/** Uma ação por vez; depois atualiza a página com o que o banco guardou. */
function useAcao() {
  const router = useRouter();
  const trava = useRef(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  function executar(acao: () => Promise<{ ok: true } | { ok: false; erro: { mensagem: string } }>, sucesso: string) {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      try {
        const r = await acao();
        if (!r.ok) setErro(r.erro.mensagem);
        else { setAviso(sucesso); router.refresh(); }
      } catch {
        setErro("A conexão falhou. Tente novamente; repetir a ação é seguro.");
      } finally {
        trava.current = false;
      }
    });
  }
  return { pendente, erro, aviso, executar };
}

function Mensagens({ erro, aviso }: { erro: string | null; aviso: string | null }) {
  return (
    <>
      <p role="status" className={aviso ? "rounded-campo bg-sucesso-fundo p-3 text-sm font-semibold text-verde-escuro" : "sr-only"}>{aviso}</p>
      {erro && <p role="alert" className="rounded-campo bg-perigo-fundo p-3 text-sm font-semibold text-perigo">{erro}</p>}
    </>
  );
}

export function EscolherNicho({ sugestao, nichos }: { sugestao: SugestaoNicho; nichos: Nicho[] }) {
  const { pendente, erro, aviso, executar } = useAcao();
  const id = useId();
  const [outro, setOutro] = useState(sugestao.nicho_id ?? "");
  const nomeDe = (nichoId: string) => nichos.find((n) => n.id === nichoId)?.nome ?? "o nicho escolhido";
  return (
    <div className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
      {sugestao.sugerido_id && sugestao.sugerido_nome ? (
        <>
          <p className="text-base">
            Pelos seus produtos, sua loja parece ser de <strong>{sugestao.sugerido_nome}</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao tamanho="pequeno" icone={<Check />} carregando={pendente} textoCarregando="Salvando..."
              onClick={() => executar(() => definirNicho(sugestao.sugerido_id), `Nicho salvo: ${sugestao.sugerido_nome}.`)}>
              Sim, é isso
            </Botao>
            <Botao tamanho="pequeno" variante="texto" disabled={pendente}
              onClick={() => executar(() => definirNicho(null), "Sugestão dispensada. Escolha o nicho na lista quando quiser.")}>
              Não é
            </Botao>
          </div>
        </>
      ) : (
        <p className="text-base">
          {sugestao.nicho_nome ? <>Nicho da loja: <strong>{sugestao.nicho_nome}</strong>.</> : "Escolha o nicho da sua loja. Ele ajuda os clientes a achar você."}
        </p>
      )}
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => { e.preventDefault(); if (outro) executar(() => definirNicho(outro), `Nicho salvo: ${nomeDe(outro)}.`); }}
      >
        <label htmlFor={id} className="flex flex-1 flex-col gap-1 text-sm font-semibold">
          {sugestao.nicho_nome || sugestao.sugerido_id ? "Escolher outro nicho" : "Nicho"}
          <NativeSelect id={id} value={outro} onChange={(e) => setOutro(e.target.value)} disabled={pendente}>
            <NativeSelectOption value="">Escolha da lista</NativeSelectOption>
            {nichos.map((n) => <NativeSelectOption key={n.id} value={n.id}>{n.nome}</NativeSelectOption>)}
          </NativeSelect>
        </label>
        <Botao type="submit" variante="secundario" disabled={pendente || !outro || outro === sugestao.nicho_id}>Salvar nicho</Botao>
      </form>
      <Mensagens erro={erro} aviso={aviso} />
    </div>
  );
}

export function RevisarCategorias({ itens }: { itens: SugestaoCategoria[] }) {
  const { pendente, erro, aviso, executar } = useAcao();
  return (
    <div className="flex flex-col gap-3">
      {itens.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-selecao p-4">
          <p className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
            {itens.length} sugestões da IA
          </p>
          <Botao icone={<Check />} disabled={pendente}
            onClick={() => executar(async () => {
              const r = await decidirTodasCategorias(true);
              return r.ok ? { ok: true } : r;
            }, "Categorias atualizadas.")}>
            Aceitar todas
          </Botao>
        </div>
      )}
      <Mensagens erro={erro} aviso={aviso} />
      <ul aria-label="Sugestões de categoria" className="flex flex-col gap-3" aria-busy={pendente || undefined}>
        {itens.map((s) => (
          <li key={s.anuncio_id} className="flex flex-col gap-3 rounded-card bg-cartao p-3 shadow-1">
            <div className="flex min-w-0 gap-3">
              {s.foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura do próprio anúncio
                <img src={s.foto} alt="" width={64} height={64} className="size-16 shrink-0 rounded-campo object-cover" />
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-campo bg-fundo text-texto-suave" aria-hidden><ImageOff className="size-6" /></span>
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-base font-semibold break-words">{s.titulo}</h3>
                <p className="flex flex-wrap items-center gap-1 text-sm text-texto-suave">
                  <span className="line-through decoration-texto-suave/60">{s.categoria_atual ?? "Sem categoria"}</span>
                  <ArrowRight className="size-4 shrink-0" aria-label="para" />
                  <strong className="text-texto">{s.sugerida}</strong>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Botao tamanho="pequeno" icone={<Check />} disabled={pendente} aria-label={`Aceitar ${s.sugerida} para ${s.titulo}`}
                onClick={() => executar(() => decidirCategoria(s.anuncio_id, true), `${s.titulo} agora está em ${s.sugerida}.`)}>
                Aceitar
              </Botao>
              <Botao tamanho="pequeno" variante="secundario" disabled={pendente} aria-label={`Manter a categoria atual de ${s.titulo}`}
                onClick={() => executar(() => decidirCategoria(s.anuncio_id, false), `${s.titulo} continua em ${s.categoria_atual ?? "sua categoria"}.`)}>
                Manter atual
              </Botao>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
