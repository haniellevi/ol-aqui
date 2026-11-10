import type { ReactNode } from "react";

// Barra fixa embaixo com o botão principal ("Continuar"). No celular fica logo acima da
// barra de navegação; no computador encosta no fim da tela.
export function BarraContinuar({ children, aviso }: { children: ReactNode; aviso?: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] olaki-material z-20 px-4 py-2 md:bottom-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-1.5">
        {children}
        {aviso && <p className="text-center text-sm text-texto-suave">{aviso}</p>}
      </div>
    </div>
  );
}

/** Embrulho do conteúdo do passo: largura de leitura e espaço para a barra fixa não cobrir nada. */
export function CorpoPasso({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-36 pt-4 md:pb-32">{children}</main>;
}
