import { classesBotao } from "@/components/ui/botao";

// Peças visuais simples do painel (sem dependências extras).
export function Titulo({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="mb-4">
      <h1 className="text-titulo font-semibold tracking-tight text-beringela">{children}</h1>
      {sub && <p className="mt-1 max-w-[70ch] text-pretty text-sm text-texto-suave">{sub}</p>}
    </header>
  );
}

export function Cartao({ children, className = "", ...props }: React.ComponentProps<"section">) {
  return <section {...props} className={`@container/painel relative min-w-0 rounded-card border border-borda bg-cartao p-3 ${className}`}>{children}</section>;
}

export function Numero({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; alerta?: boolean }) {
  return (
    <Cartao>
      <p className="text-legenda text-texto-suave">{rotulo}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums [overflow-wrap:anywhere] ${alerta ? "text-perigo" : "text-beringela"}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-legenda text-texto-suave">{detalhe}</p>}
    </Cartao>
  );
}

export const estiloCampo =
  "admin-campo mt-1 h-10 w-full rounded-campo border border-borda-campo bg-cartao px-3 text-base font-normal text-texto placeholder:text-texto-suave " +
  "outline-hidden focus-visible:outline-solid focus:border-laranja-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro disabled:bg-fundo disabled:text-texto-suave";
// Mesmas classes do <Botao>; painel.css compacta controles somente com mouse.
export const estiloBotao = classesBotao("primario");
export const estiloBotaoSec = classesBotao("secundario");
export const estiloBotaoPerigo = classesBotao("perigo");
// "Aprovar" na moderação: verde-escuro com texto branco (5,4:1). Nunca o verde claro atrás de texto.
export const estiloBotaoAprovar =
  "olaki-acao inline-flex min-h-10 select-none items-center justify-center gap-2 rounded-campo bg-verde-escuro px-4 text-base font-semibold leading-5 text-white " +
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
