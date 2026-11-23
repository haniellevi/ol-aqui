import type { ReactNode } from "react";
import { Botao } from "@/components/ui/botao";

// A barra fixa reserva a parte de baixo da tela para a ação principal do passo.
export function BarraContinuar({ children, aviso }: { children: ReactNode; aviso?: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-cartao px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto flex w-full max-w-[33rem] flex-col gap-1 sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-3">
        {children}
        {aviso && <p className="text-legenda text-texto-suave">{aviso}</p>}
      </div>
    </div>
  );
}

export function BotaoPasso({ editar, daRevisao, salvando, disabled, enviandoFotos }: {
  editar: boolean;
  daRevisao?: boolean;
  salvando: boolean;
  disabled?: boolean;
  enviandoFotos?: boolean;
}) {
  const acao = daRevisao ? "salvar-revisao" : editar ? "salvar" : "seguir";
  return (
    <Botao type="submit" name="acao" value={acao} tamanho="toque" className="w-full sm:w-auto sm:min-w-48" carregando={salvando} textoCarregando="Salvando..." disabled={disabled}>
      {enviandoFotos ? "Enviando fotos..." : acao === "seguir" ? "Continuar" : "Salvar alterações"}
    </Botao>
  );
}

/** Embrulho do conteúdo do passo: largura de leitura e espaço para a barra fixa não cobrir nada. */
export function CorpoPasso({ children }: { children: ReactNode }) {
  return <main data-passo-anuncio className="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3 px-4 pt-1 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:gap-4 md:pt-4">{children}</main>;
}
