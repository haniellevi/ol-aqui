"use client";

import { useActionState, useState } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Aviso, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import type { EstadoForm } from "@/lib/admin/estado";
import { Botao } from "@/components/ui/botao";
import { alterarArquivoLoja } from "../actions";

export function FormArquivoLoja({ id, nome, arquivada, atualizado, ativos, gerentes, convites, pendentes, destaques, congelados }: {
  id: string;
  nome: string;
  arquivada: boolean;
  atualizado: string;
  ativos: number;
  gerentes: number;
  convites: number;
  pendentes: number;
  destaques: number;
  congelados: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, enviar, pendente] = useActionState(async (anterior: EstadoForm, dados: FormData): Promise<EstadoForm> => {
    const resultado: EstadoForm = await alterarArquivoLoja(anterior, dados).catch(() => ({ erro: "Não foi possível confirmar a ação. Atualize a ficha antes de tentar novamente." }));
    if (resultado?.ok) setAberto(false);
    return resultado;
  }, null);
  const rotulo = arquivada ? "Restaurar loja" : "Arquivar loja";

  return (
    <>
      <AlertDialog open={aberto} onOpenChange={(valor) => { if (!pendente) setAberto(valor); }}>
        <AlertDialogTrigger className={estiloBotaoSec}>{rotulo}</AlertDialogTrigger>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto [overflow-wrap:anywhere]">
          <AlertDialogHeader>
            <AlertDialogTitle>{rotulo}</AlertDialogTitle>
            <AlertDialogDescription>
              {arquivada
                ? `${nome} voltará como suspensa. A vitrine, os anúncios e o acesso de gerentes continuarão fora do ar.`
                : `${nome} sairá do site. Os anúncios ativos serão pausados e gerentes perderão acesso enquanto a loja estiver fora do ar. Pagamentos e histórico serão preservados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form action={enviar} className="grid gap-3">
            <input type="hidden" name="vitrine" value={id} />
            <input type="hidden" name="acao" value={arquivada ? "restaurar" : "arquivar"} />
            <input type="hidden" name="atualizado" value={atualizado} />
            {!arquivada && (
              <dl className="grid grid-cols-2 gap-2 text-legenda text-texto-suave">
                <div><dt>Anúncios ativos</dt><dd>{ativos}</dd></div>
                <div><dt>Gerentes</dt><dd>{gerentes}</dd></div>
                <div><dt>Convites pendentes</dt><dd>{convites}</dd></div>
                <div><dt>Cobranças pendentes</dt><dd>{pendentes}</dd></div>
                <div><dt>Pagamentos de destaque</dt><dd>{destaques}</dd></div>
                <div><dt>Anúncios congelados</dt><dd>{congelados}</dd></div>
              </dl>
            )}
            <label className="min-w-0 text-sm font-medium">
              Motivo (fica no histórico)
              <textarea name="motivo" rows={2} required minLength={3} maxLength={300} className={`${estiloCampo} h-auto resize-y py-2`} />
            </label>
            {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
              <Botao type="submit" variante={arquivada ? "primario" : "perigo"} carregando={pendente} textoCarregando="Salvando…">
                {arquivada ? "Confirmar restauração" : "Confirmar arquivamento"}
              </Botao>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      {!aberto && estado?.ok && <div className="mt-3"><Aviso tipo="ok">{estado.ok}</Aviso></div>}
    </>
  );
}
