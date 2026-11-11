import type { Metadata } from "next";
import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Botao } from "@/components/ui/botao";
import { Aviso } from "@/components/conta/aviso";
import { cancelarExclusao } from "./actions";

export const metadata: Metadata = { title: "Conta em exclusão", robots: { index: false } };
export const dynamic = "force-dynamic";

// Conta na lixeira (30 dias). O acesso ao resto do site fica fechado até cancelar.
export default async function ContaEmExclusao({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/entrar?redirect_url=%2Fconta-em-exclusao");
  const db = await createClient();
  const { data } = await db.rpc("minha_exclusao_pendente");
  const pendente = data as { apagar_apos: string; pode_cancelar: boolean } | null;
  if (!pendente) redirect("/minha-conta");
  const data_ = new Date(pendente.apagar_apos).toLocaleDateString("pt-BR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "America/Fortaleza",
  });
  const { erro } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-8 sm:py-12">
      <Image src="/logo/mercado-da-regiao-marca.svg" alt="Mercado da Região" width={123} height={45} priority className="self-center" />
      <header>
        <h1 className="text-titulo font-semibold text-beringela">Sua conta está para ser excluída</h1>
        <p className="mt-2 text-texto-suave">
          Sua conta, sua loja e seus anúncios estão fora do ar. Eles serão apagados de vez em <strong>{data_}</strong>.
        </p>
      </header>
      {erro && <Aviso tipo="atencao">Não deu para cancelar agora. Tente de novo em alguns minutos.</Aviso>}
      {pendente.pode_cancelar ? (
        <form action={cancelarExclusao} className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
          <h2 className="text-lg font-semibold">Mudou de ideia?</h2>
          <p>Cancele a exclusão e tudo volta como estava: conta, loja e anúncios.</p>
          <Botao type="submit" larguraTotal>Cancelar a exclusão</Botao>
        </form>
      ) : (
        <Aviso tipo="atencao">Esta exclusão foi feita pela equipe. Para pedir revisão, fale com o suporte.</Aviso>
      )}
      <nav aria-label="Opções de saída" className="flex flex-wrap items-center justify-between gap-2">
        <Botao href="/ajuda" variante="texto">Central de ajuda</Botao>
        <SignOutButton redirectUrl="/">
          <Botao type="button" variante="secundario">Sair da conta</Botao>
        </SignOutButton>
      </nav>
    </main>
  );
}
