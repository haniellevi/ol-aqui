import Image from "next/image";
import Link from "next/link";
import { LINK_AJUDA, LINK_PLANOS, LINK_PRIVACIDADE, LINK_TERMOS } from "@/lib/rotas";

// Rodapé do Início: marca com a frase (docs/MARCA.md) e os textos de ajuda.
// O acesso às lojas fica na seção de lojas (um único link "/lojas" na página).

const LINKS = [
  { href: LINK_AJUDA, texto: "Ajuda e segurança", destaque: true },
  { href: LINK_PLANOS, texto: "Planos", destaque: false },
  { href: LINK_TERMOS, texto: "Termos de uso", destaque: false },
  { href: LINK_PRIVACIDADE, texto: "Privacidade", destaque: false },
];

export function RodapeInicio() {
  return (
    <footer className="flex flex-col gap-3 border-t border-borda pt-4 max-md:order-last md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-1">
        <Image src="/logo/mercado-da-regiao-marca.svg" alt="Mercado da Região" width={98} height={36} className="h-7 w-auto self-start" />
        <p className="text-base text-texto-suave">aqui a sua cidade aparece.</p>
      </div>
      <nav aria-label="Ajuda e textos" className="grid grid-cols-2 gap-x-4 text-base md:flex md:gap-x-6">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`inline-flex min-h-10 items-center underline-offset-4 hover:underline ${l.destaque ? "font-semibold text-laranja-escuro" : "text-texto-suave"}`}
          >
            {l.texto}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
