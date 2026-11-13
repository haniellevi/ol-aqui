import { CabecalhoPublico } from "@/components/ui/cabecalho-publico";
import { BarraInferior } from "@/components/ui/barra-inferior";
import { BalaoAki } from "@/components/aki/balao-aki";
import { AvisoTermos } from "@/components/paginas/aviso-termos";

// Páginas abertas a todos (Início, busca, anúncio, loja...): cabeçalho + conteúdo + barra de baixo.
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="publico">
      <CabecalhoPublico />
      <div id="conteudo" className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <AvisoTermos />
        {children}
      </div>
      <BarraInferior />
      <div className="assistente-publico"><BalaoAki /></div>
    </div>
  );
}
