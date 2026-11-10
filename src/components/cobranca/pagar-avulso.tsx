"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { CaixaResultado, FluxoCobranca } from "@/components/cobranca/fluxo-cobranca";
import { passoDoCampo, urlPasso } from "@/components/anunciar/passos";
import { linkAvulso } from "@/lib/rotas";
import { pedirAvulso } from "@/app/(conta)/pagar/actions";
import type { MeuPagamento } from "@/lib/tipos-cobranca";

// Pagamento do anúncio avulso (pessoa física que chegou ao limite do plano grátis).
// Pago → o banco publica sozinho (aplicar_anuncio_avulso) e a tela leva para "Seu anúncio está no ar!".

export function PagarAvulso({
  anuncioId,
  editar,
  precoCentavos,
  dias,
  precisaDocumento,
  pagamentoInicial,
}: {
  anuncioId: string;
  /** Anúncio que já foi publicado antes (pausado/expirado): os passos abrem no modo edição. */
  editar: boolean;
  precoCentavos: number;
  dias: number;
  precisaDocumento: boolean;
  pagamentoInicial?: MeuPagamento | null;
}) {
  const router = useRouter();
  const pronto = `/anunciar/pronto?id=${encodeURIComponent(anuncioId)}`;
  return (
    <FluxoCobranca
      valorCentavos={precoCentavos}
      precisaDocumento={precisaDocumento}
      pagamentoInicial={pagamentoInicial}
      pedir={(forma, doc) => pedirAvulso(anuncioId, forma, doc)}
      aoMudarPagamento={(id) => router.replace(linkAvulso(anuncioId, id), { scroll: false })}
      aoPagar={(p) => {
        if (!p.devolver_motivo) router.push(pronto);
      }}
      nota={<p>Paga uma vez e o anúncio fica {dias === 1 ? "1 dia" : `${dias} dias`} no ar, sem mudar de plano. Ele vai para o ar assim que o pagamento cair.</p>}
      aoErrar={(e) => {
        const passo = passoDoCampo(e.campo);
        return passo ? (
          <Link href={urlPasso(passo, anuncioId, editar)} className="inline-flex min-h-10 items-center underline underline-offset-4">
            Corrigir agora
          </Link>
        ) : null;
      }}
      sucesso={() => (
        <CaixaResultado icone="ok" titulo="Pagamento confirmado!">
          <p className="max-w-sm text-base text-texto-suave">Estamos colocando seu anúncio no ar.</p>
          <Botao href={pronto} larguraTotal className="max-w-sm">
            Ver meu anúncio
          </Botao>
        </CaixaResultado>
      )}
    />
  );
}
