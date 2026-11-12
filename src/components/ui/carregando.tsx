import { Skeleton } from "@/components/ui/skeleton";

// Telas de espera: caixas cinzas no lugar do conteúdo, no mesmo formato da tela que vai chegar.
function Moldura({ rotulo, className, children }: { rotulo: string; className: string; children: React.ReactNode }) {
  return (
    <main role="status" aria-label={rotulo} className={className}>
      {children}
      <span className="sr-only">Carregando…</span>
    </main>
  );
}

export function CarregandoGrade({ rotulo = "Carregando os anúncios" }: { rotulo?: string }) {
  return (
    <Moldura rotulo={rotulo} className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-card bg-card p-2 shadow-1">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/5" />
          </div>
        ))}
      </div>
    </Moldura>
  );
}

export function CarregandoLista({ rotulo = "Carregando", linhas = 5 }: { rotulo?: string; linhas?: number }) {
  return (
    <Moldura rotulo={rotulo} className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <Skeleton className="h-5 w-48" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-card bg-card p-3 shadow-1">
            <Skeleton className="size-12 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </Moldura>
  );
}

export function CarregandoAnuncio() {
  return (
    <Moldura rotulo="Carregando o anúncio" className="mx-auto grid w-full max-w-6xl gap-5 pb-8 md:grid-cols-[3fr_2fr] md:px-4 md:py-4">
      <Skeleton className="aspect-square w-full rounded-none md:rounded-card" />
      <div className="flex flex-col gap-3 px-4 md:px-0">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-2 h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </Moldura>
  );
}

// Dentro do painel: o <main> já vem do layout.
export function CarregandoPainel() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-5">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="flex flex-col gap-2 rounded-card bg-card p-3 shadow-1">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
