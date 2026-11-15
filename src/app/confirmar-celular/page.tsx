import type { Metadata } from "next";
import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { garantirPerfil } from "@/lib/perfil";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { LINK_ENTRAR_PERFIL } from "@/lib/rotas";
import { caminhoInterno } from "@/lib/caminho-seguro";
import { configuracaoWhatsapp } from "@/lib/whatsapp/servico";
import { ConfirmarWhatsapp } from "@/components/conta/confirmar-whatsapp";
import { Botao } from "@/components/ui/botao";
import { WHATSAPP_JA_VINCULADO } from "@/lib/erros";
import { Aviso } from "@/components/conta/aviso";
export const metadata: Metadata = { title: "Confirmar WhatsApp", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function ConfirmarCelular({ searchParams }: { searchParams: Promise<{ destino?: string | string[]; aviso?: string | string[] }> }) {
  const parametros = await searchParams;
  const solicitado = typeof parametros.destino === "string" ? caminhoInterno(parametros.destino) : null;
  const destino = solicitado && !solicitado.startsWith("/confirmar-celular") ? solicitado : "/minha-conta/dados";
  const { userId } = await auth();
  if (!userId) {
    const retorno = `/confirmar-celular?${new URLSearchParams({ destino })}`;
    redirect(`/entrar?redirect_url=${encodeURIComponent(retorno)}`);
  }
  await garantirPerfil();
  const conta = await meuPerfilEVitrine(true);
  const depoisDeConfirmar = new URL(destino, "https://olaki.invalid").pathname === LINK_ENTRAR_PERFIL
    ? destino : `${LINK_ENTRAR_PERFIL}?redirect_url=${encodeURIComponent(destino)}`;
  let siteKey = "";
  try { siteKey = configuracaoWhatsapp().siteKey; } catch { /* Indisponível: nunca aceitar um telefone sem confirmação. */ }
  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-5 sm:py-12">
    <Image src="/logo/mercado-da-regiao-marca.svg" alt="Mercado da Região" width={199} height={40} priority className="self-center" />
    <header><h1 className="text-titulo font-semibold text-beringela">Confirme seu WhatsApp</h1><p className="mt-1 text-sm text-texto-suave">Use um número seu para receber o código de confirmação e negociar.</p></header>
    {parametros.aviso === "numero_vinculado" && <Aviso tipo="atencao">{WHATSAPP_JA_VINCULADO} Use outro número ou procure o suporte.</Aviso>}
    {siteKey ? <ConfirmarWhatsapp siteKey={siteKey} destino={depoisDeConfirmar} numero={conta?.perfil.whatsapp ?? ""} /> : <div role="status" className="rounded-card bg-cartao p-5 shadow-1"><h2 className="font-bold">Confirmação temporariamente indisponível</h2><p className="mt-2">Não conseguimos enviar códigos agora. Seus dados continuam guardados. Tente novamente mais tarde.</p></div>}
    <nav aria-label="Opções de saída" className="flex flex-wrap items-center gap-2">
      <Botao href="/" variante="secundario" tamanho="toque">Explorar a vitrine</Botao>
      <SignOutButton redirectUrl="/">
        <Botao type="button" variante="texto" tamanho="toque">Sair da conta</Botao>
      </SignOutButton>
    </nav>
  </main>;
}
