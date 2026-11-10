import Link from "next/link";
import { redirect } from "next/navigation";
import { Aviso, Cartao, Titulo, estiloBotaoSec } from "@/components/admin/ui";
import { ROTULO_ANUNCIO } from "@/components/conta/situacao-anuncios";
import { Chip } from "@/components/ui/chip";
import { exigirTela } from "@/lib/admin/equipe";
import { inteiro, quando } from "@/lib/admin/formato";
import { preco } from "@/lib/formato";
import { LINK_ADMIN_ANUNCIOS } from "@/lib/rotas";
import type { StatusAnuncio } from "@/lib/tipos";

export const metadata = { title: "Anúncios" };

const FILTROS = [
  { status: "", nome: "Todos" },
  { status: "ativo", nome: "No ar" },
  { status: "pausado", nome: "Pausados" },
  { status: "rascunho", nome: "Rascunhos" },
  { status: "em_analise", nome: "Em análise" },
] as const;
const POR_PAGINA = 30;

type Parametros = { status?: string | string[]; pagina?: string | string[] };

function endereco(status: string, pagina = 1) {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (pagina > 1) q.set("pagina", String(pagina));
  return q.size ? `${LINK_ADMIN_ANUNCIOS}?${q}` : LINK_ADMIN_ANUNCIOS;
}

export default async function AnunciosAdminPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  const { supabase } = await exigirTela("anuncios");
  const sp = await searchParams;
  const filtro = FILTROS.find(({ status }) => status === sp.status) ?? FILTROS[0];
  const numero = typeof sp.pagina === "string" ? Number(sp.pagina) : 1;
  const pagina = Number.isSafeInteger(numero) && numero > 0 && numero <= 1_000_000 ? numero : 1;
  const inicio = (pagina - 1) * POR_PAGINA;
  let consulta = supabase.from("anuncios")
    .select("id, titulo, cidade, preco_centavos, status, atualizado_em, vitrines_lojas(nome)", { count: "exact" })
    .order("atualizado_em", { ascending: false })
    .order("id");
  if (filtro.status) consulta = consulta.eq("status", filtro.status);
  const { data, count, error } = await consulta.range(inicio, inicio + POR_PAGINA - 1);
  if (pagina > 1 && (error?.code === "PGRST103" || (!error && !data?.length))) {
    redirect(endereco(filtro.status));
  }
  const anuncios = (data ?? []) as unknown as {
    id: string;
    titulo: string;
    cidade: string;
    preco_centavos: number | null;
    status: StatusAnuncio;
    atualizado_em: string;
    vitrines_lojas: { nome: string } | null;
  }[];
  const total = count ?? 0;
  const paginas = Math.ceil(total / POR_PAGINA);

  return (
    <>
      <Titulo sub="Consulte os anúncios de todos os vendedores e confira a situação de cada um.">
        Anúncios
      </Titulo>
      <nav aria-label="Filtrar anúncios por situação" className="mb-6 flex flex-wrap gap-2">
        {FILTROS.map(({ status, nome }) => (
          <Chip key={status} href={endereco(status)} ativo={filtro.status === status} prefetch={false}>
            {nome}
          </Chip>
        ))}
      </nav>

      <section aria-labelledby="titulo-lista-anuncios" className="@container/lista">
        <h2 id="titulo-lista-anuncios" className="mb-3 text-sm text-texto-suave">
          {error ? "Lista de anúncios" : `${inteiro(total)} ${total === 1 ? "anúncio" : "anúncios"}`}
        </h2>
        {error ? (
          <Aviso tipo="erro">Não foi possível carregar os anúncios. Atualize a página para tentar novamente.</Aviso>
        ) : anuncios.length === 0 ? (
          <Cartao>
            <p className="text-sm text-texto-suave">
              {filtro.status ? "Nenhum anúncio nesta situação." : "Nenhum anúncio cadastrado."}
            </p>
          </Cartao>
        ) : (
          <ul className="space-y-3">
            {anuncios.map((anuncio) => {
              const situacao = ROTULO_ANUNCIO[anuncio.status];
              return (
                <li key={anuncio.id}>
                  <Cartao className="grid items-start gap-3 @xl/lista:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                      <h3 className="text-base text-beringela">{anuncio.titulo}</h3>
                      <p className="mt-1 text-sm text-texto-suave">
                        {[anuncio.vitrines_lojas?.nome, anuncio.cidade].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-1 text-legenda text-texto-suave">Atualizado em {quando(anuncio.atualizado_em)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="font-semibold tabular-nums">{preco(anuncio.preco_centavos)}</span>
                      <span className={`rounded-full px-2.5 py-1 text-legenda font-semibold ${situacao.cor}`}>
                        {situacao.texto}
                      </span>
                    </div>
                  </Cartao>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!error && paginas > 1 && (
        <nav aria-label="Páginas de anúncios" className="mt-5 flex flex-wrap items-center gap-3">
          {pagina > 1 && <Link href={endereco(filtro.status, pagina - 1)} className={estiloBotaoSec}>Anterior</Link>}
          <p className="text-sm text-texto-suave">Página {inteiro(pagina)} de {inteiro(paginas)}</p>
          {pagina < paginas && <Link href={endereco(filtro.status, pagina + 1)} className={estiloBotaoSec}>Próxima</Link>}
        </nav>
      )}
    </>
  );
}
