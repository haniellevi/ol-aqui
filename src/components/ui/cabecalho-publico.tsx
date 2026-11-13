import Image from "next/image";
import { SinoAvisos } from "@/components/conta/sino-avisos";
import { IconeConversas } from "@/components/conversas/icone-conversas";
import { conversasLigadas } from "@/lib/dados/conversas";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Plus, Radar, UserRound } from "lucide-react";
import { CampoBusca } from "@/components/busca/campo-busca";
import { listarCidadesAtivas, regiaoAtual } from "@/lib/dados/regiao";
import { classesBotao } from "@/components/ui/botao";
import { MenuCidades } from "./menu-cidades";

// Cabeçalho das páginas públicas e da conta: logo, cidade ("Corrente ▾") e Entrar/Conta.
// No computador mostra também a busca sempre à vista, Radar e Anunciar (a barra de baixo some).

const LINK = "inline-flex h-10 items-center gap-2 rounded-campo px-3 text-rotulo font-semibold text-beringela hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro";

/**
 * O login só pode ser lido onde o middleware do Clerk rodou. Endereços que ele não cobre (ex.: um .png
 * inexistente, que cai na página "não encontrada") fazem o auth() lançar erro; aí o cabeçalho mostra
 * "Entrar", como para um visitante, em vez de usar SignedIn/SignedOut (que chamariam o auth()).
 */
async function loginLegivel(): Promise<boolean> {
  try {
    await auth();
    return true;
  } catch {
    return false;
  }
}

export async function CabecalhoPublico() {
  const [regiao, cidades, comLogin] = await Promise.all([regiaoAtual(), listarCidadesAtivas().catch(() => []), loginLegivel()]);
  const comConversas = comLogin && (await conversasLigadas());
  const cidade = regiao?.cidade ?? regiao?.cidadeSede ?? regiao?.nome ?? null;

  return (
    <header className="cabecalho-publico olaki-material sticky top-0 z-30">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-50 focus:rounded-card focus:bg-laranja focus:px-4 focus:py-3 focus:font-bold focus:text-beringela">
        Pular para o conteúdo
      </a>
      <div className="linha-cabecalho mx-auto flex h-13 max-w-7xl items-center gap-2 px-4 md:h-14">
        <Link href="/" className="flex h-10 shrink-0 items-center rounded-card focus-visible:outline-3 focus-visible:outline-laranja-escuro" aria-label="Mercado da Região, página inicial">
          <Image src="/logo/mercado-da-regiao-marca.svg" alt="Mercado da Região" width={98} height={36} priority className="h-7 w-auto sm:h-8" />
        </Link>

        <MenuCidades cidade={cidade} regiao={regiao?.id} cidades={cidades} />

        <div className="ml-2 hidden min-w-0 max-w-xl flex-1 md:block">
          <CampoBusca id="busca-topo" sugestoes regiao={`${regiao?.id ?? ""}|${cidade ?? ""}`} />
        </div>

        <nav aria-label="Principal" className="ml-auto hidden items-center gap-1 md:flex">
          <Link href="/radar" className={LINK}>
            <Radar className="size-5" aria-hidden /> Radar
          </Link>
          <Link href="/anunciar" className={classesBotao("primario", false, "ml-1")}>
            <Plus className="size-5" aria-hidden /> Anunciar
          </Link>
        </nav>

        <div className="conta-cabecalho ml-auto flex shrink-0 items-center md:ml-1">
          {!comLogin ? (
            <Link href="/entrar" className={LINK}>
              <UserRound className="size-5" aria-hidden /> Entrar
            </Link>
          ) : (
            <>
              <SignedOut>
                <Link href="/entrar" className={LINK}>
                  <UserRound className="size-5" aria-hidden /> Entrar
                </Link>
              </SignedOut>
              <SignedIn>
                {comConversas && <IconeConversas />}
                <SinoAvisos />
                <Link href="/minha-conta" aria-label="Minha conta" className={LINK}>
                  <UserRound className="size-5" aria-hidden /> <span className="hidden sm:inline">Conta</span>
                </Link>
              </SignedIn>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
