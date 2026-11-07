import Image from "next/image";
import Link from "next/link";

// Página provisória. A home de verdade (busca, categorias, destaques) vem na próxima etapa.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <Image src="/logo/olaki-opcao1-pin.svg" alt="OLAKI" width={320} height={113} priority />
      <p className="text-neutral-600">Em breve na sua região. Compre, venda e peça no Radar de Negócios.</p>
      <div className="flex gap-3">
        <Link href="/radar" className="inline-flex h-12 items-center rounded-full bg-laranja px-6 font-semibold text-marinho">
          Radar de Negócios
        </Link>
        <Link href="/entrar" className="inline-flex h-12 items-center rounded-full border border-neutral-300 px-6 font-semibold">
          Entrar
        </Link>
      </div>
    </main>
  );
}
