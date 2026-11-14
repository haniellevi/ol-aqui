import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";

export default function VendedorNaoEncontrado() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-4">
      <Vazio titulo="Vendedor não encontrado">
        <Botao href="/busca" tamanho="toque">Ver anúncios da região</Botao>
      </Vazio>
    </main>
  );
}
