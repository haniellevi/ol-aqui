import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

// Caixa de aviso das telas da conta. "erro" e "ok" são anunciados pelo leitor de tela.
export function Aviso({ tipo = "info", children }: { tipo?: "erro" | "ok" | "info" | "atencao"; children: ReactNode }) {
  const estilos = {
    erro: "border-perigo bg-perigo-fundo text-perigo",
    ok: "border-verde-escuro bg-sucesso-fundo text-verde-escuro",
    info: "border-borda bg-cartao text-texto",
    atencao: "border-aviso bg-aviso-fundo text-aviso",
  }[tipo];
  const Icone = tipo === "erro" || tipo === "atencao" ? AlertCircle : tipo === "ok" ? CheckCircle2 : Info;
  return (
    <div
      role={tipo === "erro" ? "alert" : tipo === "ok" ? "status" : undefined}
      className={`flex gap-3 rounded-card border p-3 text-base ${estilos}`}
    >
      <Icone className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1 font-semibold">{children}</div>
    </div>
  );
}
