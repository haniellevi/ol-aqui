import { MapPin } from "lucide-react";
import { listarCidadesAtivas, regiaoAtual } from "@/lib/dados/regiao";
import { escolherCidade } from "./actions";
import { Botao } from "@/components/ui/botao";
import { Seletor } from "@/components/conta/seletor";
import { Vazio } from "@/components/ui/vazio";

export const metadata = { title: "Escolher cidade" };

export default async function Cidades({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const [cidades, regiao, { erro }] = await Promise.all([listarCidadesAtivas(), regiaoAtual(), searchParams]);
  const local = regiao?.cidade ?? regiao?.cidadeSede;
  const atual = cidades.find((c) => c.nome === local && c.microrregiao_id === regiao?.id);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-4">
      <header className="space-y-1">
        <h1 className="text-titulo font-semibold text-beringela">Escolher cidade</h1>
        {local && (
          <p className="flex items-baseline gap-1.5 text-sm text-texto-suave">
            <MapPin className="size-4 shrink-0 self-start" aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">Você está vendo anúncios de {local} e região.</span>
          </p>
        )}
      </header>
      {cidades.length > 0 ? (
        <form action={escolherCidade} className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
          <Seletor id="cidade" name="cidade" rotulo="Cidade" tamanho="toque" required defaultValue={erro ? "" : atual?.id ?? ""}
            erro={erro ? "Escolha uma cidade disponível." : undefined}>
            <option value="">Escolha a cidade</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.uf})</option>)}
          </Seletor>
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" tamanho="toque">Usar esta cidade</Botao>
            <Botao href="/" variante="texto" tamanho="toque">Voltar ao início</Botao>
          </div>
        </form>
      ) : (
        <Vazio titulo="Nenhuma cidade disponível">
          <Botao href="/" tamanho="toque">Voltar ao início</Botao>
        </Vazio>
      )}
    </main>
  );
}
