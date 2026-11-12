"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pause, Pencil, Play, Sparkles, Trash2, ArrowRight, RotateCcw } from "lucide-react";
import { linkDestacar } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { marcarVendido, moverParaLixeira, pausarAnuncio, reativarAnuncio, restaurarAnuncio } from "@/app/(conta)/minha-conta/anuncios/actions";
import { abaDoStatus } from "./situacao-anuncios";
import type { Resultado, StatusAnuncio } from "@/lib/tipos";

type Acao = "pausar" | "reativar" | "vendido-sim" | "vendido-nao" | "excluir" | "restaurar";
type Confirmacao = "pausar" | "vendido" | "excluir";

export function AcoesAnuncio({ id, status, titulo, temPagamento = false }: { id: string; status: StatusAnuncio; titulo: string; temPagamento?: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const trava = useRef(false);
  const [emCurso, setEmCurso] = useState<Acao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
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
    setEmCurso(acao);
    iniciar(async () => {
      try {
        const r = await fn();
        if (!r.ok) {
          setErro(r.erro.mensagem);
          setSessaoExpirada(r.erro.codigo === "28000");
          return;
        }
        dialogo.current?.close();
        const resultado = acao === "restaurar" ? "restaurado" : r.dados;
        router.replace(`/minha-conta/anuncios?aba=${abaDoStatus(r.dados)}&resultado=${resultado}&anuncio=${id}`, { scroll: true });
        router.refresh();
      } catch {
        setErro("A conexão falhou. Tente novamente; repetir a ação é seguro.");
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
    </div>
  );

  return (
    <div className="flex flex-col gap-2" aria-label={`Ações de ${titulo}`}>
      <div className="grid grid-cols-2 gap-2">
        {status === "excluido" ? (
          <Botao icone={<RotateCcw />} className="col-span-2 px-3" disabled={ocupado} carregando={emCurso === "restaurar"} textoCarregando="Restaurando..." onClick={() => rodar("restaurar", () => restaurarAnuncio(id))}>Restaurar anúncio</Botao>
        ) : (
          <>
            {status === "rascunho" && <Botao href={`/anunciar/fotos?rascunho=${id}`} icone={<ArrowRight />} className="col-span-2 px-3" carregando={ocupado}>Continuar rascunho</Botao>}
            {["ativo", "pausado", "expirado"].includes(status) && <Botao href={editar} variante="secundario" icone={<Pencil />} className="px-3" carregando={ocupado}>Editar</Botao>}
            {status === "ativo" && <Botao variante="secundario" icone={<Pause />} className="px-3" disabled={ocupado} onClick={() => abrir("pausar")}>Pausar</Botao>}
            {(status === "pausado" || status === "expirado") && <Botao variante="secundario" icone={<Play />} className="px-3" disabled={ocupado} carregando={emCurso === "reativar"} textoCarregando="Reativando..." onClick={() => rodar("reativar", () => reativarAnuncio(id))}>Reativar</Botao>}
            {status === "ativo" && <Botao href={linkDestacar(id)} variante="secundario" icone={<Sparkles />} className="px-3" carregando={ocupado}>Destacar</Botao>}
            {status === "ativo" && <Botao icone={<CheckCircle2 />} className="px-3" disabled={ocupado} onClick={() => abrir("vendido")}>Vendi</Botao>}
            <Botao variante="texto" icone={<Trash2 />} className="col-span-2 px-3 text-perigo" disabled={ocupado} onClick={() => abrir("excluir")}>Mover para lixeira</Botao>
          </>
        )}
      </div>
      {!confirmacao && mensagemErro}
      <dialog ref={dialogo} role="alertdialog" aria-labelledby={`confirmar-${id}`} aria-describedby={`explicacao-${id}`}
        onClose={() => setConfirmacao(null)} onCancel={(e) => { if (trava.current) e.preventDefault(); }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-folha bg-cartao p-5 text-texto shadow-2 backdrop:bg-beringela/50">
        <h2 id={`confirmar-${id}`} className="text-xl font-bold">
          {confirmacao === "excluir" ? "Mover para a lixeira?" : confirmacao === "pausar" ? "Pausar este anúncio?" : "Vendeu pelo Mercado da Região?"}
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
