import { exigirTela } from "@/lib/admin/equipe";
import { Cartao, Titulo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { carregarOpcoes } from "../dados";
import { FormLojista } from "../formularios";

export const metadata = { title: "Novo contato · Funil" };

export default async function NovoContatoPage() {
  const { supabase } = await exigirTela("funil");
  const opcoes = await carregarOpcoes(supabase);
  return (
    <>
      <Botao href="/admin/funil" variante="texto" tamanho="pequeno">← Funil de lojistas</Botao>
      <Titulo>Novo contato</Titulo>
      <Cartao><FormLojista opcoes={opcoes} /></Cartao>
    </>
  );
}
