import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { FileText } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { garantirPerfil } from "@/lib/perfil";
import { termosPendentes } from "@/lib/dados/paginas";
import { linkDocumentoLegal, LINK_ENTRAR_PERFIL } from "@/lib/rotas";
import { NOME_DOCUMENTO } from "@/lib/tipos-paginas";
import { caminhoInterno } from "@/lib/caminho-seguro";
import { BotaoAceitarTermos } from "./botao-aceitar";

// T13 (parte dos termos) · Conta nova cai aqui depois de criar a conta (Clerk: signUpForceRedirectUrl,
// levando junto o redirect_url de onde a pessoa vinha).
// Mostra as versões no ar dos termos e da privacidade e pede o aceite. Quem já aceitou segue direto.
// Nome e cidade a pessoa ajusta em Minha conta > Meus dados.

export const metadata: Metadata = { title: "Termos e privacidade", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Só caminho interno ("/..."), nunca outro site (nem "/\\site.com"). */
function destinoSeguro(v: string | string[] | undefined) {
  const t = caminhoInterno(Array.isArray(v) ? v[0] : v);
  return t && !t.startsWith(LINK_ENTRAR_PERFIL) && !t.startsWith("/entrar") ? t : "/";
}

export default async function CompletarPerfil({ searchParams }: { searchParams: Promise<{ redirect_url?: string | string[] }> }) {
  const destino = destinoSeguro((await searchParams).redirect_url);
  const { userId } = await auth();
  if (!userId) redirect(`/entrar?redirect_url=${encodeURIComponent(destino)}`);
  await garantirPerfil(); // 1º acesso: cria o perfil se o webhook do Clerk ainda não chegou
  const conta = await meuPerfilEVitrine(true);
  if (!conta?.perfil.whatsapp || !conta.perfil.whatsapp_verificado_em) redirect(`/confirmar-celular?destino=${encodeURIComponent(`/completar-perfil?redirect_url=${encodeURIComponent(destino)}`)}`);
  const pendentes = await termosPendentes();
  if (pendentes.length === 0) redirect(destino);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-5 sm:py-10">
      <Image src="/logo/mercado-da-regiao-marca.svg" alt="Mercado da Região" width={110} height={40} priority className="self-center" />
      <header className="flex flex-col gap-1">
        <h1 className="text-titulo font-semibold text-beringela">Termos e privacidade</h1>
        <p className="text-sm text-texto-suave">
          Leia os documentos antes de aceitar.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {pendentes.map((p) => (
          <li key={p.id}>
            <Link
              href={linkDocumentoLegal(p.tipo)}
              target="_blank"
              className="flex min-h-11 items-center gap-2 rounded-card bg-cartao px-3 py-2 shadow-1 hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
            >
              <FileText className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
              <span className="text-base font-semibold">{NOME_DOCUMENTO[p.tipo]}</span>
            </Link>
          </li>
        ))}
      </ul>

      <BotaoAceitarTermos ids={pendentes.map((p) => p.id)} destino={destino} adiarHref={destino.startsWith("/assistente?") ? "/" : destino} />
    </main>
  );
}
