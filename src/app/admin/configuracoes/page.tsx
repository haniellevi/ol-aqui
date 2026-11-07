import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { NOMES_GRUPO, tipoDe, valorParaForm } from "@/lib/admin/config";
import { quando } from "@/lib/admin/formato";
import { Cartao, Titulo } from "@/components/admin/ui";
import { removerExcecao } from "./actions";
import { FormConfig, FormExcecao } from "./form-config";

export const metadata = { title: "Configurações" };

type Config = {
  id: string;
  chave: string;
  microrregiao_id: string | null;
  valor: unknown;
  descricao: string | null;
  grupo: string;
  publico: boolean;
  atualizado_em: string;
};

export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ grupo?: string }> }) {
  const { supabase } = await exigirAdmin();
  const [{ data: configs }, { data: regioes }] = await Promise.all([
    supabase.from("configuracoes").select("*").order("chave"),
    supabase.from("microrregioes").select("id, nome").order("nome"),
  ]);
  const lista = (configs ?? []) as Config[];
  const nomesRegiao = new Map((regioes ?? []).map((r) => [r.id, r.nome]));
  const grupos = [...new Set(lista.map((c) => c.grupo))].sort(
    (a, b) => Object.keys(NOMES_GRUPO).indexOf(a) - Object.keys(NOMES_GRUPO).indexOf(b),
  );
  const grupoAtual = (await searchParams).grupo ?? grupos[0];
  const globais = lista.filter((c) => c.grupo === grupoAtual && c.microrregiao_id === null);

  return (
    <>
      <Titulo sub="Valores que o site usa na hora. Cada um pode ter uma exceção por região. Toda mudança fica no histórico.">
        Configurações
      </Titulo>

      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {grupos.map((g) => (
          <Link
            key={g}
            href={`/admin/configuracoes?grupo=${g}`}
            aria-current={g === grupoAtual ? "page" : undefined}
            className={`inline-flex h-12 shrink-0 items-center rounded-campo border px-4 text-sm font-semibold text-beringela active:brightness-90 ${
              g === grupoAtual ? "border-laranja-escuro bg-laranja-claro" : "border-borda bg-cartao"
            }`}
          >
            {NOMES_GRUPO[g] ?? g}
          </Link>
        ))}
      </nav>

      <div className="space-y-4">
        {globais.map((c) => {
          const tipo = tipoDe(c.valor);
          const excecoes = lista.filter((e) => e.chave === c.chave && e.microrregiao_id !== null);
          return (
            <Cartao key={c.id}>
              <div className="mb-3">
                <h2 className="font-semibold text-beringela">{c.descricao ?? c.chave}</h2>
                <p className="text-[13px] text-texto-suave">
                  {c.chave} · {c.publico ? "visível no site" : "só no sistema"} · alterado em {quando(c.atualizado_em)}
                </p>
              </div>
              <FormConfig id={c.id} chave={c.chave} tipo={tipo} valor={c.valor} />

              {excecoes.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {excecoes.map((e) => (
                    <li key={e.id} className="flex min-h-12 items-center gap-3 rounded-card bg-laranja-claro pl-3 pr-1 text-sm text-beringela">
                      <span className="font-semibold">{nomesRegiao.get(e.microrregiao_id!) ?? "Região"}:</span>
                      <span className="truncate font-mono text-[13px]">{valorParaForm(tipoDe(e.valor), e.valor).replace(/\n/g, " · ")}</span>
                      <form action={removerExcecao} className="ml-auto">
                        <input type="hidden" name="id" value={e.id} />
                        <button className="h-12 px-3 text-sm font-semibold text-perigo underline">remover</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {(regioes ?? []).length > 0 && (
                <div className="mt-3">
                  <FormExcecao chave={c.chave} tipo={tipo} valor={c.valor} regioes={regioes ?? []} />
                </div>
              )}
            </Cartao>
          );
        })}
      </div>
    </>
  );
}
