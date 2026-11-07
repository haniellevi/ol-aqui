import Image from "next/image";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ChevronDown, MapPin, Plus, Radar, Search, UserRound } from "lucide-react";
import { regiaoAtual } from "@/lib/dados/regiao";
import { classesBotao } from "@/components/ui/botao";

// Cabeçalho das páginas públicas e da conta: logo, cidade ("Corrente ▾") e Entrar/Conta.
// No computador mostra também Buscar, Radar e Anunciar (a barra de baixo some).

/** Para onde vai o toque na cidade (a tela T1 "Escolher cidade" vem depois). */
export const HREF_ESCOLHER_CIDADE = "/?cidade=escolher";

const LINK = "inline-flex h-12 items-center gap-2 rounded-card px-3 text-base font-semibold text-texto hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro";

export async function CabecalhoPublico() {
  const regiao = await regiaoAtual();
  const cidade = regiao?.cidade ?? regiao?.cidadeSede ?? regiao?.nome ?? null;

  return (
    <header className="sticky top-0 z-30 border-b border-borda bg-cartao/95 backdrop-blur supports-[backdrop-filter]:bg-cartao/85">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-card focus:bg-laranja focus:px-4 focus:py-3 focus:font-bold focus:text-beringela">
        Pular para o conteúdo
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="flex h-12 shrink-0 items-center rounded-card focus-visible:outline-3 focus-visible:outline-laranja-escuro" aria-label="OLAKI, página inicial">
          <Image src="/logo/olaki-marca.svg" alt="OLAKI" width={88} height={36} priority className="h-8 w-auto sm:h-9" />
        </Link>

        {cidade && (
          <Link
            href={HREF_ESCOLHER_CIDADE}
            className="ml-1 inline-flex h-12 min-w-0 items-center gap-1 rounded-campo border border-borda bg-cartao px-3 text-[15px] font-semibold text-texto hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
            aria-label={`Cidade: ${cidade}. Trocar cidade`}
          >
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{cidade}</span>
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          </Link>
        )}

        <nav aria-label="Principal" className="ml-auto hidden items-center gap-1 md:flex">
          <Link href="/busca" className={LINK}>
            <Search className="size-5" aria-hidden /> Buscar
          </Link>
          <Link href="/radar" className={LINK}>
            <Radar className="size-5" aria-hidden /> Radar
          </Link>
          <Link href="/anunciar" className={classesBotao("primario", false, "ml-1")}>
            <Plus className="size-5" aria-hidden /> Anunciar
          </Link>
        </nav>

        <div className="ml-auto md:ml-1">
          <SignedOut>
            <Link href="/entrar" className={LINK}>
              <UserRound className="size-5" aria-hidden /> Entrar
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/minha-conta" className={LINK}>
              <UserRound className="size-5" aria-hidden /> Conta
            </Link>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
