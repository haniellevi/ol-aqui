"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Ellipsis, Pause, Pencil, Play, Sparkles, Trash2, ArrowRight, RotateCcw } from "lucide-react";
import { linkDestacar } from "@/lib/rotas";
import { Botao, classesBotao } from "@/components/ui/botao";
import { marcarVendido, moverParaLixeira, pausarAnuncio, reativarAnuncio, restaurarAnuncio } from "@/app/(conta)/minha-conta/anuncios/actions";
import { abaDoStatus } from "./situacao-anuncios";
import type { Resultado, StatusAnuncio } from "@/lib/tipos";

type Acao = "pausar" | "reativar" | "vendido-sim" | "vendido-nao" | "excluir" | "restaurar";
type Confirmacao = "pausar" | "vendido" | "excluir";

// Plano de design: no card ficam à vista só a ação do momento e Editar (botões pequenos).
// O resto (pausar, destacar, fixar, lixeira) fica no menu "Mais".
const ITEM_MENU =
  "olaki-acao flex min-h-10 w-full items-center gap-2 rounded-campo px-3 text-left text-sm font-semibold text-beringela hover:bg-fundo " +
  "focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro disabled:opacity-60 [&>svg]:size-4 [&>svg]:shrink-0";

export function AcoesAnuncio({ id, status, titulo, temPagamento = false, maisAcoes }: {
  id: string; status: StatusAnuncio; titulo: string; temPagamento?: boolean;
  /** Ações extras que entram no menu "Mais" (ex.: fixar no topo da loja). */
  maisAcoes?: ReactNode;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const trava = useRef(false);
  const [emCurso, setEmCurso] = useState<Acao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(false);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const ocupado = pendente || emCurso !== null;
  const editar = `/anunciar/detalhes?rascunho=${id}&editar=1`;
  const menu = useRef<HTMLDetailsElement>(null);

  function abrir(tipo: Confirmacao) {
    if (menu.current) menu.current.open = false;
    setErro(null);
    setConfirmacao(tipo);
    dialogo.current?.showModal();
    cancelar.current?.focus();
  }

  function rodar(acao: Acao, fn: () => Promise<Resultado<StatusAnuncio>>) {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    setSessaoExpirada(false);
    setRecarregar(false);
    setEmCurso(acao);
    iniciar(async () => {
      try {
        const r = await fn();
        if (!r.ok) {
          setErro(r.erro.mensagem);
          setSessaoExpirada(r.erro.codigo === "28000");
          setRecarregar(r.erro.codigo === "alteracao_incerta");
          return;
        }
        dialogo.current?.close();
        const restaurando = acao === "restaurar";
        const resultado = restaurando ? "restaurado" : r.dados;
        const aba = restaurando ? "lixeira" : abaDoStatus(r.dados);
        router.replace(`/minha-conta/anuncios?aba=${aba}&resultado=${resultado}&anuncio=${id}`, { scroll: !restaurando });
      } catch {
        setErro(navigator.onLine
          ? "Não foi possível confirmar a alteração. Atualize a página para conferir a situação do anúncio."
          : "Você está sem internet. Reconecte-se e atualize a página para conferir a situação do anúncio.");
        setRecarregar(true);
      } finally {
        trava.current = false;
        setEmCurso(null);
      }
    });
  }

  const mensagemErro = erro && (
    <div role="alert" className="rounded-card bg-perigo-fundo p-3 text-sm font-semibold text-perigo">
      <p>{erro}</p>
      {sessaoExpirada && <Botao href="/entrar?redirect_url=%2Fminha-conta%2Fanuncios" variante="texto">Entrar novamente</Botao>}
      {recarregar && <Botao variante="texto" onClick={() => window.location.reload()}>Atualizar página</Botao>}
    </div>
  );

  return (
    <div className="flex flex-col gap-2" aria-label={`Ações de ${titulo}`}>
      <div className="flex flex-wrap items-center gap-2">
        {status === "excluido" ? (
          <Botao tamanho="pequeno" icone={<RotateCcw />} disabled={ocupado} carregando={emCurso === "restaurar"} textoCarregando="Restaurando..." onClick={() => rodar("restaurar", () => restaurarAnuncio(id))}>Restaurar anúncio</Botao>
        ) : (
          <>
            {status === "rascunho" && <Botao tamanho="pequeno" href={`/anunciar/fotos?rascunho=${id}`} icone={<ArrowRight />} carregando={ocupado}>Continuar rascunho</Botao>}
            {status === "ativo" && <Botao tamanho="pequeno" icone={<CheckCircle2 />} disabled={ocupado} onClick={() => abrir("vendido")}>Vendi</Botao>}
            {(status === "pausado" || status === "expirado") && <Botao tamanho="pequeno" icone={<Play />} disabled={ocupado} carregando={emCurso === "reativar"} textoCarregando="Reativando..." onClick={() => rodar("reativar", () => reativarAnuncio(id))}>Reativar</Botao>}
            {["ativo", "pausado", "expirado"].includes(status) && <Botao tamanho="pequeno" href={editar} variante="secundario" icone={<Pencil />} carregando={ocupado}>Editar</Botao>}
            <details ref={menu} className="group relative">
              <summary className={classesBotao("secundario", false, "list-none cursor-pointer [&::-webkit-details-marker]:hidden", "pequeno")} aria-label={`Mais ações de ${titulo}`}>
                <Ellipsis className="size-4" aria-hidden /> Mais
              </summary>
              <div className="absolute right-0 z-20 mt-1 flex w-56 flex-col gap-0.5 rounded-card border border-borda bg-cartao p-1 shadow-2">
                {status === "ativo" && <button type="button" className={ITEM_MENU} disabled={ocupado} onClick={() => abrir("pausar")}><Pause aria-hidden />Pausar</button>}
                {status === "ativo" && <Link href={linkDestacar(id)} className={ITEM_MENU}><Sparkles aria-hidden />Destacar</Link>}
                {maisAcoes}
                <button type="button" className={`${ITEM_MENU} text-perigo`} disabled={ocupado} onClick={() => abrir("excluir")}><Trash2 aria-hidden />Mover para lixeira</button>
              </div>
            </details>
          </>
        )}
      </div>
      {!confirmacao && mensagemErro}
      <dialog ref={dialogo} role="alertdialog" aria-labelledby={`confirmar-${id}`} aria-describedby={`explicacao-${id}`}
        onClose={() => setConfirmacao(null)} onCancel={(e) => { if (trava.current) e.preventDefault(); }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-folha bg-cartao p-5 text-texto shadow-2 backdrop:bg-beringela/50">
        <h2 id={`confirmar-${id}`} className="text-xl font-semibold">
          {confirmacao === "excluir" ? "Mover para a lixeira?" : confirmacao === "pausar" ? "Pausar este anúncio?" : "Vendeu pelo OLAKI?"}
        </h2>
        <p className="mt-2 break-words font-semibold">{titulo}</p>
        <p id={`explicacao-${id}`} className="mt-2 text-base text-texto-suave">
          {confirmacao === "excluir" ? "O anúncio ficará oculto. As fotos e o histórico serão guardados, e você poderá restaurá-lo na aba Lixeira."
            : confirmacao === "pausar" ? "O anúncio sai da busca e o contato fica indisponível. Você pode reativá-lo quando quiser."
              : "O anúncio sai da busca e quem tiver o link verá Vendido, sem o botão de contato. Essa venda não pode ser desfeita por aqui."}
        </p>
        {temPagamento && <p className="mt-2 text-sm text-texto-suave">Esta ação não cancela pagamentos nem prolonga o prazo de anúncios avulsos ou destaques.</p>}
        <div className="mt-3">{mensagemErro}</div>
        <div className="mt-4 flex flex-col gap-2">
          {confirmacao === "vendido" ? <>
            <Botao larguraTotal disabled={ocupado} carregando={emCurso === "vendido-sim"} onClick={() => rodar("vendido-sim", () => marcarVendido(id, true))}>Sim, vendi pelo OLAKI</Botao>
            <Botao variante="secundario" larguraTotal disabled={ocupado} carregando={emCurso === "vendido-nao"} onClick={() => rodar("vendido-nao", () => marcarVendido(id, false))}>Não, vendi por fora</Botao>
          </> : <Botao variante={confirmacao === "excluir" ? "perigo" : "primario"} larguraTotal disabled={ocupado} carregando={emCurso !== null}
            onClick={() => confirmacao === "excluir" ? rodar("excluir", () => moverParaLixeira(id)) : rodar("pausar", () => pausarAnuncio(id))}>
            {confirmacao === "excluir" ? "Mover para lixeira" : "Pausar anúncio"}
          </Botao>}
          <Botao ref={cancelar} variante="secundario" larguraTotal disabled={ocupado} onClick={() => dialogo.current?.close()}>Cancelar</Botao>
        </div>
      </dialog>
    </div>
  );
}
