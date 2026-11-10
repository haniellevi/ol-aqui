import { createClient } from "@/lib/supabase/server";
import { escolherCidade } from "./actions";
import { Botao } from "@/components/ui/botao";
export const metadata = { title: "Escolher cidade" };
export default async function Cidades({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const db = await createClient();
  const { data, error } = await db.from("cidades").select("id,nome,uf,microrregioes!inner(ativa)").eq("ativa", true).eq("microrregioes.ativa", true).order("nome");
  if (error) throw new Error("Não foi possível carregar as cidades.");
  return <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
    <h1 className="text-titulo font-semibold text-beringela">Onde você procura?</h1>
    <p>Escolha uma cidade para ver anúncios próximos.</p>
    {(await searchParams).erro && <p role="alert" className="text-perigo">Escolha uma cidade disponível.</p>}
    <form action={escolherCidade} className="flex flex-col gap-4">
      <label htmlFor="cidade" className="font-semibold">Cidade</label>
      <select id="cidade" name="cidade" required defaultValue="" className="min-h-11 rounded-campo border-2 border-borda bg-cartao px-3">
        <option value="">Escolha a cidade</option>
        {(data ?? []).map(c => <option key={c.id} value={c.id}>{c.nome} ({c.uf})</option>)}
      </select>
      <Botao type="submit">Usar esta cidade</Botao>
    </form>
  </main>;
}
