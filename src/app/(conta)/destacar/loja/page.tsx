import type { Metadata } from "next";
import { Store } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { meuPedidoDestaque, opcoesDestaque, resultadosDestaques } from "@/lib/dados/destaques";
import { precisaDocumento } from "@/lib/cobranca-destaque";
import { asaasConfigurado } from "@/lib/asaas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { EscolherDestaque } from "@/components/destaques/escolher-destaque";
import { DestaquesAtivos } from "@/components/destaques/destaques-ativos";

export const metadata: Metadata = { title: "Destacar minha loja" };

// "Loja em destaque": a loja aparece no bloco "Lojas em destaque" da página inicial.
export default async function PaginaDestacarLoja({ searchParams }: { searchParams: Promise<{ d?: string | string[] }> }) {
  const [sp, conta] = await Promise.all([searchParams, meuPerfilEVitrine()]);
  const v = conta?.vitrine;
  const topo = <TopoConta titulo="Destacar minha loja" voltar="/minha-conta/loja" textoVoltar="Minha loja" />;

  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        {topo}
        <Vazio titulo="Você ainda não tem uma loja" texto="Loja em destaque é para quem tem loja no OLAKI." icone={<Store />}>
          <Botao href="/quero-vender/loja" larguraTotal>
            Abrir minha loja
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }

  const d = Array.isArray(sp.d) ? sp.d[0] : sp.d;
  const [opcoes, resultados, pedido, pedirDoc] = await Promise.all([
    opcoesDestaque(null),
    resultadosDestaques(null),
    d ? meuPedidoDestaque(d) : Promise.resolve(null),
    precisaDocumento(v.id),
  ]);
  const pedidoDaLoja = pedido && pedido.tipo === "loja" ? pedido : null;

  return (
    <PaginaConta>
      {topo}
      <div className="flex items-center gap-3 rounded-card bg-cartao p-3 shadow-1">
        <AvatarVitrine nome={v.nome} logo={v.logo_url} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{v.nome}</p>
          <p className="text-legenda text-texto-suave">{v.cidade}</p>
        </div>
      </div>
      <p className="text-base text-texto-suave">Sua loja aparece na página inicial para quem é da sua região.</p>

      <DestaquesAtivos lista={resultados.filter((r) => r.tipo === "loja")} titulo="Destaques da loja" />

      <EscolherDestaque
        opcoes={opcoes}
        anuncioId={null}
        pagamentoLigado={asaasConfigurado()}
        precisaDocumento={pedirDoc}
        pedidoInicial={pedidoDaLoja}
        voltar={{ href: "/minha-conta/loja", texto: "Voltar para minha loja" }}
      />
    </PaginaConta>
  );
}
