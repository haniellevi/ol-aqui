import { Botao } from "@/components/ui/botao";

export default function LojaNaoEncontrada() {
  return <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
    <h1 className="text-titulo font-semibold text-balance">Loja não encontrada</h1>
    <p className="text-pretty text-texto-suave">O endereço pode ter mudado ou esta vitrine está fora do ar.</p>
    <Botao href="/busca">Buscar anúncios da região</Botao>
  </main>;
}
