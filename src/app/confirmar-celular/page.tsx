import type { Metadata } from "next";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { garantirPerfil } from "@/lib/perfil";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { caminhoInterno } from "@/lib/caminho-seguro";
import { configuracaoWhatsapp } from "@/lib/whatsapp/servico";
import { ConfirmarWhatsapp } from "@/components/conta/confirmar-whatsapp";
import { Botao } from "@/components/ui/botao";
import { ContatoSuporte } from "@/components/paginas/contato-suporte";
import { contatoEquipe } from "@/lib/dados/paginas";
import { WHATSAPP_JA_VINCULADO } from "@/lib/erros";
import { Aviso } from "@/components/conta/aviso";
export const metadata: Metadata = { title: "Confirmar WhatsApp", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function ConfirmarCelular({ searchParams }: { searchParams: Promise<{ destino?: string; aviso?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/entrar?redirect_url=%2Fconfirmar-celular");
  await garantirPerfil();
  const conta = await meuPerfilEVitrine(true);
  const contato = await contatoEquipe(conta?.perfil.microrregiao_id ?? null);
  const parametros = await searchParams;
  const solicitado = caminhoInterno(parametros.destino);
  const destino = solicitado && !solicitado.startsWith("/confirmar-celular") ? solicitado : "/minha-conta/dados";
  let siteKey = "";
  try { siteKey = configuracaoWhatsapp().siteKey; } catch { /* Indisponível: nunca aceitar um telefone sem confirmação. */ }
  return <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-8 sm:py-12">
    <Image src="/logo/olaki-marca.svg" alt="OL-AKI" width={110} height={45} priority className="self-center" />
    <header><h1 className="text-titulo font-semibold text-beringela">Confirme seu WhatsApp</h1><p className="mt-2 text-texto-suave">Para concluir seu cadastro e negociar, precisamos confirmar que você tem acesso a este número.</p></header>
    {parametros.aviso === "numero_vinculado" && <Aviso tipo="atencao">{WHATSAPP_JA_VINCULADO} Use outro número ou procure o suporte.</Aviso>}
    {siteKey ? <ConfirmarWhatsapp siteKey={siteKey} destino={destino} numero={conta?.perfil.whatsapp ?? ""} /> : <div role="status" className="rounded-card bg-cartao p-5 shadow-1"><h2 className="font-bold">Confirmação temporariamente indisponível</h2><p className="mt-2">Não conseguimos enviar códigos agora. Seus dados continuam guardados. Tente novamente mais tarde.</p></div>}
    <ContatoSuporte contato={contato} />
    <Botao href="/" variante="texto">Voltar ao início</Botao>
  </main>;
}
