import Link from "next/link";
import { Tags } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/auth";
import { lerCategorias } from "@/lib/admin/cadastros";
import { inteiro } from "@/lib/admin/formato";
import { LINK_ADMIN_CATEGORIAS, linkAdminCategoria } from "@/lib/rotas";
import type { CategoriaAdmin } from "@/lib/tipos-cadastros";
import { Cartao, Titulo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { CirculoCategoria, IconeCategoria } from "@/components/ui/icone-categoria";
import { Vazio } from "@/components/ui/vazio";
import { BotoesOrdem, FormNovaCategoria } from "./formularios";

export const metadata = { title: "Categorias e campos" };

function Etiquetas({ c, maeEscondida }: { c: CategoriaAdmin; maeEscondida?: boolean }) {
  return (
    <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-legenda text-texto-suave">
      {!c.ativa && <span className="rounded-full bg-borda px-2 font-semibold text-texto-suave">Escondida</span>}
      {c.ativa && maeEscondida && <span className="rounded-full bg-borda px-2 font-semibold text-texto-suave">Escondida pela principal</span>}
      <span>
        {inteiro(c.anuncios_ativos)} {c.anuncios_ativos === 1 ? "anúncio no ar" : "anúncios no ar"}
      </span>
      {c.pai_id && (
        <span>
          {c.campos.length} {c.campos.length === 1 ? "campo" : "campos"}
        </span>
      )}
    </span>
  );
}

// Tela 9 · Categorias e campos: árvore (principal → subcategorias), ordem, criar.
export default async function CategoriasPage() {
  const { supabase } = await exigirAdmin();
  const { arvore, falhou } = await lerCategorias(supabase);
  const principais = arvore.map(({ id, nome, ativa }) => ({ id, nome, ativa }));

  return (
    <>
      <Titulo sub="O que aparece no cadastro de anúncio e nos filtros da busca. Categoria com anúncios não é apagada: esconda e os anúncios continuam no ar. Toda mudança fica no histórico.">
        Categorias e campos
      </Titulo>

      <div className="space-y-4">
        {falhou && !arvore.length ? (
          <Vazio titulo="Não conseguimos abrir as categorias" texto="Confira a internet e tente de novo.">
            <Botao href={LINK_ADMIN_CATEGORIAS} variante="secundario" larguraTotal>
              Tentar de novo
            </Botao>
          </Vazio>
        ) : !arvore.length ? (
          <Vazio titulo="Nenhuma categoria ainda" texto="Crie a primeira categoria logo abaixo." icone={<Tags />} />
        ) : (
          arvore.map((p, i) => (
            <Cartao key={p.id} className={p.ativa ? "" : "opacity-80"}>
              <div className="flex items-start gap-3">
                <CirculoCategoria nome={p.icone} />
                <div className="min-w-0 flex-1">
                  <Link href={linkAdminCategoria(p.id)} className="inline-flex min-h-10 items-center text-lg font-semibold text-beringela underline-offset-4 hover:underline">
                    {p.nome}
                  </Link>
                  <Etiquetas c={p} />
                </div>
                <BotoesOrdem id={p.id} nome={p.nome} primeiro={i === 0} ultimo={i === arvore.length - 1} />
              </div>

              {p.subcategorias.length > 0 ? (
                <ul className="mt-3 divide-y divide-borda border-t border-borda">
                  {p.subcategorias.map((s, j) => (
                    <li key={s.id} className="flex items-center gap-3 py-2 pl-2 md:pl-14">
                      <IconeCategoria nome={s.icone} className="size-5 shrink-0 text-beringela" />
                      <div className="min-w-0 flex-1">
                        <Link href={linkAdminCategoria(s.id)} className="inline-flex min-h-10 items-center text-base font-semibold text-beringela underline-offset-4 hover:underline">
                          {s.nome}
                        </Link>
                        <Etiquetas c={s} maeEscondida={!p.ativa} />
                      </div>
                      <BotoesOrdem id={s.id} nome={s.nome} primeiro={j === 0} ultimo={j === p.subcategorias.length - 1} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-card bg-aviso-fundo px-4 py-3 text-sm text-aviso">
                  Sem subcategorias: esta categoria não aparece no cadastro de anúncio. Crie uma subcategoria logo abaixo.
                </p>
              )}
            </Cartao>
          ))
        )}

        <Cartao className="border-dashed">
          <h2 className="mb-1 text-lg font-semibold text-beringela">Nova categoria</h2>
          <p className="mb-3 text-sm text-texto-suave">Depois de criar, você coloca os campos do anúncio e o preço da moderação.</p>
          <FormNovaCategoria principais={principais} />
        </Cartao>
      </div>
    </>
  );
}
