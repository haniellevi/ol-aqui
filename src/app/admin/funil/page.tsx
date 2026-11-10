import Link from "next/link";
import { Plus } from "lucide-react";
import { exigirTela } from "@/lib/admin/equipe";
import { hojeLocal } from "@/lib/admin/hoje";
import { diasDesde, TOM_ETAPA, type EtapaFunil } from "@/lib/admin/funil";
import { Aviso, Cartao, Titulo, estiloCampo } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { AgendarRapido, BotaoImportar, EditarEtapas, MudarEtapa } from "./formularios";

export const metadata = { title: "Funil de lojistas" };
export const dynamic = "force-dynamic";

type Params = Promise<{ etapa?: string; regiao?: string; q?: string }>;

type Linha = {
  id: string;
  nome_loja: string;
  contato_nome: string | null;
  whatsapp: string | null;
  etapa: string;
  etapa_desde: string;
  proximo_passo: string | null;
  proximo_em: string | null;
  vitrine_id: string | null;
  cidades: { nome: string } | null;
  vitrines_lojas: { slug: string; plano: string; status: string } | null;
};

const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const dataCurta = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export default async function FunilPage({ searchParams }: { searchParams: Params }) {
  const { supabase } = await exigirTela("funil");
  const sp = await searchParams;
  const busca = String(sp.q ?? "").trim().slice(0, 60).replace(/[%,()*"\\]/g, " ");
  const regiao = /^[0-9a-f-]{36}$/.test(sp.regiao ?? "") ? sp.regiao! : "";

  const [etapasR, regioesR] = await Promise.all([
    supabase.from("funil_etapas").select("codigo, nome, tipo, ordem, ativa").order("ordem"),
    supabase.from("microrregioes").select("id, nome").order("nome"),
  ]);
  const etapas = (etapasR.data ?? []) as EtapaFunil[];
  const filtroEtapa = etapas.some((e) => e.codigo === sp.etapa) ? sp.etapa! : "";

  const base = () => {
    let q = supabase.from("funil_lojistas").select("id", { count: "exact", head: true });
    if (regiao) q = q.eq("microrregiao_id", regiao);
    return q;
  };
  const contagens = await Promise.all(etapas.map((e) => base().eq("etapa", e.codigo)));
  const porEtapa = new Map(etapas.map((e, i) => [e.codigo, contagens[i].count ?? 0]));
  const total = [...porEtapa.values()].reduce((a, b) => a + b, 0);

  let consulta = supabase
    .from("funil_lojistas")
    .select("id, nome_loja, contato_nome, whatsapp, etapa, etapa_desde, proximo_passo, proximo_em, vitrine_id, cidades(nome), vitrines_lojas(slug, plano, status)")
    .order("proximo_em", { ascending: true, nullsFirst: false })
    .order("atualizado_em", { ascending: false })
    .limit(200);
  if (filtroEtapa) consulta = consulta.eq("etapa", filtroEtapa);
  else consulta = consulta.in("etapa", etapas.filter((e) => e.tipo !== "perdido").map((e) => e.codigo));
  if (regiao) consulta = consulta.eq("microrregiao_id", regiao);
  if (busca) consulta = consulta.or(`nome_loja.ilike."%${busca}%",contato_nome.ilike."%${busca}%",whatsapp.ilike."%${busca.replace(/\D/g, "") || "x"}%"`);
  const { data, error } = await consulta;
  const linhas = ((data ?? []) as unknown as Linha[]).map((l) => ({ ...l, cidades: um(l.cidades), vitrines_lojas: um(l.vitrines_lojas) }));
  const nomeEtapa = new Map(etapas.map((e) => [e.codigo, e]));
  const hoje = hojeLocal();

  const link = (etapa: string) => {
    const q = new URLSearchParams();
    if (etapa) q.set("etapa", etapa);
    if (regiao) q.set("regiao", regiao);
    if (busca) q.set("q", busca);
    const s = q.toString();
    return `/admin/funil${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Titulo sub="Lojas que você está conquistando, do primeiro contato até pagar.">Funil de lojistas</Titulo>
        <Botao href="/admin/funil/novo" icone={<Plus className="size-4" aria-hidden />}>Novo contato</Botao>
      </div>

      <nav aria-label="Etapas" className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {[{ codigo: "", nome: "Em andamento", n: total - etapas.filter((e) => e.tipo === "perdido").reduce((s, e) => s + (porEtapa.get(e.codigo) ?? 0), 0) },
          ...etapas.filter((e) => e.ativa || (porEtapa.get(e.codigo) ?? 0) > 0).map((e) => ({ codigo: e.codigo, nome: e.nome, n: porEtapa.get(e.codigo) ?? 0 }))].map((t) => (
          <Link
            key={t.codigo || "todas"}
            href={link(t.codigo)}
            aria-current={t.codigo === filtroEtapa ? "page" : undefined}
            className={`olaki-controle-pequeno inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-legenda font-medium ${
              t.codigo === filtroEtapa ? "border-beringela bg-beringela text-white" : "border-borda bg-cartao text-beringela hover:bg-fundo"
            }`}
          >
            {t.nome} <span className="tabular-nums opacity-80">{t.n}</span>
          </Link>
        ))}
      </nav>

      <form action="/admin/funil" method="get" className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        {filtroEtapa && <input type="hidden" name="etapa" value={filtroEtapa} />}
        <input name="q" defaultValue={busca} placeholder="Nome da loja, pessoa ou WhatsApp" aria-label="Buscar" className={`${estiloCampo} mt-0`} />
        <select name="regiao" defaultValue={regiao} aria-label="Região" className={`${estiloCampo} mt-0`}>
          <option value="">Todas as regiões</option>
          {(regioesR.data ?? []).map((r) => <option key={r.id as string} value={r.id as string}>{r.nome as string}</option>)}
        </select>
        <Botao type="submit" variante="secundario">Filtrar</Botao>
      </form>

      {error && <Aviso tipo="erro">Não consegui carregar o funil. Atualize a página.</Aviso>}

      {!error && linhas.length === 0 ? (
        <Vazio titulo={total === 0 ? "O funil está vazio" : "Nada nesta etapa"} texto={total === 0 ? "Anote a primeira loja que você visitou ou traga as que já se cadastraram no site." : undefined}>
          <Botao href="/admin/funil/novo" variante="secundario" tamanho="pequeno">Novo contato</Botao>
          {total === 0 && <BotaoImportar />}
        </Vazio>
      ) : (
        <ul className="divide-y divide-borda overflow-hidden rounded-card border border-borda bg-cartao">
          {linhas.map((l) => {
            const e = nomeEtapa.get(l.etapa);
            const atrasado = !!l.proximo_em && l.proximo_em < hoje;
            const hojeMesmo = l.proximo_em === hoje;
            return (
              <li key={l.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:gap-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/funil/${l.id}`} className="text-lg font-medium text-beringela hover:underline [overflow-wrap:anywhere]">{l.nome_loja}</Link>
                  <p className="text-sm text-texto-suave">
                    {[l.contato_nome, l.cidades?.nome, e ? `${e.nome} há ${diasDesde(l.etapa_desde)} ${diasDesde(l.etapa_desde) === 1 ? "dia" : "dias"}` : null].filter(Boolean).join(" · ")}
                  </p>
                  {(l.proximo_passo || l.proximo_em) && (
                    <p className={`text-sm ${atrasado ? "text-perigo" : "text-beringela"}`}>
                      {l.proximo_em && <span className="font-medium">{atrasado ? "Atrasado " : hojeMesmo ? "Hoje " : ""}{dataCurta(l.proximo_em)}: </span>}
                      {l.proximo_passo ?? "falar com a loja"}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {l.vitrines_lojas && <Badge variant={TOM_ETAPA[e?.tipo ?? "aberta"]}>No site: plano {l.vitrines_lojas.plano}{l.vitrines_lojas.status !== "ativa" ? `, ${l.vitrines_lojas.status}` : ""}</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <MudarEtapa id={l.id} etapa={l.etapa} etapas={etapas} />
                  {l.whatsapp && (
                    <Botao href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener noreferrer" variante="whatsapp" tamanho="pequeno">WhatsApp</Botao>
                  )}
                  {!l.proximo_em && <AgendarRapido id={l.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {linhas.length === 200 && <p className="mt-2 text-legenda text-texto-suave">Mostrando os 200 primeiros. Use a busca para achar os outros.</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <Cartao>
          <h2 className="text-xl font-semibold text-beringela">Lojas do site</h2>
          <p className="mb-3 mt-1 text-sm text-texto-suave">Loja que se cadastra no site entra sozinha no funil, e vai para Pagando quando paga. Use o botão para trazer as que já existiam.</p>
          <BotaoImportar />
        </Cartao>
        <Cartao>
          <h2 className="text-xl font-semibold text-beringela">Etapas do funil</h2>
          <EditarEtapas etapas={etapas} />
        </Cartao>
      </div>
    </>
  );
}
