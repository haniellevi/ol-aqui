import { Botao } from "@/components/ui/botao";

export default function NaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="text-texto-suave">O endereço pode estar errado ou o conteúdo saiu do ar.</p>
      <Botao href="/" variante="texto">Voltar ao início</Botao>
    </main>
  );
}
