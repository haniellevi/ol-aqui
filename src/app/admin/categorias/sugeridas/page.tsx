import Link from "next/link";
import { ArrowLeft, Tags } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/auth";
import { lerCategorias, lerCategoriasSugeridas, maesPossiveis, nomeAdmin } from "@/lib/admin/cadastros";
import { inteiro } from "@/lib/admin/formato";
import { LINK_ADMIN_CATEGORIAS } from "@/lib/rotas";
import { Aviso, Titulo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { CartaoSugestao, type ItemSugestao } from "./formularios";

export const metadata = { title: "Categorias sugeridas" };

type Busca = Record<string, string | string[] | undefined>;
const numeroDoResumo = (v: string | string[] | undefined) => {
  const n = Number(typeof v === "string" ? v : "");
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
};

// Resultado da última decisão (vem na URL depois do redirect da ação).
function mensagemDecisao(sp: Busca): string {
  const feito = typeof sp.feito === "string" ? sp.feito : "";
  const decididas = numeroDoResumo(sp.decididas);
  const movidos = numeroDoResumo(sp.movidos);
  const revisar = numeroDoResumo(sp.revisar);
  if (feito === "recusar") return `${inteiro(decididas)} ${decididas === 1 ? "sugestão recusada" : "sugestões recusadas"}. Os anúncios continuam na categoria atual.`;
  const quantas = `${inteiro(decididas)} ${decididas === 1 ? "sugestão decidida" : "sugestões decididas"}`;
  const mudaram = `${inteiro(movidos)} ${movidos === 1 ? "anúncio mudou" : "anúncios mudaram"} de categoria`;
  const revisao = revisar ? ` ${inteiro(revisar)} ${revisar === 1 ? "precisa" : "precisam"} que o vendedor confirme a categoria.` : "";
  const inicio = feito === "aprovar" ? "Categoria criada. " : "Sugestões unidas à categoria escolhida. ";
  return `${inicio}${quantas}. ${mudaram}.${revisao}`;
}

// Tela 9 · Categorias sugeridas: o que os vendedores pediram e não existe na lista. O admin aprova (cria),
// junta (com uma categoria que já existe) ou recusa. Grupos parecidos podem ir na mesma decisão.
export default async function CategoriasSugeridasPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const sp = await searchParams;
  const { supabase } = await exigirAdmin();
  const [{ grupos, falhou }, { todas }] = await Promise.all([lerCategoriasSugeridas(supabase), lerCategorias(supabase)]);

  const porId = new Map(todas.map((c) => [c.id, c]));
  const maes = maesPossiveis(todas).map((m) => ({ id: m.id, nome: m.nome }));
  // Categoria "no ar": ela e as de cima estão ligadas. Final = sem subcategoria ligada (só essas recebem anúncio).
  const noAr = (id: string) => {
    for (let c = porId.get(id); c; c = c.pai_id ? porId.get(c.pai_id) : undefined) if (!c.ativa) return false;
    return true;
  };
  const finais = todas
    .filter((c) => noAr(c.id) && !todas.some((f) => f.pai_id === c.id && f.ativa))
    .map((c) => ({ id: c.id, nome: nomeAdmin(porId, c) }));
  const quantidadePorTexto = new Map(grupos.map((g) => [g.texto_norm, g]));

  const itens: ItemSugestao[] = grupos.map((g) => {
    // proximas vem da mais usada para a menos. A mãe padrão é a da categoria próxima mais comum.
    const proxima = g.proximas[0];
    const cat = proxima ? porId.get(proxima.id) : undefined;
    // Categoria próxima sem mãe (principal): não sugere ela mesma, a equipe escolhe o lugar.
    const paiSugerido = cat?.pai_id ?? "";
    const paiPadrao = maes.some((m) => m.id === paiSugerido) ? paiSugerido : (maes[0]?.id ?? "");
    const finalPadrao = proxima && finais.some((f) => f.id === proxima.id) ? proxima.id : (finais[0]?.id ?? "");
    return {
      grupo: g,
      paiPadrao,
      finalPadrao,
      parecidas: g.parecidas.map((norm) => ({
        norm,
        texto: quantidadePorTexto.get(norm)?.texto ?? norm,
        quantidade: quantidadePorTexto.get(norm)?.quantidade ?? 0,
      })),
    };
  });

  return (
    <>
      <Link href={LINK_ADMIN_CATEGORIAS} className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-laranja-escuro">
        <ArrowLeft className="size-5" aria-hidden />
        Todas as categorias
      </Link>
      <Titulo sub="Categorias que os vendedores pediram e que ainda não existem. Criar cria a categoria nova. Juntar move os anúncios para uma que já existe. Recusar deixa tudo como está. Quem decide move os anúncios e avisa o vendedor.">
        Categorias sugeridas
      </Titulo>

      {sp.feito && <Aviso tipo="ok">{mensagemDecisao(sp)}</Aviso>}

      {falhou ? (
        <Vazio titulo="Não conseguimos abrir as sugestões" texto="Confira a internet e tente de novo.">
          <Botao href={LINK_ADMIN_CATEGORIAS} variante="secundario" larguraTotal>
            Tentar de novo
          </Botao>
        </Vazio>
      ) : !grupos.length ? (
        <Vazio titulo="Nenhuma sugestão esperando" texto="Quando um vendedor pedir uma categoria que não existe, ela aparece aqui." icone={<Tags />}>
          <Botao href={LINK_ADMIN_CATEGORIAS} variante="secundario">
            Voltar para as categorias
          </Botao>
        </Vazio>
      ) : (
        <div className="space-y-4">
          {itens.map((item) => (
            <CartaoSugestao key={item.grupo.texto_norm} item={item} maes={maes} finais={finais} />
          ))}
        </div>
      )}
    </>
  );
}
