// Peças visuais simples do painel (sem dependências extras).
export function Titulo({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{children}</h1>
      {sub && <p className="mt-1 text-sm text-neutral-500">{sub}</p>}
    </header>
  );
}

export function Cartao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Numero({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; alerta?: boolean }) {
  return (
    <Cartao>
      <p className="text-sm text-neutral-500">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${alerta ? "text-red-600" : "text-neutral-900"}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-neutral-500">{detalhe}</p>}
    </Cartao>
  );
}

export const estiloCampo =
  "mt-1 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base outline-none focus:border-laranja";
export const estiloBotao =
  "inline-flex h-11 items-center justify-center rounded-xl bg-laranja px-5 text-sm font-semibold text-marinho active:bg-orange-600 disabled:opacity-60";
export const estiloBotaoSec =
  "inline-flex h-11 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 active:bg-neutral-100";

export function Aviso({ tipo, children }: { tipo: "ok" | "erro"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm ${tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
    >
      {children}
    </p>
  );
}
