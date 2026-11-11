import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/admin/equipe";
import { primeiraTela } from "@/lib/tipos-equipe";
import { Titulo } from "@/components/admin/ui";
import { Estatisticas, type ParametrosEstatisticas } from "./estatisticas";

export const metadata = { title: "Resultados" };

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<ParametrosEstatisticas> }) {
  const { supabase, papel } = await exigirEquipe();
  if (papel !== "administrador") redirect(primeiraTela(papel));
  return <>
    <Titulo sub="Atividade do site e recebimentos confirmados.">Resultados</Titulo>
    <Estatisticas supabase={supabase} params={await searchParams} />
  </>;
}
