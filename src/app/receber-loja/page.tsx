import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { garantirPerfil } from "@/lib/perfil";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { termosPendentes } from "@/lib/dados/paginas";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { Botao } from "@/components/ui/botao";
import { FormReceberLoja } from "./form-receber";

// Etapa P5c: o dono abre o link que a equipe mandou e recebe a loja montada para ele.
export const metadata: Metadata = {
  title: "Receber sua loja",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

type Convite = { loja_id: string; nome: string; cidade: string | null; prontos: number; ja_vende: boolean; aceito: boolean };

export default async function ReceberLoja({ searchParams }: { searchParams: Promise<{ codigo?: string | string[] }> }) {
  const { codigo } = await searchParams;
  if (typeof codigo !== "string" || !ehUuid(codigo)) {
    return <PaginaConta><TopoConta titulo="Convite inválido" voltar={null} texto="Peça um novo link à equipe Mercado da Região." /></PaginaConta>;
  }

  const destino = `/receber-loja?codigo=${codigo}`;
  const retorno = `?redirect_url=${encodeURIComponent(destino)}`;
  const { userId } = await auth();
  if (!userId) {
    return (
      <PaginaConta>
        <TopoConta titulo="Sua loja no Mercado da Região" voltar={null}
          texto="A equipe montou uma loja para você. Entre ou crie sua conta com o mesmo WhatsApp que recebeu este link." />
        <Botao href={`/entrar${retorno}`} larguraTotal>Entrar ou criar conta</Botao>
      </PaginaConta>
    );
  }

  await garantirPerfil();
  const [conta, pendentes] = await Promise.all([meuPerfilEVitrine(true), termosPendentes()]);
  if (!conta?.perfil.whatsapp || !conta.perfil.whatsapp_verificado_em || pendentes.length) redirect(`/completar-perfil${retorno}`);
  const db = await createClient();
  const { data, error } = await db.rpc("convite_dono_loja", { p_token: codigo }).maybeSingle<Convite>();

  return (
    <PaginaConta>
      <TopoConta titulo={data ? `Receber ${data.nome}` : "Sua loja no Mercado da Região"} voltar={null} />
      {error ? <Aviso tipo="erro">Não foi possível consultar o convite. Atualize a página para tentar novamente.</Aviso>
        : data?.aceito ? (
          <>
            <Aviso tipo="ok">Você já recebeu esta loja.</Aviso>
            <Botao href="/minha-conta/loja" larguraTotal>Abrir minha loja</Botao>
          </>
        ) : data?.ja_vende ? (
          <Aviso tipo="atencao">
            Você já vende no Mercado da Região, e cada conta tem uma loja só.
            <span className="font-normal">Fale com a equipe para receber esta loja.</span>
          </Aviso>
        ) : data ? (
          <>
            <p>
              A equipe montou a loja <strong>{data.nome}</strong>{data.cidade ? ` em ${data.cidade}` : ""} para você.
              Ao receber, ela passa a ser sua, com o seu WhatsApp, e vai ao ar.
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
              <li>O teste grátis começa hoje.</li>
              {data.prontos > 0 && (
                <li>{data.prontos === 1 ? "1 produto pronto vai ao ar" : `${data.prontos} produtos prontos vão ao ar`} depois da conferência de sempre.</li>
              )}
            </ul>
            <FormReceberLoja codigo={codigo} />
          </>
        ) : (
          <>
            <Aviso tipo="atencao">O convite venceu, foi cancelado ou pertence a outro WhatsApp.</Aviso>
            <SignOutButton redirectUrl={destino}>
              <Botao type="button" variante="secundario">Entrar com outra conta</Botao>
            </SignOutButton>
          </>
        )}
    </PaginaConta>
  );
}
