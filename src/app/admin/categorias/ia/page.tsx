import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/auth";
import { lerCategorias, nomeAdmin } from "@/lib/admin/cadastros";
import { inteiro, quando } from "@/lib/admin/formato";
import { PERIODOS_ACERTOS, chanceEmTexto, lerAcertosIA, periodoAcertos, porcentagem } from "@/lib/admin/acertos-ia";
import { LINK_ADMIN_CATEGORIAS, LINK_ADMIN_CATEGORIAS_IA, linkAdminAnuncio } from "@/lib/rotas";
import { Aviso, Cartao, Numero, Titulo } from "@/components/admin/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Acertos da IA" };
export const dynamic = "force-dynamic";

// Categorias · Etapa 2: onde a IA (JEV) erra ao sugerir a categoria no Anunciar.
// Conta só anúncios em que a IA respondeu e a pessoa salvou a categoria. Os números vêm da função
// admin_acertos_categoria_ia, que confere no banco se é administrador.

export default async function AcertosIAPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const dias = periodoAcertos((await searchParams).dias);
  const { supabase } = await exigirAdmin();
  const [r, { todas }] = await Promise.all([lerAcertosIA(supabase, dias), lerCategorias(supabase)]);

  const porId = new Map(todas.map((c) => [c.id, c]));
  const nome = (id: string) => {
    const c = porId.get(id);
    return c ? nomeAdmin(porId, c) : "Categoria apagada";
  };

  return (
    <>
      <Link href={LINK_ADMIN_CATEGORIAS} className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-laranja-escuro">
        <ArrowLeft className="size-5" aria-hidden />
        Todas as categorias
      </Link>
      <Titulo sub="Quando alguém escreve o que está anunciando, a IA sugere até 3 categorias. Aqui você vê quantas vezes a pessoa ficou com a 1ª sugestão e os casos em que escolheu outra.">
        Acertos da IA
      </Titulo>

      <nav aria-label="Período" className="mb-4 flex flex-wrap gap-2">
        {PERIODOS_ACERTOS.map((p) => (
          <Link
            key={p}
            href={`${LINK_ADMIN_CATEGORIAS_IA}?dias=${p}`}
            aria-current={p === dias ? "page" : undefined}
            className={`olaki-controle-pequeno inline-flex min-h-8 items-center rounded-full border px-3 text-legenda font-medium ${
              p === dias ? "border-beringela bg-beringela text-white" : "border-borda bg-cartao text-beringela hover:bg-fundo"
            }`}
          >
            {p} dias
          </Link>
        ))}
      </nav>

      {!r ? (
        <Aviso tipo="erro">Não consegui carregar os acertos agora. Atualize a página.</Aviso>
      ) : r.total === 0 ? (
        <Cartao className="text-sm text-texto-suave">Ninguém escolheu categoria com sugestão da IA neste período.</Cartao>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Numero rotulo="Acertou na 1ª sugestão" valor={porcentagem(r.acertou_1, r.total)} detalhe={`${inteiro(r.acertou_1)} de ${inteiro(r.total)}`} />
            <Numero rotulo="Acertou entre as 3" valor={porcentagem(r.acertou_3, r.total)} detalhe={`${inteiro(r.acertou_3)} de ${inteiro(r.total)}`} />
            <Numero rotulo="Escolheram outra" valor={inteiro(r.total - r.acertou_1)} detalhe="diferente da 1ª sugestão" />
            <Numero rotulo="IA sem sugestão" valor={inteiro(r.sem_sugestao)} detalhe="conta como erro" />
          </div>

          <Cartao>
            <h2 className="mb-3 text-lg font-semibold text-beringela">Quando a pessoa escolheu outra categoria</h2>
            {r.erros.length === 0 ? (
              <p className="text-sm text-texto-suave">Neste período, todo mundo ficou com a 1ª sugestão.</p>
            ) : (
              <>
                {r.total - r.acertou_1 > r.erros.length && (
                  <p className="mb-2 text-legenda text-texto-suave">Os {inteiro(r.erros.length)} casos mais recentes.</p>
                )}
                <Table rotulo="Casos em que a pessoa escolheu outra categoria" className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>O que a pessoa escreveu</TableHead>
                      <TableHead>O que a IA sugeriu</TableHead>
                      <TableHead>O que a pessoa escolheu</TableHead>
                      <TableHead>Quando</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.erros.map((e) => (
                      <TableRow key={e.anuncio_id}>
                        <TableCell className="min-w-44 [overflow-wrap:anywhere]">
                          <Link href={linkAdminAnuncio(e.anuncio_id)} className="text-beringela underline-offset-4 hover:underline">
                            {e.texto}
                          </Link>
                        </TableCell>
                        <TableCell className="min-w-56 [overflow-wrap:anywhere]">
                          {e.sugestoes.length ? (
                            <ol className="list-decimal space-y-0.5 pl-5">
                              {e.sugestoes.map((s) => (
                                <li key={s.id}>
                                  {nome(s.id)} <span className="text-texto-suave">({chanceEmTexto(s.chance)})</span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <span className="text-texto-suave">Nenhuma sugestão</span>
                          )}
                        </TableCell>
                        <TableCell className="min-w-48 [overflow-wrap:anywhere]">
                          {nome(e.escolhida_id)}
                          <span className="block text-legenda text-texto-suave">{e.entre_as_3 ? "Estava entre as 3" : "Fora das 3"}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{quando(e.escolhida_em)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </Cartao>
        </div>
      )}
    </>
  );
}
