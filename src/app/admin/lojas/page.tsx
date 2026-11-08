import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirTela } from "@/lib/admin/equipe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inteiro, quando } from "@/lib/admin/formato";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_LOJAS } from "@/lib/rotas";
import { Aviso, Cartao, Titulo, estiloBotao, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { FormAcaoLoja, FormVerificacao } from "./formularios";
import type { AcaoLoja, LojaAdmin, SituacaoConta } from "@/lib/tipos-cobranca";

export const metadata = { title: "Lojas" };

// Tela 5 · Lojistas e vitrines: plano, vencimento, anúncios no ar, propostas do Radar no mês e situação.
// Ações com motivo (cortesia, trocar plano, suspender/reativar, selo), gravadas no histórico.
// Verificações pendentes (documento, selfie, CNPJ) com aprovar/recusar.

const POR_PAGINA = 30;

const SITUACOES: { valor: SituacaoConta; nome: string; cor: string }[] = [
  { valor: "teste", nome: "Em teste", cor: "bg-laranja-claro text-beringela" },
  { valor: "teste_vencido", nome: "Teste vencido", cor: "bg-aviso-fundo text-aviso" },
  { valor: "ativa", nome: "Plano em dia", cor: "bg-sucesso-fundo text-verde-escuro" },
  { valor: "vencida", nome: "Plano vencido", cor: "bg-aviso-fundo text-aviso" },
  { valor: "gratis", nome: "Grátis", cor: "bg-fundo text-texto-suave" },
  { valor: "inadimplente", nome: "Inadimplente", cor: "bg-perigo-fundo text-perigo" },
  { valor: "suspensa", nome: "Suspensa", cor: "bg-perigo-fundo text-perigo" },
];
const SITUACAO = new Map(SITUACOES.map((s) => [s.valor, s]));

type Params = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type Verificacao = {
  id: string;
  tipo: string;
  criado_em: string;
  perfil_id: string;
  arquivo_path: string | null;
  perfis: { nome: string | null } | null;
};

const BUCKET_VERIFICACOES = "verificacoes";
const LINK_ARQUIVO_SEGUNDOS = 120; // o link do arquivo vale só 2 minutos
const PRECISA_ARQUIVO = new Set(["documento", "selfie"]);

/** Links temporários dos arquivos (bucket privado). Sem chave ou sem bucket: sem link (não quebra a tela). */
async function linksDosArquivos(verificacoes: Verificacao[]): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  const comArquivo = verificacoes.filter((v) => v.arquivo_path);
  if (comArquivo.length === 0) return links;
  try {
    const { data } = await supabaseAdmin()
      .storage.from(BUCKET_VERIFICACOES)
      .createSignedUrls(
        comArquivo.map((v) => v.arquivo_path!),
        LINK_ARQUIVO_SEGUNDOS,
      );
    for (const item of data ?? []) {
      const v = comArquivo.find((x) => x.arquivo_path === item.path);
      if (v && item.signedUrl && !item.error) links.set(v.id, item.signedUrl);
    }
  } catch {
    /* sem link: a tela mostra que não dá para conferir */
  }
  return links;
}

