"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Alert } from "@/components/ui/alert";
import { moverParaLixeira } from "@/app/(conta)/minha-conta/anuncios/actions";

// Etapa P6: no fim de cada passo do Anunciar, "Descartar rascunho"; no fim da edição de um
// anúncio publicado, "Excluir anúncio". Os dois mandam para a lixeira (30 dias, com restauração),
// com o mesmo diálogo do menu "Mais" de Meus anúncios, e abrem a aba Lixeira com o aviso.
export function DescartarAnuncio({ id, titulo, rascunho, temPagamento = false }: {
  id: string;
  titulo: string | null;
  /** Rascunho: "Descartar rascunho". Publicado (editando): "Excluir anúncio". */
  rascunho: boolean;
  temPagamento?: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const trava = useRef(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [recarregar, setRecarregar] = useState(false);
  const rotulo = rascunho ? "Descartar rascunho" : "Excluir anúncio";
  const nome = titulo?.trim() || (rascunho ? "Rascunho sem título" : "Anúncio sem título");

  function abrir() {
    setErro(null);
    dialogo.current?.showModal();
    cancelar.current?.focus();
  }

  function confirmar() {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    setSessaoExpirada(false);
    setRecarregar(false);
    iniciar(async () => {
      try {
        const r = await moverParaLixeira(id);
        if (!r.ok) {
          setErro(r.erro.mensagem);
          setSessaoExpirada(r.erro.codigo === "28000");
          setRecarregar(r.erro.codigo === "alteracao_incerta");
          return;
        }
        dialogo.current?.close();
        router.replace(`/minha-conta/anuncios?aba=lixeira&resultado=excluido&anuncio=${id}`);
      } catch {
        setErro(navigator.onLine
          ? "Não foi possível confirmar a alteração. Atualize a página para conferir a situação do anúncio."
          : "Você está sem internet. Reconecte-se e atualize a página para conferir a situação do anúncio.");
        setRecarregar(true);
      } finally {
        trava.current = false;
      }
    });
  }

  return (
    <div className="flex flex-col items-start">
      <Botao variante="texto" className="text-perigo" icone={<Trash2 />} disabled={pendente} onClick={abrir}>{rotulo}</Botao>
      <dialog ref={dialogo} role="alertdialog" aria-labelledby={`descartar-${id}`} aria-describedby={`descartar-texto-${id}`}
        onCancel={(e) => { if (trava.current) e.preventDefault(); }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-folha bg-cartao p-5 text-texto shadow-2 backdrop:bg-beringela/50">
        <h2 id={`descartar-${id}`} className="text-xl font-semibold">{rascunho ? "Descartar este rascunho?" : "Mover para a lixeira?"}</h2>
        <p className="mt-2 font-semibold break-words">{nome}</p>
        <p id={`descartar-texto-${id}`} className="mt-2 text-base text-texto-suave">
          {rascunho
            ? "O rascunho vai para a lixeira. As fotos ficam guardadas por 30 dias e você pode restaurá-lo na aba Lixeira."
            : "O anúncio ficará oculto. As fotos e o histórico serão guardados, e você poderá restaurá-lo na aba Lixeira."}
        </p>
        {temPagamento && <p className="mt-2 text-sm text-texto-suave">Esta ação não cancela pagamentos nem prolonga o prazo de anúncios avulsos ou destaques.</p>}
        {erro && (
          <Alert variant="destructive" role="alert" className="mt-3">
            <p>{erro}</p>
            {sessaoExpirada && <Botao href="/entrar?redirect_url=%2Fminha-conta%2Fanuncios" variante="texto">Entrar novamente</Botao>}
            {recarregar && <Botao variante="texto" onClick={() => window.location.reload()}>Atualizar página</Botao>}
          </Alert>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <Botao variante="perigo" larguraTotal disabled={pendente} carregando={pendente} onClick={confirmar}>{rotulo}</Botao>
          <Botao ref={cancelar} variante="secundario" larguraTotal disabled={pendente} onClick={() => dialogo.current?.close()}>Cancelar</Botao>
        </div>
      </dialog>
    </div>
  );
}
