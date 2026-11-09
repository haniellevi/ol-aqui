import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { FileText } from "lucide-react";
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

export const metadata: Metadata = { title: "Falta só um passo", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Só caminho interno ("/..."), nunca outro site (nem "/\\site.com"). */
function destinoSeguro(v: string | string[] | undefined) {
  const t = caminhoInterno((Array.isArray(v) ? v[0] : v)?.slice(0, 300));
  return t && !t.startsWith(LINK_ENTRAR_PERFIL) && !t.startsWith("/entrar") ? t : "/";
}

export default async function CompletarPerfil({ searchParams }: { searchParams: Promise<{ redirect_url?: string | string[] }> }) {
  const destino = destinoSeguro((await searchParams).redirect_url);
  const { userId } = await auth();
  if (!userId) redirect(`/entrar?redirect_url=${encodeURIComponent(destino)}`);
  await garantirPerfil(); // 1º acesso: cria o perfil se o webhook do Clerk ainda não chegou
  const pendentes = await termosPendentes();
  if (pendentes.length === 0) redirect(destino);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <Image src="/logo/olaki-marca.svg" alt="OLAKI" width={110} height={45} priority className="self-center" />
      <header className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold leading-7">Falta só um passo</h1>
        <p className="text-base text-texto-suave">
          Para usar o OLAKI, leia as regras e como cuidamos dos seus dados. Depois toque em <strong className="font-semibold text-texto">Aceitar e continuar</strong>.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {pendentes.map((p) => (
          <li key={p.id}>
            <Link
              href={linkDocumentoLegal(p.tipo)}
              target="_blank"
              className="flex min-h-14 items-center gap-3 rounded-card bg-cartao px-4 py-3 shadow-1 hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
            >
              <FileText className="size-6 shrink-0 text-laranja-escuro" aria-hidden />
              <span className="flex flex-col">
                <span className="text-base font-semibold">{NOME_DOCUMENTO[p.tipo]}</span>
                <span className="text-[13px] text-texto-suave">
                  Versão {p.versao} · abre em outra aba
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <BotaoAceitarTermos ids={pendentes.map((p) => p.id)} destino={destino} />
    </main>
  );
}
