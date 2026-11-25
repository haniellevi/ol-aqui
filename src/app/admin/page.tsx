import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/admin/equipe";
import { primeiraTela } from "@/lib/tipos-equipe";
import { Titulo } from "@/components/admin/ui";
import { Estatisticas, type ParametrosEstatisticas } from "./estatisticas";
import { hojeFortaleza } from "@/lib/admin/relatorios";
import { lerLancamento, periodoLancamento } from "@/lib/admin/lancamento";
import { PainelLancamento } from "./painel-lancamento";

export const metadata = { title: "Resultados" };

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<ParametrosEstatisticas> }) {
  const { supabase, papel } = await exigirEquipe();
  if (papel !== "administrador") redirect(primeiraTela(papel));
  const params = await searchParams;
  // Endereços antigos com filtro mensal/anual continuam abrindo o histórico.
  const historico = params.visao === "historico" || !!params.periodo || !!params.ano || !!params.mes || !!params.regiao;
  const periodo = periodoLancamento(params,hojeFortaleza());
  const consultar = async (de: string, ate: string) => {
    try {
      const r = await supabase.rpc("admin_lancamento",{p_de:de,p_ate:ate});
      return r.error ? null : lerLancamento(r.data);
    } catch { return null; }
  };
  const [atual,anterior] = historico ? [null,null] : await Promise.all([consultar(periodo.de,periodo.ate),consultar(periodo.anteriorDe,periodo.anteriorAte)]);
  return <>
    <Titulo sub={historico ? "Histórico de atividade e recebimentos confirmados." : "Oferta, procura e ações para ajudar as lojas da região."}>Resultados</Titulo>
    {historico ? <><a href="/admin" className="mb-4 inline-flex min-h-toque items-center text-laranja-escuro underline">Ver visão de lançamento</a><Estatisticas supabase={supabase} params={params} /></> : <PainelLancamento atual={atual} anterior={anterior} periodo={periodo}/>}
  </>;
}
