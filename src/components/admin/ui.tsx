import { classesBotao } from "@/components/ui/botao";

// Peças visuais simples do painel (sem dependências extras).
export function Titulo({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-beringela">{children}</h1>
      {sub && <p className="mt-1 text-sm text-texto-suave">{sub}</p>}
    </header>
  );
}

export function Cartao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-card border border-borda bg-cartao p-4 shadow-1 ${className}`}>{children}</section>;
}

export function Numero({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; alerta?: boolean }) {
  return (
    <Cartao>
      <p className="text-sm text-texto-suave">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${alerta ? "text-perigo" : "text-beringela"}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-[13px] text-texto-suave">{detalhe}</p>}
    </Cartao>
  );
}

export const estiloCampo =
  "mt-1 h-12 w-full rounded-campo border border-borda bg-cartao px-3 text-base text-beringela outline-none focus:border-laranja-escuro";
// Mesmas classes do <Botao> (src/components/ui/botao.tsx): 48px, texto 16px peso 600, apertado = brightness-90.
export const estiloBotao = classesBotao("primario");
export const estiloBotaoSec = classesBotao("secundario");
export const estiloBotaoPerigo = classesBotao("perigo");
// "Aprovar" na moderação: verde-escuro com texto branco (5,4:1). Nunca o verde claro atrás de texto.
export const estiloBotaoAprovar =
  "inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-card bg-verde-escuro px-5 text-base font-semibold leading-5 text-white " +
  "transition-colors active:brightness-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Aviso({ tipo, children }: { tipo: "ok" | "erro"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-card px-4 py-3 text-sm ${tipo === "ok" ? "bg-sucesso-fundo text-verde-escuro" : "bg-perigo-fundo text-perigo"}`}
    >
      {children}
    </p>
  );
}
