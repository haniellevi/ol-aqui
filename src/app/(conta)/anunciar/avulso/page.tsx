import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ImageOff, Receipt, ShieldAlert } from "lucide-react";
import { meuAnuncio } from "@/lib/dados/anuncios";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { avulsoParaMim, meuPagamento } from "@/lib/dados/cobranca";
import { asaasConfigurado } from "@/lib/asaas";
import { precisaDocumento } from "@/lib/cobranca-destaque";
import { ehUuid, preco } from "@/lib/formato";
import { LINK_PLANOS } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { Aviso } from "@/components/conta/aviso";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { PagarAvulso } from "@/components/cobranca/pagar-avulso";
import { urlPasso } from "@/components/anunciar/passos";

export const metadata: Metadata = { title: "Anúncio avulso" };

type Params = Promise<{ id?: string | string[]; p?: string | string[] }>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// Anúncio avulso: a pessoa física chegou ao limite do plano grátis e paga para pôr ESTE anúncio no ar.
// Preço e dias vêm do painel (avulso.preco_centavos / avulso.dias, por região). O banco confere tudo
// de novo antes de cobrar (pedir_anuncio_avulso) e publica sozinho quando o pagamento cai.
export default async function PaginaAvulso({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const id = um(sp.id);
  const p = um(sp.p);
  if (!ehUuid(id)) redirect("/anunciar");

  const conta = await meuPerfilEVitrine();
  if (!conta) redirect(`/entrar?redirect_url=${encodeURIComponent(`/anunciar/avulso?id=${id}`)}`);
  if (!conta.vitrine) redirect("/quero-vender");
  const vitrine = conta.vitrine;

  const anuncio = await meuAnuncio(id);
  if (!anuncio || anuncio.status === "congelado") notFound();
  const editar = anuncio.status !== "rascunho";
  const revisar = urlPasso("revisar", anuncio.id, editar);

  const pagamentoLigado = asaasConfigurado();
  const [avulso, retomado, doc] = await Promise.all([
    avulsoParaMim(vitrine),
    ehUuid(p) ? meuPagamento(p) : Promise.resolve(null),
    pagamentoLigado ? precisaDocumento(vitrine.id) : Promise.resolve(false),
  ]);
  const pagamento = retomado?.tipo === "anuncio_avulso" && retomado.anuncio_id === anuncio.id ? retomado : null;

  // já pago e já no ar (ou em análise): a tela de pronto mostra o resultado
  if (pagamento?.status === "pago" && (anuncio.status === "ativo" || anuncio.status === "em_analise")) {
    redirect(`/anunciar/pronto?id=${encodeURIComponent(anuncio.id)}`);
  }

  if (vitrine.status === "suspensa") {
    return (
      <PaginaConta>
        <TopoConta titulo="Anúncio avulso" voltar={revisar} textoVoltar="Voltar" />
        <Vazio titulo="Sua conta de vendedor está suspensa" texto="Fale com o suporte do OLAKI para saber o que aconteceu." icone={<ShieldAlert />}>
          <Botao href="/" variante="secundario" larguraTotal>Voltar ao início</Botao>
        </Vazio>
      </PaginaConta>
    );
  }

  const pagoAte = anuncio.pago_ate && new Date(anuncio.pago_ate).getTime() > Date.now() ? anuncio.pago_ate : null;
  // Sem pagamento pago para mostrar: anúncio no ar, vendido ou já pago não precisa (e não paga) de novo,
  // mesmo voltando com ?p= de uma cobrança que ficou esperando.
  if (pagamento?.status !== "pago" && (anuncio.status === "ativo" || anuncio.status === "em_analise" || anuncio.status === "vendido" || pagoAte)) {
    return (
      <PaginaConta>
        <TopoConta titulo="Anúncio avulso" voltar={revisar} textoVoltar="Voltar" />
        <Vazio
          titulo={pagoAte ? "Este anúncio já está pago" : "Este anúncio não precisa de avulso"}
          texto={pagoAte ? "Abra o anúncio e toque em Publicar." : "Ele já está no ar ou foi vendido."}
        >
          <Botao href={pagoAte ? revisar : "/minha-conta/anuncios"} larguraTotal>
            {pagoAte ? "Abrir e publicar" : "Ver meus anúncios"}
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }

  if (!avulso && !pagamento) {
    return (
      <PaginaConta>
        <TopoConta titulo="Anúncio avulso" voltar={revisar} textoVoltar="Voltar" />
        <Vazio titulo="O anúncio avulso não está disponível" texto="Escolha um plano para pôr mais anúncios no ar.">
          <Botao href={LINK_PLANOS} larguraTotal>Ver planos</Botao>
        </Vazio>
      </PaginaConta>
    );
  }

  const valor = pagamento?.valor_centavos ?? avulso!.preco;
  const dias = avulso?.dias ?? 0;

  return (
    <PaginaConta>
      <TopoConta titulo="Anúncio avulso" texto="Pague uma vez para pôr este anúncio no ar." voltar={revisar} textoVoltar="Voltar" />

      <section aria-label="Anúncio" className="flex items-center gap-3 rounded-card bg-cartao p-3 shadow-1">
        <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-campo bg-borda text-texto-suave">
          {anuncio.fotos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura simples do Storage
            <img src={anuncio.fotos[0]} alt="" width={64} height={64} className="absolute inset-0 size-full object-cover" />
          ) : (
            <ImageOff className="size-6" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-semibold">{anuncio.titulo || "Anúncio sem título"}</span>
          <span className="text-sm text-texto-suave">{preco(anuncio.preco_centavos)}</span>
        </span>
      </section>

      <section className="flex gap-3 rounded-card bg-cartao p-4 shadow-1">
        <Receipt className="mt-0.5 size-6 shrink-0 text-beringela" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold">Anúncio avulso por {preco(valor)}</h2>
          <p className="text-base text-texto-suave">
            {dias ? `Fica ${dias === 1 ? "1 dia" : `${dias} dias`} no ar. ` : ""}Não muda o seu plano e não conta no limite.
          </p>
        </div>
      </section>

      {pagamentoLigado ? (
        <PagarAvulso
          anuncioId={anuncio.id}
          editar={editar}
          precoCentavos={valor}
          dias={dias}
          precisaDocumento={doc}
          pagamentoInicial={pagamento}
        />
      ) : (
        <Aviso tipo="info">
          <span>Pagamento em breve: logo dá para pagar o avulso por Pix ou cartão aqui mesmo.</span>
        </Aviso>
      )}

      <p className="text-center text-base text-texto-suave">
        Prefere mais anúncios todo mês?{" "}
        <Link href={LINK_PLANOS} className="inline-flex min-h-10 items-center font-semibold text-laranja-escuro underline underline-offset-4">
          Ver planos
        </Link>
      </p>
    </PaginaConta>
  );
}
