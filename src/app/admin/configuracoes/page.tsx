import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { CHAVES_DE_MODELO, CHAVES_DE_PLANO, NOMES_GRUPO, OPCOES_FIXAS, tipoDe, valorParaForm, type Opcao } from "@/lib/admin/config";
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
  const [{ data: configs }, { data: regioes }, { data: planos }, { data: modelos }] = await Promise.all([
    supabase.from("configuracoes").select("*").order("chave"),
    supabase.from("microrregioes").select("id, nome").order("nome"),
    supabase.from("planos").select("codigo, nome").order("nome"),
    supabase.from("robo_modelos").select("provedor, modelo, nome").eq("ativo", true).order("nome"),
  ]);
  const opcoesPlano: Opcao[] = (planos ?? []).map((p) => ({ valor: p.codigo, nome: `${p.nome} (${p.codigo})` }));
  const opcoesModelo: Opcao[] = (modelos ?? []).map((m) => ({ valor: m.modelo, nome: `${m.nome} · ${m.provedor}` }));
  const opcoesDe = (chave: string): Opcao[] | undefined =>
    OPCOES_FIXAS[chave] ?? (CHAVES_DE_PLANO.has(chave) ? opcoesPlano : CHAVES_DE_MODELO.has(chave) ? opcoesModelo : undefined);
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
              <FormConfig id={c.id} chave={c.chave} tipo={tipo} valor={c.valor} opcoes={opcoesDe(c.chave)} />

              {excecoes.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {excecoes.map((e) => (
                    <li key={e.id} className="flex min-h-12 items-center gap-3 rounded-card bg-laranja-claro pl-3 pr-1 text-sm text-beringela">
                      <span className="font-semibold">{nomesRegiao.get(e.microrregiao_id!) ?? "Região"}:</span>
                      <span className="truncate font-mono text-[13px]">{nomeValor(tipoDe(e.valor), e.valor, opcoesDe(c.chave))}</span>
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
                  <FormExcecao chave={c.chave} tipo={tipo} valor={c.valor} regioes={regioes ?? []} opcoes={opcoesDe(c.chave)} />
                </div>
              )}
            </Cartao>
          );
        })}
      </div>
    </>
  );
}

function nomeValor(tipo: ReturnType<typeof tipoDe>, valor: unknown, opcoes?: Opcao[]) {
  const texto = valorParaForm(tipo, valor);
  if (tipo === "simnao") return valor ? "Sim" : "Não";
  return opcoes?.find((o) => o.valor === texto)?.nome ?? texto.replace(/\n/g, " · ");
}
