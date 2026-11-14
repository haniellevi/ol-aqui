import type { Metadata } from "next";
import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { garantirPerfil } from "@/lib/perfil";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { caminhoInterno } from "@/lib/caminho-seguro";
import { configuracaoWhatsapp } from "@/lib/whatsapp/servico";
import { ConfirmarWhatsapp } from "@/components/conta/confirmar-whatsapp";
import { Botao } from "@/components/ui/botao";
import { WHATSAPP_JA_VINCULADO } from "@/lib/erros";
import { Aviso } from "@/components/conta/aviso";
export const metadata: Metadata = { title: "Confirmar WhatsApp", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function ConfirmarCelular({ searchParams }: { searchParams: Promise<{ destino?: string | string[]; aviso?: string | string[] }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/entrar?redirect_url=%2Fconfirmar-celular");
  await garantirPerfil();
  const conta = await meuPerfilEVitrine(true);
  const parametros = await searchParams;
  const solicitado = typeof parametros.destino === "string" ? caminhoInterno(parametros.destino) : null;
  const destino = solicitado && !solicitado.startsWith("/confirmar-celular") ? solicitado : "/minha-conta/dados";
  let siteKey = "";
  try { siteKey = configuracaoWhatsapp().siteKey; } catch { /* Indisponível: nunca aceitar um telefone sem confirmação. */ }
  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-8 sm:py-12">
    <Image src="/logo/mercado-da-regiao-marca.svg" alt="Mercado da Região" width={123} height={45} priority className="self-center" />
    <header><h1 className="text-titulo font-semibold text-beringela">Confirme seu WhatsApp</h1><p className="mt-2 text-texto-suave">Para concluir seu cadastro e negociar, precisamos confirmar que você tem acesso a este número. Você pode explorar a vitrine enquanto isso.</p></header>
    <nav aria-label="Opções de saída" className="flex flex-wrap items-center justify-between gap-2">
      <Botao href="/" variante="secundario">Explorar a vitrine</Botao>
      <SignOutButton redirectUrl="/">
        <Botao type="button" variante="texto">Sair da conta</Botao>
      </SignOutButton>
    </nav>
    {parametros.aviso === "numero_vinculado" && <Aviso tipo="atencao">{WHATSAPP_JA_VINCULADO} Use outro número ou procure o suporte.</Aviso>}
    {siteKey ? <ConfirmarWhatsapp siteKey={siteKey} destino={destino} numero={conta?.perfil.whatsapp ?? ""} /> : <div role="status" className="rounded-card bg-cartao p-5 shadow-1"><h2 className="font-bold">Confirmação temporariamente indisponível</h2><p className="mt-2">Não conseguimos enviar códigos agora. Seus dados continuam guardados. Tente novamente mais tarde.</p></div>}
  </main>;
}
