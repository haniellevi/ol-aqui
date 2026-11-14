import { atalhoLoja } from "@/lib/dados/navegacao-lojista";
import { CabecalhoPublico } from "@/components/ui/cabecalho-publico";
import { BarraInferior } from "@/components/ui/barra-inferior";
import { BalaoAki } from "@/components/aki/balao-aki";
import { AvisoTermos } from "@/components/paginas/aviso-termos";

// Radar: cabeçalho + conteúdo + barra de baixo (como o resto do site).
// Nunca guardado em cache: pedidos, propostas e contatos são de cada pessoa.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function LayoutRadar({ children }: { children: React.ReactNode }) {
  const loja = await atalhoLoja();
  return (
    <>
      <CabecalhoPublico />
      <div id="conteudo" className="pb-reserva-nav md:pb-0">
        <AvisoTermos />
        {children}
      </div>
      <BarraInferior loja={loja} />
      <BalaoAki />
    </>
  );
}