export default async function LojasPage({ searchParams }: { searchParams: Params }) {
  // Administrador: tudo. Suporte: todas as regiões, só suspender/reativar e verificações.
  // Franqueado: só a região dele (o banco troca o filtro pela região dele) e só leitura.
  const { supabase, papel } = await exigirTela("lojas");
  const franqueado = papel === "franqueado";
  const acoesDoPapel: AcaoLoja[] | null = papel === "administrador" ? null : papel === "suporte" ? ["suspender", "reativar"] : [];
  const sp = await searchParams;
  const busca = um(sp.q).trim().slice(0, 80);
  const situacao = SITUACAO.has(um(sp.situacao) as SituacaoConta) ? um(sp.situacao) : "";
  const regiao = ehUuid(um(sp.regiao)) ? um(sp.regiao) : "";
  const tipo = um(sp.tipo) === "pf" || um(sp.tipo) === "loja" ? um(sp.tipo) : "";
  const pagina = Math.max(1, Math.min(1000, Number.parseInt(um(sp.pagina), 10) || 1));

  const [lojasR, regioesR, planosR, verifR] = await Promise.all([
    supabase.rpc("admin_lojas", {
      p_busca: busca || null,
      p_situacao: situacao || null,
      p_regiao: regiao || null,
      p_tipo: tipo || null,
      p_limite: POR_PAGINA,
      p_deslocamento: (pagina - 1) * POR_PAGINA,
    }),
    supabase.from("microrregioes").select("id, nome").order("nome"),
    supabase.from("planos").select("codigo, nome, ordem").order("ordem"),
    franqueado
      ? Promise.resolve({ data: [] })
      : supabase
          .from("perfis_verificacoes")
          .select("id, tipo, criado_em, perfil_id, arquivo_path, perfis!perfis_verificacoes_perfil_id_fkey(nome)")
          .eq("status", "pendente")
          .order("criado_em")
          .limit(50),
  ]);

  const lojas = ((lojasR.data ?? []) as LojaAdmin[]).map((l) => ({ ...l, total: Number(l.total) }));
  const total = lojas[0]?.total ?? 0;
  // Página depois do fim (endereço velho ou filtro novo numa página alta): volta para a primeira.
  // O total vem das linhas da página, então numa página vazia ele não existe.
  const paginaVazia = !lojasR.error && lojas.length === 0 && pagina > 1;
  const regioes = (regioesR.data ?? []) as { id: string; nome: string }[];
  const nomeRegiao = new Map(regioes.map((r) => [r.id, r.nome]));
  const planos = (planosR.data ?? []) as { codigo: string; nome: string }[];
  const verificacoes = (verifR.data ?? []) as unknown as Verificacao[];
  const links = await linksDosArquivos(verificacoes);
  const filtrando = !!(busca || situacao || regiao || tipo);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const linkPagina = (n: number) => {
    const q = new URLSearchParams();
    if (busca) q.set("q", busca);
    if (situacao) q.set("situacao", situacao);
    if (regiao) q.set("regiao", regiao);
    if (tipo) q.set("tipo", tipo);
    if (n > 1) q.set("pagina", String(n));
    const s = q.toString();
    return s ? `${LINK_ADMIN_LOJAS}?${s}` : LINK_ADMIN_LOJAS;
  };
  if (paginaVazia) redirect(linkPagina(1));

  return (
    <>
      <Titulo
        sub={
          franqueado
            ? "Lojas e vendedores da sua região. Só para ver: mudanças são feitas pela equipe OLAKI."
            : "Lojas e vendedores pessoa física. Toda ação pede o motivo e fica no histórico."
        }
      >
        Lojas
      </Titulo>

      <Cartao className="mb-6">
        <form method="get" className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <label className="col-span-2 text-sm font-semibold">
            Buscar
            <input name="q" defaultValue={busca} placeholder="Nome, endereço, dono, WhatsApp ou CNPJ" className={estiloCampo} />
          </label>
          <label className="text-sm font-semibold">
            Situação
            <select name="situacao" defaultValue={situacao} className={estiloCampo}>
              <option value="">Todas</option>
              {SITUACOES.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Tipo
            <select name="tipo" defaultValue={tipo} className={estiloCampo}>
              <option value="">Todos</option>
              <option value="loja">Loja</option>
              <option value="pf">Pessoa física</option>
            </select>
          </label>
          {!franqueado && (
            <label className="col-span-2 text-sm font-semibold md:col-span-1">
              Região
              <select name="regiao" defaultValue={regiao} className={estiloCampo}>
                <option value="">Todas</option>
                {regioes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="col-span-2 flex flex-wrap gap-3 md:col-span-5">
            <button type="submit" className={estiloBotao}>
              Filtrar
            </button>
            {filtrando && (
              <Link href={LINK_ADMIN_LOJAS} className={estiloBotaoSec}>
                Limpar filtros
              </Link>
            )}
          </div>
        </form>
      </Cartao>

      {verificacoes.length > 0 && (
        <section aria-labelledby="verificacoes" className="mb-6">
          <h2 id="verificacoes" className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
            Verificações pendentes ({verificacoes.length})
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {verificacoes.map((v) => (
              <li key={v.id}>
                <Cartao>
                  <p className="text-base font-semibold text-beringela">{v.perfis?.nome ?? "Pessoa"}</p>
                  <p className="mb-3 text-sm text-texto-suave">
                    {v.tipo === "documento" ? "Documento" : v.tipo === "selfie" ? "Selfie" : v.tipo === "cnpj" ? "CNPJ" : v.tipo} · enviado {quando(v.criado_em)}
                  </p>
                  {links.has(v.id) ? (
                    <a
                      href={links.get(v.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-3 inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline underline-offset-4"
                    >
                      Ver o arquivo enviado (o link vale 2 minutos)
                    </a>
                  ) : PRECISA_ARQUIVO.has(v.tipo) ? (
                    <p className="mb-3 text-sm font-semibold text-aviso">
                      {v.arquivo_path ? "Não deu para abrir o arquivo agora. Atualize a página." : "Sem arquivo para conferir."} Só dá para recusar.
                    </p>
                  ) : null}
                  <FormVerificacao id={v.id} podeAprovar={!PRECISA_ARQUIVO.has(v.tipo) || links.has(v.id)} />
                </Cartao>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="lista-lojas">
        <h2 id="lista-lojas" className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
          {inteiro(total)} {total === 1 ? "vendedor" : "vendedores"}
        </h2>
        {lojasR.error ? (
          <Aviso tipo="erro">Não deu para ler as lojas agora. Atualize a página.</Aviso>
        ) : lojas.length === 0 ? (
          <Cartao>
            <p className="text-base text-texto-suave">Nenhuma loja com estes filtros.</p>
            {filtrando && (
              <Link href={LINK_ADMIN_LOJAS} className="mt-2 inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline underline-offset-4">
                Ver todas
              </Link>
            )}
          </Cartao>
        ) : (
          <ul className="flex flex-col gap-3">
            {lojas.map((l) => {
              const sit = SITUACAO.get(l.situacao);
              const vence = l.situacao === "teste" || l.situacao === "teste_vencido" ? l.teste_expira_em : l.plano_expira_em;
              return (
                <li key={l.id} className="rounded-card border border-borda bg-cartao p-4 shadow-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-beringela">
                        <Link href={`/loja/${l.slug}`} className="underline-offset-2 hover:underline">
                          {l.nome}
                        </Link>
                        {l.selo_loja_verificada && <span className="ml-2 text-[13px] font-bold text-verde-escuro">Selo verificada</span>}
                      </p>
                      <p className="text-sm text-texto-suave">
                        {l.tipo === "loja" ? "Loja" : "Pessoa física"} · {l.dono_nome ?? "Dono"}
                        {l.whatsapp ? ` · ${l.whatsapp}` : ""} · {l.cidade ?? nomeRegiao.get(l.microrregiao_id) ?? ""}
                      </p>
                    </div>
                    {sit && <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${sit.cor}`}>{sit.nome}</span>}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
                    <div>
                      <dt className="text-texto-suave">Plano</dt>
                      <dd className="font-semibold">
                        {l.plano_nome ?? l.plano ?? "—"}
                        {l.plano_efetivo_nome && l.plano_efetivo_nome !== l.plano_nome ? ` (vale: ${l.plano_efetivo_nome})` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-texto-suave">Vence</dt>
                      <dd className="font-semibold">{vence ? quando(vence) : "Não vence"}</dd>
                    </div>
                    <div>
                      <dt className="text-texto-suave">Anúncios no ar</dt>
                      <dd className="font-semibold tabular-nums">
                        {inteiro(l.anuncios_ativos)}
                        {l.limite_anuncios !== null ? ` de ${inteiro(l.limite_anuncios)}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-texto-suave">Propostas do Radar no mês</dt>
                      <dd className="font-semibold tabular-nums">
                        {inteiro(l.propostas_mes)}
                        {l.propostas_limite !== null ? ` de ${inteiro(l.propostas_limite)}` : ""}
                      </dd>
                    </div>
                  </dl>
                  {l.plano_proximo && (
                    <p className="mt-2 text-sm text-texto-suave">
                      Troca marcada: {l.plano_proximo_nome ?? l.plano_proximo} até {quando(l.plano_proximo_ate)} (já paga).
                    </p>
                  )}
                  {(acoesDoPapel === null || acoesDoPapel.length > 0) && (
                    <details className="mt-3 border-t border-borda pt-3">
                      <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-laranja-escuro">Ações</summary>
                      <div className="pt-2">
                        <FormAcaoLoja loja={l} planos={planos} permitidas={acoesDoPapel} />
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {paginas > 1 && (
          <nav aria-label="Páginas" className="mt-4 flex items-center justify-between gap-3">
            {pagina > 1 ? (
              <Link href={linkPagina(pagina - 1)} className={estiloBotaoSec}>
                Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-texto-suave">
              Página {pagina} de {paginas}
            </span>
            {pagina < paginas ? (
              <Link href={linkPagina(pagina + 1)} className={estiloBotaoSec}>
                Próxima
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </>
  );
}
