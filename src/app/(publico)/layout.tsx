import { CabecalhoPublico } from "@/components/ui/cabecalho-publico";
import { BarraInferior } from "@/components/ui/barra-inferior";

// Páginas abertas a todos (Início, busca, anúncio, loja...): cabeçalho + conteúdo + barra de baixo.
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
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
