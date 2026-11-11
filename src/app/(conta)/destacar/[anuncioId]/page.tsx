import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { meuAnuncio } from "@/lib/dados/anuncios";
import { meuPedidoDestaque, opcoesDestaque, resultadosDestaques } from "@/lib/dados/destaques";
import { precisaDocumento } from "@/lib/cobranca-destaque";
import { asaasConfigurado } from "@/lib/asaas";
import { ehUuid, preco } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { EscolherDestaque } from "@/components/destaques/escolher-destaque";
import { DestaquesAtivos } from "@/components/destaques/destaques-ativos";

export const metadata: Metadata = { title: "Destacar anúncio" };

type Props = { params: Promise<{ anuncioId: string }>; searchParams: Promise<{ d?: string | string[] }> };

// Destacar um anúncio: escolher o tipo, pagar (Pix/cartão) ou usar crédito do plano.
// ?d=<pedido> retoma um pagamento que ficou pela metade.
export default async function PaginaDestacar({ params, searchParams }: Props) {
  const [{ anuncioId }, sp] = await Promise.all([params, searchParams]);
  if (!ehUuid(anuncioId)) notFound();
  const anuncio = await meuAnuncio(anuncioId);
  if (!anuncio) notFound();

  const titulo = anuncio.titulo?.trim() || "Seu anúncio";
  const topo = <TopoConta titulo="Destacar anúncio" voltar="/minha-conta/anuncios" textoVoltar="Meus anúncios" />;

  if (anuncio.status !== "ativo") {
    return (
      <PaginaConta>
        {topo}
        <Vazio titulo="Este anúncio não está no ar" texto="Só dá para destacar um anúncio que está aparecendo no site.">
          <Botao href="/minha-conta/anuncios" larguraTotal>
            Ver meus anúncios
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }

  const d = Array.isArray(sp.d) ? sp.d[0] : sp.d;
  const [opcoes, resultados, pedido, pedirDoc] = await Promise.all([
    opcoesDestaque(anuncio.id),
    resultadosDestaques(anuncio.id),
    d ? meuPedidoDestaque(d) : Promise.resolve(null),
    precisaDocumento(anuncio.vitrine_id),
  ]);
  const pedidoDoAnuncio = pedido && pedido.anuncio_id === anuncio.id ? pedido : null;

  return (
    <PaginaConta>
      {topo}
      <div className="flex items-center gap-3 rounded-card bg-cartao p-3 shadow-1">
        <div className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-campo bg-borda">
          {anuncio.fotos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- img simples: leve no 3G
            <img src={anuncio.fotos[0]} alt="" width={64} height={64} className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-texto-suave">
              <ImageOff className="size-5" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-base leading-5 font-semibold">{titulo}</p>
          <p className="text-base font-bold">{preco(anuncio.preco_centavos)}</p>
        </div>
      </div>

      <p className="text-base text-texto-suave">Mais gente vê seu anúncio. Escolha como quer aparecer:</p>

      <DestaquesAtivos lista={resultados} />

      <EscolherDestaque
        opcoes={opcoes}
        anuncioId={anuncio.id}
        pagamentoLigado={asaasConfigurado()}
        precisaDocumento={pedirDoc}
        pedidoInicial={pedidoDoAnuncio}
        voltar={{ href: "/minha-conta/anuncios", texto: "Ver meus anúncios" }}
      />
    </PaginaConta>
  );
}
