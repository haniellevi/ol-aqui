import { formatarNome } from "@/lib/formatar-nome";
import Link from "next/link";
import { Campo } from "@/components/ui/campo";
import { Botao } from "@/components/ui/botao";
import { Seletor } from "@/components/conta/seletor";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { lugarDaRegiao } from "@/components/busca/parametros";
import { anunciosCatalogo, lojasCatalogo } from "@/lib/dados/catalogo";
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
    lojasCatalogo(regiao, nicho, LIMITE, (paginaLojas - 1) * LIMITE, false, busca),
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
        {pagina > 1 && <Botao href={destino(pagina - 1)} variante="secundario">Anterior</Botao>}
        {pagina < 4000 && total > pagina * LIMITE && <Botao href={destino(pagina + 1)} variante="secundario">Próxima</Botao>}
      </div>
    );
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
      <header>
        <Link href="/" className="text-sm font-semibold text-laranja-escuro underline underline-offset-4">Voltar à vitrine</Link>
        <h1 className="mt-2 text-titulo font-semibold text-beringela">Lojas de {lugarDaRegiao(regiao)}</h1>
      </header>
      <form method="get" action="/lojas" className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Campo id="busca-loja" name="q" type="search" rotulo="Buscar loja" placeholder="Nome da loja" defaultValue={busca} maxLength={80} className="col-span-2 min-w-0 sm:col-span-1" />
        <div className="min-w-0">
          <Seletor name="nicho" rotulo="Filtrar por categoria" defaultValue={nicho ?? ""}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <optgroup key={c.id} label={c.nome}>
                <option value={c.slug}>Todos em {c.nome}</option>
                {c.filhas.map((f) => <option key={f.id} value={f.slug}>{f.nome}</option>)}
              </optgroup>
            ))}
          </Seletor>
        </div>
        <Botao type="submit" variante="secundario">Buscar</Botao>
      </form>
      {busca && <div className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
        <p>Lojas encontradas para “{busca}”</p>
        <Botao href={nicho ? `/lojas?nicho=${encodeURIComponent(nicho)}` : "/lojas"} variante="texto">Limpar busca</Botao>
      </div>}
      <section id="lojas" aria-labelledby="titulo-lojas" className="space-y-3">
        <h2 id="titulo-lojas" className="text-lg font-semibold text-beringela">Lojas da região</h2>
        {!lojas.length && <p className="text-texto-suave">{busca ? "Nenhuma loja encontrada. Tente outro nome ou limpe a busca." : "Nenhuma loja neste recorte."}</p>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lojas.map((l) => (
            <li key={l.id} className="min-w-0">
              <Link href={linkLoja(l.slug)} className="flex h-full flex-col items-center gap-2 rounded-card border border-borda bg-cartao p-4 text-center hover:border-laranja-escuro">
                <AvatarVitrine nome={l.nome} logo={l.logo_url} tamanho="lg" />
                <span className="font-semibold break-words text-beringela">{formatarNome(l.nome)}</span>
                <span className="text-sm text-texto-suave">{l.cidade}</span>
                {l.verificada && <span className="text-sm font-semibold text-verde-escuro">Loja verificada</span>}
                <span className="text-sm font-semibold text-laranja-escuro">Ver vitrine e contatos</span>
              </Link>
            </li>
          ))}
        </ul>
        {paginar("lojas", paginaLojas, Number(lojas[0]?.total ?? 0))}
      </section>
      {!busca && <section id="produtos" aria-labelledby="titulo-produtos" className="space-y-3">
        <h2 id="titulo-produtos" className="text-lg font-semibold text-beringela">Produtos das lojas</h2>
        <GradeAnuncios anuncios={produtos} vazio={<p className="text-texto-suave">Nenhum produto neste recorte.</p>} />
        {paginar("produtos", paginaProdutos, Number(produtos[0]?.total ?? 0))}
      </section>}
    </main>
  );
}
