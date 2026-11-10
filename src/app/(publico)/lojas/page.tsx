import Link from "next/link";
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
  searchParams: Promise<{ nicho?: string; lojas?: string; produtos?: string }>;
}) {
  const [regiao, categorias, params] = await Promise.all([regiaoAtual(), listarCategorias(), searchParams]);
  const nicho = categorias.flatMap((c) => [c, ...c.filhas]).find((c) => c.slug === params.nicho)?.slug ?? null;
  const paginaLojas = numeroPagina(params.lojas);
  const paginaProdutos = numeroPagina(params.produtos);
  const [lojas, produtos] = regiao ? await Promise.all([
    lojasCatalogo(regiao, nicho, LIMITE, (paginaLojas - 1) * LIMITE),
    anunciosCatalogo(regiao, "lojas", LIMITE, nicho, (paginaProdutos - 1) * LIMITE),
  ]) : [[], []];

  function paginar(tipo: "lojas" | "produtos", pagina: number, total: number) {
    function destino(n: number) {
      const busca = new URLSearchParams();
      if (nicho) busca.set("nicho", nicho);
      busca.set("lojas", String(tipo === "lojas" ? n : paginaLojas));
      busca.set("produtos", String(tipo === "produtos" ? n : paginaProdutos));
      return `/lojas?${busca}#${tipo}`;
    }
    return (
      <div className="flex flex-wrap justify-center gap-3">
        {pagina > 1 && <Botao href={destino(pagina - 1)} variante="secundario">Anterior</Botao>}
        {pagina < 4000 && total > pagina * LIMITE && <Botao href={destino(pagina + 1)} variante="secundario">Próxima</Botao>}
      </div>
    );
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6">
      <header>
        <Link href="/" className="text-sm font-semibold text-laranja-escuro underline underline-offset-4">Voltar à vitrine</Link>
        <h1 className="mt-2 text-titulo font-semibold text-beringela">Lojas de {lugarDaRegiao(regiao)}</h1>
        <p className="mt-1 text-texto-suave">Encontre lojas próximas e veja os produtos de cada uma.</p>
      </header>
      <form method="get" action="/lojas" className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <Seletor name="nicho" rotulo="Filtrar por nicho" defaultValue={nicho ?? ""}>
            <option value="">Todos os nichos</option>
            {categorias.map((c) => (
              <optgroup key={c.id} label={c.nome}>
                <option value={c.slug}>Todos em {c.nome}</option>
                {c.filhas.map((f) => <option key={f.id} value={f.slug}>{f.nome}</option>)}
              </optgroup>
            ))}
          </Seletor>
        </div>
        <Botao type="submit" variante="secundario">Filtrar</Botao>
      </form>
      <section id="lojas" aria-labelledby="titulo-lojas" className="space-y-3">
        <h2 id="titulo-lojas" className="text-lg font-semibold text-beringela">Lojas da região</h2>
        {!lojas.length && <p className="text-texto-suave">Nenhuma loja neste recorte.</p>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lojas.map((l) => (
            <li key={l.id} className="min-w-0">
              <Link href={linkLoja(l.slug)} className="flex h-full flex-col items-center gap-2 rounded-card border border-borda bg-cartao p-4 text-center hover:border-laranja-escuro">
                <AvatarVitrine nome={l.nome} logo={l.logo_url} tamanho="lg" />
                <span className="break-words font-semibold text-beringela">{l.nome}</span>
                <span className="text-sm text-texto-suave">{l.cidade}</span>
                {l.verificada && <span className="text-sm font-semibold text-verde-escuro">Loja verificada</span>}
                <span className="text-sm font-semibold text-laranja-escuro">Ver vitrine e contatos</span>
              </Link>
            </li>
          ))}
        </ul>
        {paginar("lojas", paginaLojas, Number(lojas[0]?.total ?? 0))}
      </section>
      <section id="produtos" aria-labelledby="titulo-produtos" className="space-y-3">
        <h2 id="titulo-produtos" className="text-lg font-semibold text-beringela">Produtos das lojas</h2>
        <GradeAnuncios anuncios={produtos} vazio={<p className="text-texto-suave">Nenhum produto neste recorte.</p>} />
        {paginar("produtos", paginaProdutos, Number(produtos[0]?.total ?? 0))}
      </section>
    </main>
  );
}
