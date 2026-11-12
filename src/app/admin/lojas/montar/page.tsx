import Link from "next/link";
import { exigirSuperAdmin } from "@/lib/admin/auth";
import { localidadesGestao } from "@/lib/admin/gestao-dados";
import { Aviso, Titulo } from "@/components/admin/ui";
import { FormMontarLoja } from "../montagem-formularios";

// Etapa P5c: só o super admin monta uma loja para depois transferir ao dono.
export const metadata = { title: "Montar loja para um dono" };
export default async function MontarLoja() {
  const { supabase } = await exigirSuperAdmin();
  const locais = await localidadesGestao(supabase);
  return <><Link href="/admin/lojas" className="mb-4 inline-block font-semibold text-laranja-escuro">Voltar às lojas</Link>
    <Titulo sub="A loja fica escondida enquanto a equipe cadastra produtos e aparência. Depois, o dono recebe um convite no WhatsApp; ela vai ao ar quando ele aceitar.">Montar loja para um dono</Titulo>
    {locais ? <FormMontarLoja locais={locais} /> : <Aviso tipo="erro">Não foi possível carregar regiões e cidades.</Aviso>}
  </>;
}
