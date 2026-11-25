import { formatarNome } from "@/lib/formatar-nome";
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
import { FormAceitarConvite } from "./form-aceitar";

export const metadata: Metadata = {
  title: "Convite para gerenciar loja",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function ConviteLoja({ searchParams }: { searchParams: Promise<{ codigo?: string | string[] }> }) {
  const { codigo } = await searchParams;
  if (typeof codigo !== "string" || !ehUuid(codigo)) {
    return <PaginaConta><TopoConta titulo="Convite inválido" voltar="/" textoVoltar="Voltar ao início" texto="Peça um novo link ao dono da loja." /><Botao href="/ajuda" variante="texto">Preciso de ajuda com o convite</Botao></PaginaConta>;
  }

  const destino = `/convite-loja?codigo=${codigo}`;
  const retorno = `?redirect_url=${encodeURIComponent(destino)}`;
  const { userId } = await auth();
  if (!userId) {
    return (
      <PaginaConta>
        <TopoConta titulo="Convite para gerenciar uma loja" voltar="/" textoVoltar="Voltar ao início"
          texto="Entre ou crie sua conta no Mercado da Região. Confirme o mesmo WhatsApp informado por quem enviou o convite." />
        <p className="text-base text-texto-suave">Depois de entrar, confirme seu WhatsApp e confira a loja antes de aceitar. Os dados do convite aparecem apenas para a conta autorizada.</p>
        <Botao href={`/entrar${retorno}`} tamanho="acao" larguraTotal>Entrar ou criar conta</Botao>
        <Botao href="/ajuda" variante="texto">Preciso de ajuda com o convite</Botao>
      </PaginaConta>
    );
  }

  await garantirPerfil();
  const [conta, pendentes] = await Promise.all([meuPerfilEVitrine(true), termosPendentes()]);
  if (!conta?.perfil.whatsapp || !conta.perfil.whatsapp_verificado_em || pendentes.length) redirect(`/completar-perfil${retorno}`);
  const db = await createClient();
  const { data, error } = await db.rpc("convite_gerente_loja", { p_token: codigo }).maybeSingle<{ nome: string }>();

  return (
    <PaginaConta>
      <TopoConta titulo={data ? `Gerenciar ${formatarNome(data.nome)}` : "Convite para gerenciar uma loja"} voltar="/" textoVoltar="Voltar ao início" />
      {error ? <Aviso tipo="erro">Não foi possível consultar o convite. Atualize a página para tentar novamente.</Aviso>
        : data ? (
          <>
            <p>Ao aceitar, você poderá editar endereço, horários, descrição e informações de entrega da vitrine.</p>
            <FormAceitarConvite codigo={codigo} />
          </>
        ) : (
          <>
            <Aviso tipo="atencao">O convite venceu, foi cancelado ou pertence a outro WhatsApp.</Aviso>
            <SignOutButton redirectUrl={destino}>
              <Botao type="button" variante="secundario">Entrar com outra conta</Botao>
            </SignOutButton>
          </>
        )}
      <Botao href="/ajuda" variante="texto">Preciso de ajuda com o convite</Botao>
    </PaginaConta>
  );
}
