import { AbrirRadarAssistido } from "@/components/assistente/retomar";
import { Radar } from "lucide-react";
import { Vazio } from "@/components/ui/vazio";
import { Botao } from "@/components/ui/botao";
import { BotaoAbrirAki } from "@/components/aki/botao-abrir-aki";
import { linkPedirRadar, type FiltrosPedido } from "@/lib/rotas";

// Busca sem resultado: nunca beco sem saída (USABILIDADE.md, regra 10).
// Oferece o Radar já preenchido com o que a pessoa procurou e o Merc (quando ligado).
export function VazioBusca({
  dono,
  termo,
  filtros,
  limparHref,
  outrasHref = "/categorias",
}: {
  dono?: string | null;
  termo?: string | null;
  filtros?: FiltrosPedido;
  /** Link para tirar os filtros (só quando há filtro ligado). */
  limparHref?: string | null;
  outrasHref?: string;
}) {
  const t = (termo ?? "").trim();
  const pedido = linkPedirRadar(t, filtros);
  return (
    <Vazio
      titulo={t ? `Nenhum resultado para “${t}”` : "Ainda não há anúncios aqui"}
      texto="Peça no Radar para receber propostas de lojas da região."
    >
      {dono === undefined ? (
        <Botao href={pedido} tamanho="toque" larguraTotal icone={<Radar />}>Pedir no Radar</Botao>
      ) : <AbrirRadarAssistido busca={{ ...filtros, q: t }} dono={dono} texto="Pedir no Radar" tamanho="toque" />}
      <BotaoAbrirAki tamanho="toque" pedido={{ texto: t ? `Procuro ${t}` : "" }}>Perguntar ao Merc</BotaoAbrirAki>
      {limparHref ? (
        <Botao href={limparHref} variante="secundario" tamanho="toque" larguraTotal>
          Tirar os filtros
        </Botao>
      ) : (
        <Botao href={outrasHref} variante="secundario" tamanho="toque" larguraTotal>
          Ver todas as categorias
        </Botao>
      )}
    </Vazio>
  );
}
