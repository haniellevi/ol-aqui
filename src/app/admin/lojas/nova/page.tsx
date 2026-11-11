import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { localidadesGestao } from "@/lib/admin/gestao-dados";
import { ChevronLeft } from "lucide-react";
import { Aviso, Titulo, estiloBotaoDiscreto } from "@/components/admin/ui";
import { FormGestaoLoja } from "../gestao-formularios";

export const metadata = { title: "Nova loja" };
export default async function NovaLoja() {
  const { supabase } = await exigirAdmin();
  const locais = await localidadesGestao(supabase);
  return <><Link href="/admin/lojas" className={`${estiloBotaoDiscreto} mb-4`}><ChevronLeft className="size-4" aria-hidden />Voltar às lojas</Link>
    <Titulo sub="O titular precisa ter uma conta cadastrada. Após criar, configure o plano e revise a verificação.">Nova loja</Titulo>
    {locais ? <FormGestaoLoja loja={null} locais={locais} /> : <Aviso tipo="erro">Não foi possível carregar regiões e cidades.</Aviso>}
  </>;
}
