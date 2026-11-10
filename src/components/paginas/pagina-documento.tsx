import Link from "next/link";
import { FileText, History } from "lucide-react";
import { documentoAtivo, documentoVersao, versoesDocumento } from "@/lib/dados/paginas";
import { linkDocumentoLegal, LINK_AJUDA } from "@/lib/rotas";
import { NOME_DOCUMENTO, type TipoDocumento } from "@/lib/tipos-paginas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { Markdown, titulosDoTexto } from "./markdown";

// T41 · Termos de uso e Política de privacidade. Mostra a versão no ar (ou uma antiga, com
// ?versao=N), com número e data, um índice "Nesta página" e a lista de versões.

const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Fortaleza" });

export function versaoPedida(v: string | string[] | undefined): number | null {
  const t = Array.isArray(v) ? v[0] : v;
  const n = Number(t);
  return t && Number.isInteger(n) && n > 0 ? n : null;
}

export async function PaginaDocumento({ tipo, versao }: { tipo: TipoDocumento; versao: number | null }) {
  const [atual, pedida, versoes] = await Promise.all([
    documentoAtivo(tipo),
    versao ? documentoVersao(tipo, versao) : Promise.resolve(null),
    versoesDocumento(tipo),
  ]);
  const doc = pedida ?? atual;
  const outro: TipoDocumento = tipo === "termos" ? "privacidade" : "termos";

  if (!doc) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
        <h1 className="text-titulo font-semibold">{NOME_DOCUMENTO[tipo]}</h1>
        <Vazio titulo="Este texto não abriu agora." texto="Confira sua internet e tente de novo em instantes." icone={<FileText />}>
          <Botao href={linkDocumentoLegal(tipo)} larguraTotal>
            Tentar de novo
          </Botao>
          <Botao href={LINK_AJUDA} variante="secundario" larguraTotal>
            Ir para a Ajuda
          </Botao>
        </Vazio>
      </main>
    );
  }

  const antiga = !doc.ativo;
  const indice = titulosDoTexto(doc.conteudo);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-titulo font-semibold">{doc.titulo}</h1>
        <p className="text-sm text-texto-suave">
          Versão {doc.versao} · publicada em {data.format(new Date(doc.publicado_em))}
        </p>
      </header>

      {antiga && (
        <div role="status" className="flex flex-col gap-2 rounded-card bg-aviso-fundo p-4 text-aviso">
          <p className="text-base font-semibold">Esta é uma versão antiga e não vale mais.</p>
          {atual && (
            <Link href={linkDocumentoLegal(tipo)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Ver a versão que vale hoje (versão {atual.versao})
            </Link>
          )}
        </div>
      )}

      {indice.length > 2 && (
        <details className="rounded-card bg-cartao px-4 shadow-1">
          <summary className="min-h-11 cursor-pointer py-3 text-base font-semibold">Nesta página</summary>
          <ol className="flex flex-col pb-3">
            {indice.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="flex min-h-11 items-center text-base text-laranja-escuro underline-offset-4 hover:underline">
                  {t.texto}
                </a>
              </li>
            ))}
          </ol>
        </details>
      )}

      <article className="rounded-card bg-cartao p-4 shadow-1 sm:p-6">
        <Markdown texto={doc.conteudo} />
      </article>

      <nav aria-label="Outros textos" className="flex flex-col gap-2">
        <Botao href={linkDocumentoLegal(outro)} variante="secundario" larguraTotal icone={<FileText />}>
          Ler {NOME_DOCUMENTO[outro].toLowerCase()}
        </Botao>
        <Botao href={LINK_AJUDA} variante="texto">
          Dúvidas? Veja a Ajuda
        </Botao>
      </nav>

      {versoes.length > 1 && (
        <section aria-labelledby="titulo-versoes" className="flex flex-col gap-2">
          <h2 id="titulo-versoes" className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-5" aria-hidden /> Versões
          </h2>
          <ul className="overflow-hidden rounded-card bg-cartao shadow-1">
            {versoes.map((v) => (
              <li key={v.id} className="border-b border-borda last:border-0">
                <Link
                  href={linkDocumentoLegal(tipo, v.ativo ? null : v.versao)}
                  aria-current={v.id === doc.id ? "page" : undefined}
                  className="flex min-h-11 flex-col justify-center px-4 py-2 hover:bg-fundo"
                >
                  <span className="text-base font-semibold">
                    Versão {v.versao}
                    {v.ativo ? " · vale hoje" : ""}
                  </span>
                  <span className="text-legenda text-texto-suave">
                    {data.format(new Date(v.publicado_em))}
                    {v.resumo_mudancas ? ` · ${v.resumo_mudancas}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
