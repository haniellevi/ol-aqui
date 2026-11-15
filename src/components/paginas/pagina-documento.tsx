import { ChevronDown, FileText, History } from "lucide-react";
import { Voltar } from "@/components/ui/voltar";
import { documentoAtivo, documentoVersao, versoesDocumento } from "@/lib/dados/paginas";
import { linkDocumentoLegal, LINK_AJUDA } from "@/lib/rotas";
import { NOME_DOCUMENTO, type TipoDocumento } from "@/lib/tipos-paginas";
import { Botao, classesBotao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { Markdown, titulosDoTexto } from "./markdown";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Fortaleza" });
const pagina = "mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-4 [overflow-wrap:anywhere]";

export function versaoPedida(v: string | string[] | undefined): number | null {
  const t = Array.isArray(v) ? v[0] : v;
  const n = Number(t);
  return t && /^\d+$/.test(t) && Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function PaginaDocumento({ tipo, versao }: { tipo: TipoDocumento; versao: number | null }) {
  const [atual, pedida, versoes] = await Promise.all([
    documentoAtivo(tipo),
    versao ? documentoVersao(tipo, versao).catch(() => undefined) : Promise.resolve(null),
    versoesDocumento(tipo),
  ]);
  const doc = versao ? pedida : atual;
  const href = linkDocumentoLegal(tipo);
  const outro: TipoDocumento = tipo === "termos" ? "privacidade" : "termos";
  const historico = versoes.length > 1;

  if (!doc) {
    const inexistente = versao !== null && pedida === null;
    return (
      <main className={pagina}>
        <Voltar />
        <h1 className="text-titulo font-semibold text-beringela">{NOME_DOCUMENTO[tipo]}</h1>
        <Vazio titulo={inexistente ? `Versão ${versao} não encontrada` : "Não conseguimos abrir o documento"} icone={<FileText />}>
          {inexistente || atual ? (
            <a href={href} className={classesBotao("primario", false, "", "toque")}>Ver versão atual</a>
          ) : (
            <Botao href={linkDocumentoLegal(tipo, versao)} tamanho="toque">Tentar novamente</Botao>
          )}
          {versao && !inexistente && atual && (
            <Botao href={linkDocumentoLegal(tipo, versao)} variante="secundario" tamanho="toque">Tentar novamente</Botao>
          )}
          <Botao href={LINK_AJUDA} variante="texto" tamanho="toque">Ir para a Ajuda</Botao>
        </Vazio>
      </main>
    );
  }

  const indice = titulosDoTexto(doc.conteudo);

  return (
    <main className={pagina}>
      <Voltar />
      <header className="flex flex-col gap-1">
        <h1 className="text-titulo font-semibold text-beringela">{doc.titulo}</h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-texto-suave">
          <Badge variant={doc.ativo ? "success" : "secondary"}>{doc.ativo ? "Versão vigente" : "Versão arquivada"}</Badge>
          <p>Versão {doc.versao} · <time dateTime={doc.publicado_em}>{data.format(new Date(doc.publicado_em))}</time></p>
        </div>
      </header>

      {!doc.ativo && (
        <Alert variant="warning" role="status" className="flex flex-col gap-1">
          <p className="font-semibold">Este documento foi substituído.</p>
          {atual && <a href={href} className={classesBotao("texto", false, "self-start", "toque")}>Ver versão atual</a>}
        </Alert>
      )}

      {(indice.length > 0 || historico) && (
        <nav aria-label="Navegação do documento" className="flex flex-wrap items-start gap-2">
          {indice.length > 0 && (
            <details className="group min-w-0 flex-1 basis-40 rounded-card border border-borda bg-cartao">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-campo px-3 text-sm font-semibold text-beringela focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro [&::-webkit-details-marker]:hidden">
                Nesta página <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden />
              </summary>
              <ol className="border-t border-borda px-1 py-1">
                {indice.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="flex min-h-11 items-center rounded-campo px-2 py-1 text-sm text-beringela underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro">
                      {t.texto}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {historico && (
            <a href="#versoes-documento" className={classesBotao("secundario", false, "", "toque")}>
              <History className="size-4 shrink-0" aria-hidden /> Histórico
            </a>
          )}
        </nav>
      )}

      <article aria-label={NOME_DOCUMENTO[tipo]} className="rounded-card border border-borda bg-cartao p-4 sm:p-6">
        <Markdown texto={doc.conteudo} className="text-lg!" />
      </article>

      {historico && (
        <section id="versoes-documento" aria-labelledby="titulo-versoes" className="flex scroll-mt-20 flex-col gap-2">
          <h2 id="titulo-versoes" className="text-lg font-semibold text-beringela">Histórico de versões</h2>
          <ul className="divide-y divide-borda rounded-card border border-borda bg-cartao">
            {versoes.map((v) => (
              <li key={v.id}>
                <a
                  href={linkDocumentoLegal(tipo, v.ativo ? null : v.versao)}
                  aria-current={v.id === doc.id ? "page" : undefined}
                  className="flex min-h-11 flex-col justify-center gap-0.5 rounded-campo px-3 py-2 hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro"
                >
                  <span className="text-base font-semibold">{`Versão ${v.versao}`}{v.ativo ? " · vigente" : ""}</span>
                  <span className="text-sm text-texto-suave">
                    <time dateTime={v.publicado_em}>{data.format(new Date(v.publicado_em))}</time>
                    {v.resumo_mudancas ? ` · ${v.resumo_mudancas}` : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Outros textos" className="flex flex-wrap gap-2">
        <Botao href={linkDocumentoLegal(outro)} variante="secundario" tamanho="toque" icone={<FileText />}>
          Ler {NOME_DOCUMENTO[outro].toLowerCase()}
        </Botao>
        <Botao href={LINK_AJUDA} variante="texto" tamanho="toque">Ir para a Ajuda</Botao>
      </nav>
    </main>
  );
}
