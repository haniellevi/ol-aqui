import { CabecalhoPublico } from "@/components/ui/cabecalho-publico";
import { BarraInferior } from "@/components/ui/barra-inferior";

// Radar: o início é aberto a todos (explicação para quem não entrou); pedir, ver os próprios
// pedidos e os pedidos da região exigem conta. Mostra dado de uma pessoa: nunca em cache.
export const dynamic = "force-dynamic";

export default function LayoutRadar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CabecalhoPublico />
      <div id="conteudo" className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <BarraInferior />
    </>
  );
}
