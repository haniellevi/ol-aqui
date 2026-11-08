import { CabecalhoPublico } from "@/components/ui/cabecalho-publico";
import { BarraInferior } from "@/components/ui/barra-inferior";
import { BalaoAki } from "@/components/aki/balao-aki";

// Radar: cabeçalho + conteúdo + barra de baixo (como o resto do site).
// Nunca guardado em cache: pedidos, propostas e contatos são de cada pessoa.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default function LayoutRadar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CabecalhoPublico />
      <div id="conteudo" className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <BarraInferior />
      <BalaoAki />
    </>
  );
}
