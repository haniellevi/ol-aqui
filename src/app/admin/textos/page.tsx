import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/auth";
import { quando } from "@/lib/admin/formato";
import { Cartao, Titulo } from "@/components/admin/ui";
import { linkDocumentoLegal } from "@/lib/rotas";
import {
  NOME_DOCUMENTO,
  type AjudaCategoria,
  type AjudaPergunta,
  type BlocoHome,
  type DocumentoLegal,
  type TipoDocumento,
} from "@/lib/tipos-paginas";
import { FormBloco, FormCategoria, FormPergunta, MoverBloco } from "./forms";
import { MarcarRevisado, PublicarDocumento } from "./publicar-documento";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Textos" };

// Tela 12 · Página inicial e textos: perguntas da Ajuda, termos e privacidade com versão
// e os blocos da página inicial. Toda mudança fica no histórico (logs_atividade).

const ABAS = [
  { id: "ajuda", nome: "Ajuda" },
  { id: "termos", nome: "Termos e privacidade" },
  { id: "inicio", nome: "Página inicial" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

export default async function TextosPage({ searchParams }: { searchParams: Promise<{ aba?: string; doc?: string }> }) {
  const { supabase } = await exigirAdmin();
  const sp = await searchParams;
  const aba: Aba = ABAS.some((a) => a.id === sp.aba) ? (sp.aba as Aba) : "ajuda";

  return (
    <>
      <Titulo sub="Perguntas da Ajuda, termos de uso e privacidade com número de versão, e a ordem e os textos da página inicial. Toda mudança fica no histórico.">
        Página inicial e textos
      </Titulo>

      <nav aria-label="Seções do painel" className="admin-abas -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`/admin/textos?aba=${a.id}`}
            aria-current={a.id === aba ? "page" : undefined}
            className={`inline-flex h-10 shrink-0 items-center rounded-campo border px-4 text-sm font-semibold text-beringela active:brightness-90 ${
              a.id === aba ? "border-laranja-escuro bg-selecao" : "border-borda bg-cartao"
            }`}
          >
            {a.nome}
          </Link>
        ))}
      </nav>

      {aba === "ajuda" && <AbaAjuda supabase={supabase} />}
      {aba === "termos" && <AbaTermos supabase={supabase} tipo={sp.doc === "privacidade" ? "privacidade" : "termos"} />}
      {aba === "inicio" && <AbaInicio supabase={supabase} />}
    </>
  );
}

type Db = Awaited<ReturnType<typeof exigirAdmin>>["supabase"];

async function AbaAjuda({ supabase }: { supabase: Db }) {
  const [cats, pergs] = await Promise.all([
    supabase.from("ajuda_categorias").select("slug, nome, descricao, ordem, ativa").order("ordem").order("nome"),
    supabase.from("ajuda_perguntas").select("id, categoria, pergunta, resposta, ordem, ativo").order("ordem").order("pergunta"),
  ]);
  const categorias = (cats.data ?? []) as AjudaCategoria[];
  const perguntas = (pergs.data ?? []) as AjudaPergunta[];
  if (cats.error || pergs.error) return <Cartao>Não deu para abrir a Ajuda agora. Recarregue a página.</Cartao>;

  return (
    <div className="space-y-6">
      <Cartao>
        <details>
          <summary className="min-h-10 cursor-pointer py-3 font-semibold text-beringela">+ Nova pergunta</summary>
          {categorias.length > 0 ? <FormPergunta categorias={categorias} /> : <p className="text-sm text-texto-suave">Crie um assunto primeiro.</p>}
        </details>
      </Cartao>

      {categorias.map((c) => {
        const itens = perguntas.filter((p) => p.categoria === c.slug);
        return (
          <section key={c.slug} className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-semibold text-beringela">{c.nome}</h2>
              <span className="text-legenda text-texto-suave">
                {itens.length} {itens.length === 1 ? "pergunta" : "perguntas"} · posição {c.ordem}
                {c.ativa ? "" : " · ESCONDIDO"}
              </span>
            </div>
            <Cartao className="space-y-1 p-0">
              <details className="border-b border-borda px-4">
                <summary className="min-h-10 cursor-pointer py-3 text-sm font-semibold text-beringela">Editar assunto</summary>
                <div className="pb-4">
                  <FormCategoria categoria={c} quantas={itens.length} />
                </div>
              </details>
              {itens.map((p) => (
                <details key={p.id} className="border-b border-borda px-4 last:border-0">
                  <summary className="min-h-10 cursor-pointer py-3 text-base text-beringela">
                    {p.pergunta}
                    {!p.ativo && <Badge variant="warning" className="ml-2">escondida</Badge>}
                  </summary>
                  <div className="pb-4">
                    <FormPergunta pergunta={p} categorias={categorias} />
                  </div>
                </details>
              ))}
            </Cartao>
          </section>
        );
      })}

      <Cartao>
        <details>
          <summary className="min-h-10 cursor-pointer py-3 font-semibold text-beringela">+ Novo assunto</summary>
          <FormCategoria />
        </details>
      </Cartao>
      <p className="text-legenda text-texto-suave">
        O WhatsApp e o e-mail da equipe que aparecem na Ajuda ficam em{" "}
        <Link href="/admin/configuracoes?grupo=geral" className="font-semibold text-laranja-escuro underline">
          Configurações &gt; Geral
        </Link>
        .
      </p>
    </div>
  );
}

