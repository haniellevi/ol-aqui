import { redirect } from "next/navigation";
import { Aviso, Titulo } from "@/components/admin/ui";
import { ListaAtendimentos } from "@/components/atendimento/lista";
import { Botao } from "@/components/ui/botao";
import { exigirTela } from "@/lib/admin/equipe";
import { listarAtendimentos, paginaAtendimento } from "@/lib/dados/atendimento";
import { LINK_ADMIN_ANUNCIOS, LINK_ADMIN_ATENDIMENTOS, linkAdminAnuncio } from "@/lib/rotas";

export const metadata = { title: "Conversas com anunciantes" };

export default async function ConversasAdmin({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { supabase } = await exigirTela("anuncios");
  const pagina = paginaAtendimento((await searchParams).pagina);
  const { data, count, error } = await listarAtendimentos(supabase, pagina);
  if (pagina > 1 && error?.code === "PGRST103") redirect(LINK_ADMIN_ATENDIMENTOS);
  return <>
    <Botao href={LINK_ADMIN_ANUNCIOS} variante="texto" className="mb-2" prefetch={false}>Voltar aos anúncios</Botao>
    <Titulo sub="As conversas que aguardam a equipe aparecem primeiro.">Conversas com anunciantes</Titulo>
    {error ? <Aviso tipo="erro">Não foi possível carregar as conversas. Atualize a página.</Aviso> :
      <ListaAtendimentos dados={data ?? []} total={count ?? 0} pagina={pagina} caminho={LINK_ADMIN_ATENDIMENTOS}
        equipe link={c => `${linkAdminAnuncio(c.anuncio_id)}#conversa`} />}
  </>;
}
