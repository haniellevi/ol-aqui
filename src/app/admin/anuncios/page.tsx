import Link from "next/link";
import { redirect } from "next/navigation";
import { Aviso, Cartao, Titulo, estiloBotao, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { ROTULO_ANUNCIO } from "@/components/conta/situacao-anuncios";
import { Chip } from "@/components/ui/chip";
import { exigirTela } from "@/lib/admin/equipe";
import { inteiro, quando } from "@/lib/admin/formato";
import { ehUuid, preco } from "@/lib/formato";
import { LINK_ADMIN_ANUNCIOS, linkAdminAnuncio } from "@/lib/rotas";
import type { MeuAnuncio } from "@/lib/tipos";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Anúncios" };

const FILTROS = [
  { status: "", nome: "Todos" },
  { status: "ativo", nome: "No ar" },
  { status: "pausado", nome: "Pausados" },
  { status: "rascunho", nome: "Rascunhos" },
  { status: "em_analise", nome: "Em análise" },
  { status: "vendido", nome: "Vendidos" },
  { status: "expirado", nome: "Expirados" },
  { status: "congelado", nome: "Congelados" },
  { status: "excluido", nome: "Lixeira" },
] as const;
const POR_PAGINA = 30;

type Parametros = Record<string, string | string[] | undefined>;
const um = (valor: string | string[] | undefined) => typeof valor === "string" ? valor : "";
type LinhaAnuncio = Pick<MeuAnuncio, "id" | "titulo" | "cidade" | "preco_centavos" | "status" | "atualizado_em"> & {
  vitrines_lojas: { nome: string } | null;
};

function endereco(status: string, busca: string, regiao: string, loja: string, pagina = 1) {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (busca) q.set("q", busca);
  if (regiao) q.set("regiao", regiao);
  if (loja) q.set("loja", loja);
  if (pagina > 1) q.set("pagina", String(pagina));
  return q.size ? `${LINK_ADMIN_ANUNCIOS}?${q}` : LINK_ADMIN_ANUNCIOS;
}

export default async function AnunciosAdminPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  const { supabase } = await exigirTela("anuncios");
  const sp = await searchParams;
  const filtro = FILTROS.find(({ status }) => status === sp.status) ?? FILTROS[0];
  const busca = um(sp.q).trim().slice(0, 100);
  const regiao = ehUuid(um(sp.regiao)) ? um(sp.regiao) : "";
  const loja = ehUuid(um(sp.loja)) ? um(sp.loja) : "";
  const numero = typeof sp.pagina === "string" ? Number(sp.pagina) : 1;
  const pagina = Number.isSafeInteger(numero) && numero > 0 && numero <= 1_000_000 ? numero : 1;
  const inicio = (pagina - 1) * POR_PAGINA;
  let consulta = supabase.from("anuncios")
    .select("id, titulo, cidade, preco_centavos, status, atualizado_em, vitrines_lojas(nome)", { count: "exact" })
    .order("atualizado_em", { ascending: false })
    .order("id");
  if (filtro.status) consulta = consulta.eq("status", filtro.status);
  if (regiao) consulta = consulta.eq("microrregiao_id", regiao);
  if (loja) consulta = consulta.eq("vitrine_id", loja);
  if (busca) {
    if (ehUuid(busca)) consulta = consulta.eq("id", busca);
    else consulta = consulta.filter("titulo", "imatch", busca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }
  const [{ data, count, error }, regioes, lojaR] = await Promise.all([
    consulta.range(inicio, inicio + POR_PAGINA - 1),
    supabase.from("microrregioes").select("id, nome").order("nome"),
    loja ? supabase.from("vitrines_lojas").select("nome").eq("id", loja).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (pagina > 1 && (error?.code === "PGRST103" || (!error && !data?.length))) {
    redirect(endereco(filtro.status, busca, regiao, loja));
  }
  const anuncios = (data ?? []) as unknown as LinhaAnuncio[];
  const total = count ?? 0;
  const paginas = Math.ceil(total / POR_PAGINA);

  return (
    <>
      <Titulo sub="Consulte os anúncios de todos os vendedores e confira a situação de cada um.">
        Anúncios
      </Titulo>
      <Cartao className="mb-4">
        <form method="get" action={LINK_ADMIN_ANUNCIOS} className="grid items-end gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          {filtro.status && <input type="hidden" name="status" value={filtro.status} />}
          {loja && <input type="hidden" name="loja" value={loja} />}
          <label className="min-w-0 text-sm font-medium">
            Buscar anúncio
            <input type="search" name="q" placeholder="Título ou ID do anúncio" defaultValue={busca} maxLength={100} className={estiloCampo} />
          </label>
          <label className="min-w-0 text-sm font-medium">
            Região
            <select name="regiao" defaultValue={regiao} className={estiloCampo}>
              <option value="">Todas</option>
              {regioes.data?.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              {regiao && !regioes.data?.some((item) => item.id === regiao) && <option value={regiao}>Região selecionada</option>}
            </select>
          </label>
          <button className={estiloBotao} type="submit">Buscar</button>
          {regioes.error && <p className="text-legenda text-perigo sm:col-span-full">Não foi possível carregar as regiões.</p>}
          {loja && (
            <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-full">
              <Link href={`/admin/lojas/${loja}`} className="font-semibold underline">{lojaR.data?.nome ?? "Loja selecionada"}</Link>
              <Link href={endereco(filtro.status, busca, regiao, "")} className={estiloBotaoSec}>Remover filtro de loja</Link>
            </div>
          )}
          {(busca || regiao) && <Link href={endereco(filtro.status, "", "", loja)} className="text-sm font-semibold text-laranja-escuro underline sm:col-span-full">Limpar busca e região</Link>}
        </form>
      </Cartao>
      <nav aria-label="Filtrar anúncios por situação" className="mb-6 flex flex-wrap gap-2">
        {FILTROS.map(({ status, nome }) => (
          <Chip key={status} href={endereco(status, busca, regiao, loja)} ativo={filtro.status === status} prefetch={false}>
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
              {busca || regiao || loja ? "Nenhum anúncio com estes filtros." : filtro.status ? "Nenhum anúncio nesta situação." : "Nenhum anúncio cadastrado."}
            </p>
          </Cartao>
        ) : (
          <ul className="space-y-3">
            {anuncios.map((anuncio) => {
              const situacao = ROTULO_ANUNCIO[anuncio.status];
              const titulo = anuncio.titulo?.trim() || "Anúncio sem título";
              return (
                <li key={anuncio.id}>
                  <Cartao className="grid items-start gap-3 @xl/lista:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                      <h3 className="text-base text-beringela">{titulo}</h3>
                      <p className="mt-1 text-sm text-texto-suave">
                        {[anuncio.vitrines_lojas?.nome, anuncio.cidade].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-1 text-legenda text-texto-suave">Atualizado em {quando(anuncio.atualizado_em)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="font-semibold tabular-nums">{preco(anuncio.preco_centavos)}</span>
                      <Badge variant={situacao.cor}>
                        {situacao.texto}
                      </Badge>
                      <Link href={linkAdminAnuncio(anuncio.id)} prefetch={false} className={estiloBotaoSec} aria-label={`Gerenciar ${titulo}`}>
                        Gerenciar
                      </Link>
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
          {pagina > 1 && <Link href={endereco(filtro.status, busca, regiao, loja, pagina - 1)} className={estiloBotaoSec}>Anterior</Link>}
          <p className="text-sm text-texto-suave">Página {inteiro(pagina)} de {inteiro(paginas)}</p>
          {pagina < paginas && <Link href={endereco(filtro.status, busca, regiao, loja, pagina + 1)} className={estiloBotaoSec}>Próxima</Link>}
        </nav>
      )}
    </>
  );
}
