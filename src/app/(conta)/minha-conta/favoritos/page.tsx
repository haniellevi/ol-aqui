import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Heart, Search } from "lucide-react";
import { meusFavoritos, FAVORITOS_POR_PAGINA } from "@/lib/dados/favoritos";
import { vitrineNovaAtiva } from "@/lib/dados/vitrine-completa";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { ListaFavoritos } from "@/components/conta/lista-favoritos";

export const metadata: Metadata = { title: "Favoritos" };
export const dynamic = "force-dynamic";
const caminho = "/minha-conta/favoritos";

export default async function PaginaFavoritos({ searchParams }: { searchParams: Promise<{ pagina?: string | string[] }> }) {
  const sp = await searchParams;
  const pagina = typeof sp.pagina === "string" && /^\d{1,6}$/.test(sp.pagina) ? Math.max(1, Math.min(100000, Number(sp.pagina))) : 1;
  // A chave da vitrine nova vale pela região da pessoa (a mesma que o lembrete no sino usa).
  const [dados, conta] = await Promise.all([meusFavoritos(pagina).catch(() => null), meuPerfilEVitrine().catch(() => null)]);
  const radar = conta ? await vitrineNovaAtiva(conta.perfil.microrregiao_id).catch(() => false) : false;
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / FAVORITOS_POR_PAGINA)) : 1;
  // A remoção do último item de uma página volta para a última página ainda existente.
  if (dados && pagina > paginas) redirect(`${caminho}?pagina=${paginas}`);
  return <PaginaConta larga>
    <TopoConta titulo="Favoritos" texto="Guarde o que chamou sua atenção e encontre de novo quando quiser." />
    {!dados ? <Vazio titulo="Não conseguimos carregar seus favoritos" texto="Sua lista continua guardada. Tente carregar novamente." icone={<Heart />}>
      <Botao href={`${caminho}?pagina=${pagina}`} larguraTotal>Tentar novamente</Botao>
    </Vazio> : dados.total === 0 ?
      <Vazio titulo="Você ainda não tem favoritos" texto="Abra um anúncio e toque no coração para salvar. Seus favoritos ficam disponíveis na sua conta." icone={<Heart />} className="mx-auto w-full max-w-xl">
        <Botao href="/busca" larguraTotal icone={<Search />}>Encontrar anúncios</Botao>
      </Vazio> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">{dados.total} {dados.total === 1 ? "anúncio salvo" : "anúncios salvos"}</h2><p className="text-sm text-texto-suave">Mais recentes primeiro. Abra um card para ver os detalhes.</p></div>
          <Botao href="/busca" variante="secundario" icone={<Search />}>Buscar mais anúncios</Botao>
        </div>
        <ListaFavoritos itens={dados.itens} radar={radar} />
        {paginas > 1 && <nav aria-label="Páginas dos favoritos" className="flex flex-wrap items-center justify-center gap-3 py-2">
          {pagina > 1 && <Botao href={`${caminho}?pagina=${pagina - 1}`} variante="secundario">Anterior</Botao>}
          <span className="text-sm text-texto-suave tabular-nums">Página {pagina} de {paginas}</span>
          {pagina < paginas && <Botao href={`${caminho}?pagina=${pagina + 1}`} variante="secundario">Próxima</Botao>}
        </nav>}
      </>}
  </PaginaConta>;
}
