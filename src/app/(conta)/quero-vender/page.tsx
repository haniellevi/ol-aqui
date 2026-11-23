import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Package, Store } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { BotaoVenderCoisas } from "@/components/anunciar/botao-vender-coisas";
import { planoInicialPf, testeGratis } from "./_dados";

export const metadata: Metadata = { title: "Quero vender" };

// T14 · Quero vender: duas escolhas grandes. Quem já vende vai direto para o Anunciar.
export default async function PaginaQueroVender() {
  const conta = await meuPerfilEVitrine();
  if (!conta) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Vazio titulo="Algo deu errado" texto="Não conseguimos abrir sua conta agora. Tente de novo.">
          <Botao href="/quero-vender" larguraTotal>Tentar de novo</Botao>
        </Vazio>
      </main>
    );
  }
  if (conta.vitrine) redirect("/anunciar");

  const regiao = conta.perfil.microrregiao_id;
  const [pf, teste] = await Promise.all([planoInicialPf(regiao), testeGratis(regiao)]);
  const textoPf =
    pf?.limite_anuncios != null
      ? `Até ${pf.limite_anuncios} anúncios grátis no ar.`
      : "Comece a anunciar com sua conta atual.";
  const partesTeste = [
    teste.dias ? `${teste.dias} dias grátis para testar` : "Teste grátis",
    teste.limite != null ? `até ${teste.limite} anúncios` : null,
  ].filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-4 sm:px-6 sm:py-7">
      <Botao href="/" variante="texto" tamanho="toque" icone={<ArrowLeft />} className="-ml-3">
        Voltar ao início
      </Botao>
      <header>
        <h1 className="text-titulo leading-tight font-semibold text-beringela">Como você quer vender?</h1>
        <p className="mt-1 text-sm text-texto-suave">Você pode criar uma loja depois e manter seus anúncios.</p>
      </header>

      <div className="w-full divide-y divide-borda rounded-card border border-borda bg-cartao">
        <section aria-labelledby="titulo-pf" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-campo bg-selecao text-beringela" aria-hidden>
              <Package className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="titulo-pf" className="text-lg font-semibold text-beringela">Venda particular</h2>
              <p className="mt-0.5 text-sm text-texto-suave">{textoPf}</p>
            </div>
          </div>
          <div className="sm:w-48 sm:shrink-0"><BotaoVenderCoisas /></div>
        </section>

        <section aria-labelledby="titulo-loja" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-campo bg-selecao text-beringela" aria-hidden>
              <Store className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="titulo-loja" className="text-lg font-semibold text-beringela">Loja ou negócio</h2>
              <p className="mt-0.5 text-sm text-texto-suave">Vitrine própria. {partesTeste.join(", ")}.</p>
            </div>
          </div>
          <Botao href="/quero-vender/loja" variante="secundario" tamanho="toque" className="w-full sm:w-48 sm:shrink-0">
            Criar minha loja
          </Botao>
        </section>
      </div>
      <p className="text-legenda leading-relaxed text-texto-suave">Para responder no Radar, a loja precisa ser verificada e ter acesso pelo plano ou por cortesia.</p>
    </main>
  );
}
