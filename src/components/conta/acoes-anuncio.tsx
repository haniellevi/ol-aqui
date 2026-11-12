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
import { Alert } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Acao = "pausar" | "reativar" | "vendido-sim" | "vendido-nao" | "excluir" | "restaurar";
type Confirmacao = "pausar" | "vendido" | "excluir";

// Plano de design: no card ficam à vista só a ação do momento e Editar (botões pequenos).
// O resto (pausar, destacar, fixar, lixeira) fica no menu "Mais".
export function AcoesAnuncio({ id, status, titulo, temPagamento = false, maisAcoes, podeDestacar = true }: {
  id: string; status: StatusAnuncio; titulo: string; temPagamento?: boolean; podeDestacar?: boolean;
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

  function abrir(tipo: Confirmacao) {
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
    <Alert variant="destructive" role="alert">
      <p>{erro}</p>
      {sessaoExpirada && <Botao href="/entrar?redirect_url=%2Fminha-conta%2Fanuncios" variante="texto">Entrar novamente</Botao>}
      {recarregar && <Botao variante="texto" onClick={() => window.location.reload()}>Atualizar página</Botao>}
    </Alert>
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
            <DropdownMenu>
              <DropdownMenuTrigger className={classesBotao("secundario", false, "cursor-pointer", "pequeno")} aria-label={`Mais ações de ${titulo}`}>
                <Ellipsis className="size-4" aria-hidden /> Mais
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {status === "ativo" && <DropdownMenuItem disabled={ocupado} onClick={() => abrir("pausar")}><Pause aria-hidden />Pausar</DropdownMenuItem>}
                {status === "ativo" && podeDestacar && <DropdownMenuItem render={<Link href={linkDestacar(id)} />}><Sparkles aria-hidden />Destacar</DropdownMenuItem>}
                {maisAcoes}
                <DropdownMenuItem variant="destructive" disabled={ocupado} onClick={() => abrir("excluir")}><Trash2 aria-hidden />Mover para lixeira</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      {!confirmacao && mensagemErro}
      <dialog ref={dialogo} role="alertdialog" aria-labelledby={`confirmar-${id}`} aria-describedby={`explicacao-${id}`}
        onClose={() => setConfirmacao(null)} onCancel={(e) => { if (trava.current) e.preventDefault(); }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-folha bg-cartao p-5 text-texto shadow-2 backdrop:bg-beringela/50">
        <h2 id={`confirmar-${id}`} className="text-xl font-semibold">
          {confirmacao === "excluir" ? "Mover para a lixeira?" : confirmacao === "pausar" ? "Pausar este anúncio?" : "Vendeu pelo Mercado da Região?"}
        </h2>
        <p className="mt-2 font-semibold break-words">{titulo}</p>
        <p id={`explicacao-${id}`} className="mt-2 text-base text-texto-suave">
          {confirmacao === "excluir" ? "O anúncio ficará oculto. As fotos e o histórico serão guardados, e você poderá restaurá-lo na aba Lixeira."
            : confirmacao === "pausar" ? "O anúncio sai da busca e o contato fica indisponível. Você pode reativá-lo quando quiser."
              : "O anúncio sai da busca e quem tiver o link verá Vendido, sem o botão de contato. Essa venda não pode ser desfeita por aqui."}
        </p>
        {temPagamento && <p className="mt-2 text-sm text-texto-suave">Esta ação não cancela pagamentos nem prolonga o prazo de anúncios avulsos ou destaques.</p>}
        <div className="mt-3">{mensagemErro}</div>
        <div className="mt-4 flex flex-col gap-2">
          {confirmacao === "vendido" ? <>
            <Botao larguraTotal disabled={ocupado} carregando={emCurso === "vendido-sim"} onClick={() => rodar("vendido-sim", () => marcarVendido(id, true))}>Sim, vendi pelo Mercado da Região</Botao>
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
