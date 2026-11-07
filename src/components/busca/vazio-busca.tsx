import { Radar } from "lucide-react";
import { Vazio } from "@/components/ui/vazio";
import { Botao } from "@/components/ui/botao";

// Busca sem resultado: nunca beco sem saída (USABILIDADE.md, regra 10).
// Oferece o Radar já preenchido com o que a pessoa procurou.
export function VazioBusca({
  termo,
  limparHref,
  outrasHref = "/categorias",
}: {
  termo?: string | null;
  /** Link para tirar os filtros (só quando há filtro ligado). */
  limparHref?: string | null;
  outrasHref?: string;
}) {
  const t = (termo ?? "").trim();
  const pedido = t ? `/radar?pedido=${encodeURIComponent(t)}` : "/radar";
  return (
    <Vazio
      titulo={t ? `Não achamos “${t}” por aqui ainda.` : "Ainda não tem anúncio aqui."}
      texto="Peça no Radar: as lojas e vendedores da região recebem seu pedido e te chamam."
    >
      <Botao href={pedido} larguraTotal icone={<Radar />}>
        Pedir no Radar
      </Botao>
      {limparHref ? (
        <Botao href={limparHref} variante="secundario" larguraTotal>
          Tirar os filtros
        </Botao>
      ) : (
        <Botao href={outrasHref} variante="secundario" larguraTotal>
          Ver todas as categorias
        </Botao>
      )}
    </Vazio>
  );
}
