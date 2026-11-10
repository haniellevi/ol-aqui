import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/admin/equipe";
import { primeiraTela } from "@/lib/tipos-equipe";
import { inteiro, reais } from "@/lib/admin/formato";
import { Aviso, Cartao, Numero, Titulo } from "@/components/admin/ui";
import { Estatisticas, type ParametrosEstatisticas } from "./estatisticas";

export const metadata = { title: "Resumo" };

type Plano = { codigo: string; nome: string; e_teste: boolean; preco_centavos: number };

export default async function ResumoPage({ searchParams }: { searchParams: Promise<ParametrosEstatisticas> }) {
  const { supabase, papel } = await exigirEquipe();
  if (papel !== "administrador") redirect(primeiraTela(papel));
  const agora = new Date();

  return (
    <>
      <Titulo sub="Acompanhe a atividade do OLAKI, os recebimentos da empresa e a operação do painel.">Resumo</Titulo>
      <Estatisticas supabase={supabase} params={await searchParams} />
      <Operacao supabase={supabase} agora={agora} />
    </>
  );
}

async function Operacao({ supabase, agora }: { supabase: SupabaseClient; agora: Date }) {
  const instante = agora.toISOString();
  const contar = async (consulta: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await consulta;
    return error ? null : count;
  };
  const [
    planosR, vitrines, emTeste, pendentes, vencidas, pedidosAbertos, emAnalise, pedidosAnalise, denuncias,
  ] = await Promise.all([
    supabase.from("planos").select("codigo, nome, e_teste, preco_centavos").order("ordem"),
    contar(supabase.from("vitrines_lojas").select("id", { count: "exact", head: true })),
    contar(supabase.from("vitrines_lojas").select("id", { count: "exact", head: true }).eq("plano", "teste").eq("status", "ativa").gt("teste_expira_em", instante)),
    contar(supabase.from("pagamentos").select("id", { count: "exact", head: true }).eq("status", "pendente")),
    contar(supabase.from("pagamentos").select("id", { count: "exact", head: true }).eq("status", "vencido")),
    contar(supabase.from("radar_pedidos").select("id", { count: "exact", head: true }).eq("status", "aberto").gt("expira_em", instante)
      .or(`modo_contato.eq.whatsapp_direto,propostas_ate.gt.${instante}`)),
    contar(supabase.from("anuncios").select("id", { count: "exact", head: true }).eq("status", "em_analise")),
    contar(supabase.from("radar_pedidos").select("id", { count: "exact", head: true }).eq("status", "em_analise")),
    contar(supabase.from("denuncias").select("id", { count: "exact", head: true }).eq("status", "aberta")),
  ]);

  const planos = ((planosR.data ?? []) as Plano[]).filter((p) => !p.e_teste && p.preco_centavos > 0);
  const porPlano = await Promise.all(planos.map(async (p) => ({
    ...p,
    total: await contar(supabase.from("vitrines_lojas").select("id", { count: "exact", head: true })
      .eq("plano", p.codigo).eq("status", "ativa").gt("plano_expira_em", instante)),
  })));
  const fila = emAnalise === null || pedidosAnalise === null || denuncias === null ? null : emAnalise + pedidosAnalise + denuncias;
  const mrr = planosR.error || porPlano.some((p) => p.total === null)
    ? null
    : porPlano.reduce((s, p) => s + (p.total ?? 0) * p.preco_centavos, 0);
  const valorContagem = (n: number | null) => n === null ? "Indisponível" : inteiro(n);

  return (
    <section aria-labelledby="operacao-titulo">
      <h2 id="operacao-titulo" className="text-lg font-semibold text-beringela">Operação atual</h2>
      <p className="mb-4 text-sm text-texto-suave">Situação de hoje em todas as regiões.</p>

      {fila === null && <Aviso tipo="erro">Não foi possível consultar a fila de moderação.</Aviso>}
      {fila !== null && fila > 0 && (
        <Link href="/admin/moderacao" className="mb-6 flex min-h-11 items-center justify-between gap-3 rounded-card bg-perigo-fundo px-4 py-3 text-sm font-semibold text-perigo active:brightness-90">
          <span>
            {fila} {fila === 1 ? "item espera" : "itens esperam"} revisão. {emAnalise} anúncios, {pedidosAnalise} pedidos e {denuncias} denúncias.
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Numero rotulo="Receita mensal recorrente estimada" valor={mrr === null ? "Indisponível" : reais(mrr)} detalhe="Assinaturas em dia × preço atual" />
        <Numero rotulo="Cobranças vencidas" valor={valorContagem(vencidas)} alerta={vencidas !== null && vencidas > 0} />
        <Numero rotulo="Cobranças pendentes" valor={valorContagem(pendentes)} />
        <Numero rotulo="Pedidos abertos no Radar" valor={valorContagem(pedidosAbertos)} />
      </div>

      <h3 className="mb-3 mt-6 text-base font-semibold text-beringela">Lojistas</h3>
      {planosR.error && <Aviso tipo="erro">Não foi possível consultar os planos.</Aviso>}
      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Numero rotulo="Vitrines no total" valor={valorContagem(vitrines)} />
        <Numero rotulo="Em teste grátis" valor={valorContagem(emTeste)} />
        {porPlano.map((p) => (
          <Numero key={p.codigo} rotulo={`Pagantes ${p.nome}`} valor={valorContagem(p.total)} detalhe={`${reais(p.preco_centavos)}/mês`} />
        ))}
      </div>
      {vitrines === 0 && (
        <Cartao className="mt-4 text-sm text-texto-suave">Ainda não há vitrines cadastradas.</Cartao>
      )}
    </section>
  );
}
