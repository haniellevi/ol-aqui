import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ChevronDown, Wrench } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Aviso } from "@/components/conta/aviso";
import { codigoEquipeConfigurado, manutencaoLigada } from "@/lib/manutencao";
import { liberarEquipe } from "./actions";

export const metadata: Metadata = { title: "Em manutenção", robots: { index: false } };
export const dynamic = "force-dynamic";

// Site em manutenção (MANUTENCAO=1). Sem cabeçalho nem login: ninguém entra até a equipe abrir o site.
export default async function Manutencao({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (!manutencaoLigada()) redirect("/");
  const { erro } = await searchParams;

  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-8 sm:py-12">
      <Image src="/logo/mercado-da-regiao-marca.svg" alt="Mercado da Região" width={123} height={45} priority className="self-center" />
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-selecao text-beringela" aria-hidden>
          <Wrench className="size-8" />
        </span>
        <h1 className="text-titulo font-semibold text-beringela">Estamos fazendo uma melhoria</h1>
        <p className="text-base text-texto-suave">
          O site volta em poucos minutos. Sua conta, sua loja e seus anúncios estão guardados.
        </p>
      </header>
      <details className="group text-legenda text-texto-suave" open={Boolean(erro)}>
        <summary className="olaki-controle flex min-h-10 cursor-pointer items-center gap-2 rounded-campo font-semibold underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">
          <ChevronDown className="size-3.5 group-open:rotate-180" aria-hidden />
          Sou da equipe
        </summary>
        <form action={liberarEquipe} className="mt-3 flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
          {!codigoEquipeConfigurado() ? (
            <Aviso tipo="atencao">O código da equipe não está configurado. Na Vercel, MANUTENCAO_CODIGO precisa ter 16 caracteres ou mais.</Aviso>
          ) : (
            erro && <Aviso tipo="erro">O código está incorreto. Confira e tente de novo.</Aviso>
          )}
          <Campo rotulo="Código da equipe" name="codigo" type="password" required autoComplete="off" maxLength={200} autoFocus={Boolean(erro)} />
          <Botao type="submit" larguraTotal>Entrar no site</Botao>
        </form>
      </details>
    </main>
  );
}
