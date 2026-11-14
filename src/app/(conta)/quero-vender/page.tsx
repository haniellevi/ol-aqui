import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, Package, Store } from "lucide-react";
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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2 sm:text-center">
        <h1 className="text-2xl leading-tight font-bold text-beringela sm:text-3xl">Como você quer vender?</h1>
        <p className="text-sm text-texto-suave sm:text-base">Você pode criar uma loja depois e manter seus anúncios.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="titulo-pf" className="flex min-w-0 flex-col gap-4 rounded-card border border-borda bg-cartao p-5 shadow-1 sm:p-6">
          <span className="grid size-12 place-items-center rounded-campo bg-selecao text-beringela" aria-hidden>
            <Package className="size-6" />
          </span>
          <div className="flex flex-1 flex-col gap-2">
            <h2 id="titulo-pf" className="text-lg font-semibold text-beringela">Vender minhas coisas</h2>
            <p className="text-sm text-texto-suave sm:text-base">{textoPf}</p>
          </div>
          <BotaoVenderCoisas />
        </section>

        <section aria-labelledby="titulo-loja" className="flex min-w-0 flex-col gap-4 rounded-card border border-beringela/20 bg-selecao p-5 shadow-1 sm:p-6">
          <span className="grid size-12 place-items-center rounded-campo bg-beringela/10 text-beringela" aria-hidden>
            <Store className="size-6" />
          </span>
          <div className="flex flex-1 flex-col gap-2">
            <h2 id="titulo-loja" className="text-lg font-semibold text-beringela">Tenho uma loja ou negócio</h2>
            <p className="text-sm text-texto-suave sm:text-base">
              Vitrine própria. {partesTeste.join(", ")}.
            </p>
            <p className="text-sm text-texto-suave">Responder no Radar requer loja verificada e plano com Radar ou cortesia da equipe.</p>
          </div>
          <Botao href="/quero-vender/loja" variante="secundario" larguraTotal>
            Criar minha loja
            <ChevronRight className="size-5" aria-hidden />
          </Botao>
        </section>
      </div>

      <p className="text-center text-base text-texto-suave">
        Só quer comprar?{" "}
        <Link href="/" className="font-semibold text-laranja-escuro underline underline-offset-4">
          Voltar ao início
        </Link>
      </p>
    </main>
  );
}
