import { auth } from "@clerk/nextjs/server";
import { LifeBuoy } from "lucide-react";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/conta/aviso";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { ListaAtendimentos } from "@/components/atendimento/lista";
import { ContatoSuporte } from "@/components/paginas/contato-suporte";
import { Botao } from "@/components/ui/botao";
import { listarAtendimentos, paginaAtendimento } from "@/lib/dados/atendimento";
import { contatoEquipe } from "@/lib/dados/paginas";
import { regiaoAtual } from "@/lib/dados/regiao";
import { LINK_AJUDA, LINK_ATENDIMENTO, linkAtendimento } from "@/lib/rotas";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Atendimento" };

export default async function AtendimentoConta({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/entrar");
  const pagina = paginaAtendimento((await searchParams).pagina);
  const [atendimentos, regiao] = await Promise.all([
    listarAtendimentos(await createClient(), pagina, userId),
    regiaoAtual().catch(() => null),
  ]);
  const { data, count, error } = atendimentos;
  if (pagina > 1 && error?.code === "PGRST103") redirect(LINK_ATENDIMENTO);
  const contato = await contatoEquipe(regiao?.id ?? null).catch(() => ({ whatsapp: null, email: null, texto: null }));
  return <PaginaConta>
    <TopoConta titulo="Atendimento" texto="Suas conversas privadas sobre anúncios e confirmação do WhatsApp, além dos canais para falar com a equipe." />
    {error ? (
      <Aviso tipo="erro">
        <span>Não foi possível carregar suas conversas. Atualize a página.</span>
        <Botao href={LINK_ATENDIMENTO} variante="secundario" tamanho="toque" className="w-fit">Tentar de novo</Botao>
      </Aviso>
    ) : (
      <ListaAtendimentos dados={data ?? []} total={count ?? 0} pagina={pagina} caminho={LINK_ATENDIMENTO}
        link={c => c.anuncio_id ? linkAtendimento(c.id) : "/aki?ajuda=whatsapp&atendimento=1"} />
    )}
    <ContatoSuporte contato={contato} />
    <Botao href={LINK_AJUDA} variante="secundario" tamanho="toque" icone={<LifeBuoy />} className="w-full sm:w-fit">
      Ver perguntas frequentes na Ajuda
    </Botao>
  </PaginaConta>;
}
