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
      ? `Não pede mais nada. Você pode ter até ${pf.limite_anuncios} anúncios no ar de graça.`
      : "Não pede mais nada. Você já pode anunciar.";
  const partesTeste = [
    teste.dias ? `${teste.dias} dias grátis para testar` : "Teste grátis",
    teste.limite != null ? `até ${teste.limite} anúncios` : null,
  ].filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo font-semibold text-beringela">Como você quer vender?</h1>
        <p className="text-base text-texto-suave">Escolha uma opção. Dá para virar loja depois, sem perder seus anúncios.</p>
      </div>

      <section aria-labelledby="titulo-pf" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <h2 id="titulo-pf" className="text-lg font-semibold">Vender minhas coisas</h2>
        <p className="text-base text-texto-suave">{textoPf}</p>
        <BotaoVenderCoisas />
      </section>

      <section aria-labelledby="titulo-loja" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-selecao text-beringela" aria-hidden>
            <Store className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="titulo-loja" className="text-lg font-semibold">Tenho uma loja ou negócio</h2>
            <p className="text-base text-texto-suave">
              Vitrine própria com link para divulgar no Instagram e no WhatsApp, e o Radar de Negócios. {partesTeste.join(", ")}.
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
