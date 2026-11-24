import { Alert } from "@/components/ui/alert";
import { classesBotao } from "@/components/ui/botao";
import { classesCampo } from "@/components/ui/input";

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

// Mesma caixa de campo do resto do app (components/ui/input), com a folga do rótulo em cima.
export const estiloCampo = `${classesCampo} admin-campo mt-1 h-controle`;
// Mesmas classes do <Botao>; painel.css compacta controles somente com mouse.
export const estiloBotao = classesBotao("primario");
export const estiloBotaoSec = classesBotao("secundario");
export const estiloBotaoPerigo = classesBotao("perigo");
// Aprovar usa a ação secundária oficial, sem competir com a ação principal.
export const estiloBotaoAprovar = estiloBotaoSec;

export function Aviso({ tipo, children }: { tipo: "ok" | "erro"; children: React.ReactNode }) {
  return (
    <Alert role={tipo === "erro" ? "alert" : "status"} variant={tipo === "ok" ? "success" : "destructive"}>
      {children}
    </Alert>
  );
}