async function AbaTermos({ supabase, tipo }: { supabase: Db; tipo: TipoDocumento }) {
  const { data, error } = await supabase
    .from("documentos_legais")
    .select("id, tipo, versao, titulo, conteudo, resumo_mudancas, revisado_advogado, ativo, publicado_em")
    .eq("tipo", tipo)
    .order("versao", { ascending: false });
  const versoes = (data ?? []) as DocumentoLegal[];
  const atual = versoes.find((v) => v.ativo) ?? null;
  const { count: aceitaram } = atual
    ? await supabase.from("aceites").select("id", { count: "exact", head: true }).eq("documento_id", atual.id)
    : { count: 0 };

  return (
    <div className="space-y-6">
      <nav className="flex gap-2">
        {(["termos", "privacidade"] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/textos?aba=termos&doc=${t}`}
            aria-current={t === tipo ? "page" : undefined}
            className={`inline-flex h-10 items-center rounded-campo border px-4 text-sm font-semibold text-beringela ${
              t === tipo ? "border-laranja-escuro bg-selecao" : "border-borda bg-cartao"
            }`}
          >
            {NOME_DOCUMENTO[t]}
          </Link>
        ))}
      </nav>

      {error && <Cartao>Não deu para abrir os textos agora. Recarregue a página.</Cartao>}

      {atual && (
        <Cartao className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-beringela">
              No ar: versão {atual.versao} · {quando(atual.publicado_em)}
            </h2>
            {atual.revisado_advogado ? (
              <span className="rounded-full bg-sucesso-fundo px-3 py-0.5 text-legenda font-semibold text-verde-escuro">Revisado por advogado</span>
            ) : (
              <span className="rounded-full bg-perigo-fundo px-3 py-0.5 text-legenda font-bold text-perigo">RASCUNHO: um advogado precisa revisar</span>
            )}
          </div>
          {!atual.revisado_advogado && (
            <p className="text-sm text-texto-suave">
              Este texto é um rascunho feito para o piloto e ainda não passou por advogado. Antes de divulgar o site, peça a revisão e preencha os dados da
              empresa (razão social, CNPJ, endereço e encarregado de dados).
            </p>
          )}
          <p className="text-sm text-texto-suave">
            {aceitaram ?? 0} {aceitaram === 1 ? "pessoa aceitou" : "pessoas aceitaram"} esta versão ·{" "}
            <Link href={linkDocumentoLegal(tipo)} target="_blank" className="font-semibold text-laranja-escuro underline">
              ver no site
            </Link>
          </p>
          <MarcarRevisado id={atual.id} revisado={atual.revisado_advogado} />
        </Cartao>
      )}

      <Cartao>
        <h2 className="mb-1 font-semibold text-beringela">Publicar versão nova</h2>
        <p className="mb-4 text-sm text-texto-suave">
          A versão publicada não muda mais (é a prova do que cada pessoa aceitou). Para corrigir, publique outra versão.
        </p>
        <PublicarDocumento key={atual?.id ?? tipo} tipo={tipo} atual={atual} />
      </Cartao>

      {versoes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-beringela">Todas as versões</h2>
          <Cartao className="p-0">
            <ul>
              {versoes.map((v) => (
                <li key={v.id} className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-borda px-4 py-2 last:border-0">
                  <Link href={linkDocumentoLegal(tipo, v.ativo ? null : v.versao)} target="_blank" className="font-semibold text-laranja-escuro underline">
                    Versão {v.versao}
                  </Link>
                  <span className="text-legenda text-texto-suave">
                    {quando(v.publicado_em)}
                    {v.ativo ? " · no ar" : ""}
                    {v.revisado_advogado ? " · revisada" : " · rascunho"}
                    {v.resumo_mudancas ? ` · ${v.resumo_mudancas}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Cartao>
        </section>
      )}
    </div>
  );
}

async function AbaInicio({ supabase }: { supabase: Db }) {
  const { data, error } = await supabase
    .from("home_blocos")
    .select("chave, nome, ordem, ativo, pode_desligar, pago, campos, titulo, texto, botao")
    .order("ordem")
    .order("chave");
  const blocos = (data ?? []) as BlocoHome[];
  if (error) return <Cartao>Não deu para abrir a página inicial agora. Recarregue a página.</Cartao>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-texto-suave">
        A busca e as categorias ficam sempre no topo. Os blocos abaixo aparecem nesta ordem. Os anúncios pagos continuam com a palavra Patrocinado. Os blocos pagos ficam sempre acima de &quot;Mais recentes&quot;, para quem pagou aparecer no começo da página.
      </p>
      {blocos.map((b, i) => (
        <Cartao key={b.chave} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-beringela">
              {i + 1}. {b.nome.replace(/\s*\(pago\)\s*$/i, "")}
              {b.pago && <Badge variant="featured" className="ml-2">pago</Badge>}
              {!b.ativo && <Badge variant="warning" className="ml-2">desligado</Badge>}
            </h2>
            <MoverBloco chave={b.chave} primeiro={i === 0} ultimo={i === blocos.length - 1} />
          </div>
          <FormBloco bloco={b} />
        </Cartao>
      ))}
    </div>
  );
}
