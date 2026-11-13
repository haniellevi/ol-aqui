import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, Store } from "lucide-react";
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
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-2.5 py-4 md:gap-5 md:px-4 md:py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-beringela">Como você quer vender?</h1>
        <p className="text-sm text-texto-suave md:text-base">Você pode criar uma loja depois e manter seus anúncios.</p>
      </div>

      <section aria-labelledby="titulo-pf" className="flex flex-col gap-2 rounded-card bg-cartao p-3 md:gap-3 md:p-4 shadow-1">
        <h2 id="titulo-pf" className="text-base font-semibold md:text-lg">Vender minhas coisas</h2>
        <p className="text-sm text-texto-suave md:text-base">{textoPf}</p>
        <BotaoVenderCoisas />
      </section>

      <section aria-labelledby="titulo-loja" className="flex flex-col gap-2 rounded-card bg-cartao p-3 md:gap-3 md:p-4 shadow-1">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 md:size-10 place-items-center rounded-full bg-selecao text-beringela" aria-hidden>
            <Store className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="titulo-loja" className="text-base font-semibold md:text-lg">Tenho uma loja ou negócio</h2>
            <p className="text-sm text-texto-suave md:text-base">
              Vitrine para divulgar seus anúncios e acesso ao Radar. {partesTeste.join(", ")}.
            </p>
          </div>
        </div>
        <Botao href="/quero-vender/loja" variante="secundario" larguraTotal>
          Criar minha loja
          <ChevronRight className="size-5" aria-hidden />
        </Botao>
      </section>

      <p className="text-center text-base text-texto-suave">
        Só quer comprar?{" "}
        <Link href="/" className="font-semibold text-laranja-escuro underline underline-offset-4">
          Voltar ao início
        </Link>
      </p>
    </main>
  );
}
