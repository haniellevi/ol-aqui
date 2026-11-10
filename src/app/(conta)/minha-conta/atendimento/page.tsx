import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { ListaAtendimentos } from "@/components/atendimento/lista";
import { listarAtendimentos, paginaAtendimento } from "@/lib/dados/atendimento";
import { LINK_ATENDIMENTO, linkAtendimento } from "@/lib/rotas";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Atendimento" };

export default async function AtendimentoConta({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/entrar");
  const pagina = paginaAtendimento((await searchParams).pagina);
  const { data, count, error } = await listarAtendimentos(await createClient(), pagina, userId);
  if (pagina > 1 && error?.code === "PGRST103") redirect(LINK_ATENDIMENTO);
  return <PaginaConta>
    <TopoConta titulo="Atendimento" texto="Aqui ficam suas conversas privadas com a equipe do Mercado da Região." />
    {error ? <p role="alert" className="text-perigo">Não foi possível carregar suas conversas. Atualize a página.</p> :
      <ListaAtendimentos dados={data ?? []} total={count ?? 0} pagina={pagina} caminho={LINK_ATENDIMENTO}
        link={c => c.anuncio_id ? linkAtendimento(c.id) : "/aki?ajuda=whatsapp&atendimento=1"} />}
  </PaginaConta>;
}
