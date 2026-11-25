import { formatarNome } from "@/lib/formatar-nome";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Campo } from "@/components/ui/campo";
import { Botao } from "@/components/ui/botao";
import { Seletor } from "@/components/conta/seletor";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { Vazio } from "@/components/ui/vazio";
import { SeloLoja } from "@/components/vitrine/selos";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { lugarDaRegiao } from "@/components/busca/parametros";
import { anunciosCatalogo, lojasComOferta } from "@/lib/dados/catalogo";
import { listarCategorias } from "@/lib/dados/categorias";
import { regiaoAtual } from "@/lib/dados/regiao";
import { linkLoja } from "@/lib/formato";

export const metadata = { title: "Catálogo de lojas" };

const LIMITE = 24;
function numeroPagina(v: string | undefined) {
  return typeof v === "string" && /^\d{1,4}$/.test(v) ? Math.min(4000, Math.max(1, Number(v))) : 1;
}

export default async function CatalogoLojas({ searchParams }: {
  searchParams: Promise<{ nicho?: string; lojas?: string; produtos?: string; q?: string | string[] }>;
}) {
  const [regiao, categorias, params] = await Promise.all([regiaoAtual(), listarCategorias(), searchParams]);
  const busca = typeof params.q === "string" ? params.q.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  const nicho = categorias.flatMap((c) => [c, ...c.filhas]).find((c) => c.slug === params.nicho)?.slug ?? null;
  const paginaLojas = numeroPagina(params.lojas);
  const paginaProdutos = numeroPagina(params.produtos);
  const [lojas, produtos] = regiao ? await Promise.all([
    lojasComOferta(regiao, nicho, LIMITE, (paginaLojas - 1) * LIMITE, false, busca),
    busca ? Promise.resolve([]) : anunciosCatalogo(regiao, "lojas", LIMITE, nicho, (paginaProdutos - 1) * LIMITE),
  ]) : [[], []];

  function paginar(tipo: "lojas" | "produtos", pagina: number, total: number) {
    function destino(n: number) {
      const parametros = new URLSearchParams();
      if (busca) parametros.set("q", busca);
      if (nicho) parametros.set("nicho", nicho);
      parametros.set("lojas", String(tipo === "lojas" ? n : paginaLojas));
      parametros.set("produtos", String(tipo === "produtos" ? n : paginaProdutos));
      return `/lojas?${parametros}#${tipo}`;
    }
    return (
      <div className="flex flex-wrap justify-center gap-3">
        {pagina > 1 && <Botao href={destino(pagina - 1)} variante="secundario" tamanho="toque">Anterior</Botao>}
        {pagina < 4000 && total > pagina * LIMITE && <Botao href={destino(pagina + 1)} variante="secundario" tamanho="toque">Próxima</Botao>}
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4">
      <header>
        <Botao href="/" variante="texto" tamanho="toque" className="-ml-2 px-2" icone={<ChevronLeft />}>Voltar ao início</Botao>
        <h1 className="text-titulo font-semibold text-beringela [overflow-wrap:anywhere]">Lojas de {lugarDaRegiao(regiao)}</h1>
      </header>
      <form method="get" action="/lojas" role="search" aria-label="Buscar lojas" className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Campo id="busca-loja" name="q" type="search" rotulo="Nome da loja" placeholder="Digite o nome" tamanho="toque" defaultValue={busca} maxLength={80} className="col-span-2 min-w-0 sm:col-span-1" />
        <div className="min-w-0">
          <Seletor name="nicho" rotulo="Categoria" tamanho="toque" defaultValue={nicho ?? ""}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <optgroup key={c.id} label={c.nome}>
                <option value={c.slug}>Todos em {c.nome}</option>
                {c.filhas.map((f) => <option key={f.id} value={f.slug}>{f.nome}</option>)}
              </optgroup>
            ))}
          </Seletor>
        </div>
        <Botao type="submit" tamanho="toque">Buscar</Botao>
      </form>
      {busca && lojas.length > 0 && (
        <Botao href={nicho ? `/lojas?nicho=${encodeURIComponent(nicho)}` : "/lojas"} variante="texto" tamanho="toque" className="self-start">
          Limpar busca
        </Botao>
      )}
      <p className="text-sm text-texto-suave">Lojas com produtos primeiro; depois, proximidade e verificação.</p>
      <section id="lojas" aria-labelledby="titulo-lojas" className="scroll-mt-20 space-y-2">
        <h2 id="titulo-lojas" className="sr-only">Lojas encontradas</h2>
        {lojas.length === 0 ? (
          <Vazio titulo={busca ? `Nenhuma loja encontrada para “${busca}”` : "Nenhuma loja nesta seleção"}>
            <Botao href={busca && nicho ? `/lojas?nicho=${encodeURIComponent(nicho)}` : "/lojas"} variante="secundario" tamanho="toque">
              {busca ? "Limpar busca" : nicho || paginaLojas > 1 ? "Ver todas as lojas" : "Atualizar lojas"}
            </Botao>
          </Vazio>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lojas.map((l) => (
              <li key={l.id} className="min-w-0">
                <Link href={linkLoja(l.slug)} className="flex h-full min-h-16 items-center gap-2.5 rounded-card border border-borda bg-cartao px-3 py-2 hover:border-laranja-escuro focus-visible:outline-3 focus-visible:outline-laranja-escuro">
                  <AvatarVitrine nome={l.nome} logo={l.logo_url} tamanho="md" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 [overflow-wrap:anywhere]">
                    <strong className="text-base font-semibold text-beringela">{formatarNome(l.nome)}</strong>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-texto-suave">
                      {l.cidade}{l.verificada && <SeloLoja />}
                      <span>{l.produtos_ativos > 0 ? `${l.produtos_ativos} ${l.produtos_ativos === 1 ? "produto ativo" : "produtos ativos"}` : "Ainda sem produtos ativos"}</span>
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-laranja-escuro" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {paginar("lojas", paginaLojas, Number(lojas[0]?.total ?? 0))}
      </section>
      {!busca && <section id="produtos" aria-labelledby="titulo-produtos" className="scroll-mt-20 space-y-2">
        <h2 id="titulo-produtos" className="text-lg font-semibold text-beringela">Produtos das lojas</h2>
        <GradeAnuncios anuncios={produtos} vazio={<p className="text-texto-suave">Nenhum produto neste recorte.</p>} />
        {paginar("produtos", paginaProdutos, Number(produtos[0]?.total ?? 0))}
      </section>}
    </main>
  );
}
