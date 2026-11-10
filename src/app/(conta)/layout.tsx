import { redirect } from "next/navigation";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { auth } from "@clerk/nextjs/server";
import { garantirPerfil } from "@/lib/perfil";
import { CabecalhoPublico } from "@/components/ui/cabecalho-publico";
import { BarraInferior } from "@/components/ui/barra-inferior";
import { BalaoAki } from "@/components/aki/balao-aki";
import { AvisoTermos } from "@/components/paginas/aviso-termos";

// Área da conta (anunciar, quero vender, minha conta, destacar): exige login.
// O middleware já manda para /entrar?redirect_url=...; aqui é a segunda barreira.
// Nunca guardada em cache: dado de uma pessoa não aparece para outra.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function LayoutConta({ children }: { children: React.ReactNode }) {
  await auth.protect();
  await garantirPerfil(); // 1º acesso: cria o perfil se o webhook do Clerk ainda não chegou
  const conta = await meuPerfilEVitrine(true);
  if (!conta?.perfil.whatsapp || !conta.perfil.whatsapp_verificado_em) redirect("/confirmar-celular");
  return (
    <>
      <CabecalhoPublico />
      <div id="conteudo" className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <AvisoTermos />
        {children}
      </div>
      <BarraInferior />
      <BalaoAki />
    </>
  );
}
