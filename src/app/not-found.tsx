import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="text-neutral-600">O endereço pode estar errado ou o conteúdo saiu do ar.</p>
      <Link href="/" className="font-semibold text-laranja-escuro underline">Voltar ao início</Link>
    </main>
  );
}
