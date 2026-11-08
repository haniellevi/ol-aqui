import { Compass } from "lucide-react";
import { CabecalhoPublico } from "@/components/ui/cabecalho-publico";
import { BarraInferior } from "@/components/ui/barra-inferior";
import { CampoBusca } from "@/components/busca/campo-busca";
import { Botao } from "@/components/ui/botao";
import { LINK_AJUDA, LINK_AKI, linkPedirRadar } from "@/lib/rotas";

// T44 · Página não encontrada: sem susto, com busca e caminhos para continuar (USABILIDADE.md, regra 10).
// O botão laranja da tela é o "Buscar" do campo de busca.
export default function NaoEncontrado() {
  return (
    <>
      <CabecalhoPublico />
      <main id="conteudo" className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:pb-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-laranja-claro text-beringela" aria-hidden>
            <Compass className="size-8" />
          </span>
          <h1 className="text-[22px] font-semibold leading-7">Não achamos esta página</h1>
          <p className="text-base text-texto-suave">O endereço pode estar errado ou o conteúdo saiu do ar. Busque o que você procura:</p>
        </div>
        <CampoBusca id="busca-nao-encontrado" />
        <div className="flex flex-col gap-2">
          <Botao href="/" variante="secundario" larguraTotal>
            Voltar ao início
          </Botao>
          <Botao href={linkPedirRadar()} variante="secundario" larguraTotal>
            Pedir no Radar
          </Botao>
          <Botao href={LINK_AKI} variante="texto">
            Perguntar ao Aki
          </Botao>
          <Botao href={LINK_AJUDA} variante="texto">
            Ver a Ajuda
          </Botao>
        </div>
      </main>
      <BarraInferior />
    </>
  );
}
