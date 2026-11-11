import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/auth";
import { lerCategorias, maesPossiveis, nomeAdmin } from "@/lib/admin/cadastros";
import { inteiro } from "@/lib/admin/formato";
import { ehUuid } from "@/lib/formato";
import { nomeDoNivel } from "@/lib/categorias-arvore";
import { LINK_ADMIN_CATEGORIAS, linkAdminCategoria } from "@/lib/rotas";
import { Cartao, Titulo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { BotaoApagarCategoria, FormCategoria } from "../formularios";

export const metadata = { title: "Categoria" };

// Tela 9 · Uma categoria: nome, ícone, mãe, esconder, preço da moderação e campos do anúncio.
export default async function CategoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { supabase } = await exigirAdmin();
  const { todas, falhou } = await lerCategorias(supabase);
  const categoria = todas.find((c) => c.id === id);

  if (!categoria) {
    if (!falhou) notFound();
    return (
      <Vazio titulo="Não conseguimos abrir esta categoria" texto="Confira a internet e tente de novo.">
        <Botao href={linkAdminCategoria(id)} variante="secundario" larguraTotal>
          Tentar de novo
        </Botao>
        <Botao href={LINK_ADMIN_CATEGORIAS} variante="texto">
          Voltar para as categorias
        </Botao>
      </Vazio>
    );
  }

  const mae = categoria.pai_id ? todas.find((c) => c.id === categoria.pai_id) : null;
  const principais = maesPossiveis(todas, categoria.id);
  // a mãe atual sempre aparece no seletor (senão o formulário trocaria de mãe sem avisar)
  if (mae && !principais.some((p) => p.id === mae.id)) {
    principais.unshift({ id: mae.id, nome: nomeAdmin(new Map(todas.map((c) => [c.id, c])), mae), ativa: mae.ativa });
  }
  const emUso = categoria.anuncios_total > 0 || categoria.pedidos_radar > 0 || categoria.filhas > 0;
  const uso = [
    categoria.anuncios_total ? `${inteiro(categoria.anuncios_total)} ${categoria.anuncios_total === 1 ? "anúncio" : "anúncios"} (${inteiro(categoria.anuncios_ativos)} no ar)` : null,
    categoria.pedidos_radar ? `${inteiro(categoria.pedidos_radar)} ${categoria.pedidos_radar === 1 ? "pedido no Radar" : "pedidos no Radar"}` : null,
    categoria.filhas ? `${inteiro(categoria.filhas)} ${categoria.filhas === 1 ? "subcategoria" : "subcategorias"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <Link href={LINK_ADMIN_CATEGORIAS} className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-laranja-escuro">
        <ArrowLeft className="size-5" aria-hidden />
        Todas as categorias
      </Link>
      <Titulo sub={`${mae ? `Dentro de ${mae.nome}` : "Categoria principal"} · ${nomeDoNivel(categoria.nivel)} · ${uso || "sem anúncios"}`}>{categoria.nome}</Titulo>

      <div className="space-y-4">
        <Cartao>
          <FormCategoria categoria={categoria} principais={principais} />
        </Cartao>

        <Cartao>
          <h2 className="mb-1 text-lg font-semibold text-beringela">Apagar categoria</h2>
          {emUso ? (
            <p className="text-sm text-texto-suave">
              Não dá para apagar: tem {uso}. Para tirar do cadastro, desmarque &quot;Aparece no cadastro&quot; e salve. Os anúncios continuam no ar.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-texto-suave">Ninguém usa esta categoria ainda. Apagar tira de vez (fica registrado no histórico).</p>
              <BotaoApagarCategoria categoria={categoria} />
            </>
          )}
        </Cartao>
      </div>
    </>
  );
}
