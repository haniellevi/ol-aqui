import { listarCidadesAtivas } from "@/lib/dados/regiao";
import { escolherCidade } from "./actions";
import { Botao } from "@/components/ui/botao";
import { NativeSelect } from "@/components/ui/native-select";
export const metadata = { title: "Escolher cidade" };
export default async function Cidades({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const cidades = await listarCidadesAtivas();
  return <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
    <h1 className="text-titulo font-semibold text-beringela">Onde você procura?</h1>
    <p>Escolha uma cidade para ver anúncios próximos.</p>
    {(await searchParams).erro && <p role="alert" className="text-perigo">Escolha uma cidade disponível.</p>}
    <form action={escolherCidade} className="flex flex-col gap-4">
      <label htmlFor="cidade" className="font-semibold">Cidade</label>
      <NativeSelect id="cidade" name="cidade" required defaultValue="">
        <option value="">Escolha a cidade</option>
        {cidades.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.uf})</option>)}
      </NativeSelect>
      <Botao type="submit">Usar esta cidade</Botao>
    </form>
  </main>;
}
