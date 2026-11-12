import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ChartNoAxesColumn, ChevronRight, Eye, Heart, ImageOff, Lightbulb, MapPin, MessageCircle, Sparkles, Store } from "lucide-react";
import { melhoriaIAAtiva, minhaVitrineCompleta, vitrineNovaAtiva } from "@/lib/dados/vitrine-completa";
import { meuDesempenhoLoja, minhasDicasLoja, type MotivoDica, type NumerosLoja } from "@/lib/dados/painel-loja";
import { meusNumerosProdutos, type PeriodoProdutos } from "@/lib/dados/metricas-produtos";
import { NumerosProdutos } from "./numeros-produtos";
import { inteiro } from "@/lib/formato";
import { LINK_MINHA_LOJA, linkMelhorarComIA } from "@/lib/rotas";
import { urlPasso } from "@/components/anunciar/passos";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Vazio } from "@/components/ui/vazio";
import { Aviso } from "@/components/conta/aviso";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";

export const metadata: Metadata = { title: "Desempenho da loja" };
export const dynamic = "force-dynamic";

// Vitrine com IA, etapa 5a: quantas pessoas viram a loja e os produtos, quantas chamaram no WhatsApp,
// os produtos mais vistos e dicas simples (por regra, sem IA). Só com a vitrine nova ligada.

type Props = { searchParams: Promise<{ dias?: string | string[]; produtos?: string | string[] }> };

const CARTOES: { chave: keyof NumerosLoja; titulo: string; icone: ReactNode }[] = [
  { chave: "visitas", titulo: "Visitas na loja", icone: <Store /> },
  { chave: "visualizacoes", titulo: "Vistas nos produtos", icone: <Eye /> },
  { chave: "cliques_whatsapp", titulo: "Cliques no WhatsApp", icone: <MessageCircle /> },
  { chave: "cliques_mapa", titulo: "Cliques no mapa", icone: <MapPin /> },
  { chave: "favoritos", titulo: "Novos favoritos", icone: <Heart /> },
];

const PASSO_DA_DICA: Record<MotivoDica, "fotos" | "preco" | "detalhes"> = {
  sem_foto: "fotos", poucas_fotos: "fotos", sem_preco: "preco",
  vistos_sem_clique: "detalhes", descricao_curta: "detalhes", titulo_curto: "detalhes",
};

function comparacao(atual: number, anterior: number, dias: 7 | 30): string {
  const antes = dias === 7 ? "na semana anterior" : "nos 30 dias anteriores";
  if (atual === anterior) return `Igual ${dias === 7 ? "à semana anterior" : "aos 30 dias anteriores"}`;
  const dif = Math.abs(atual - anterior);
  return `${inteiro(dif)} a ${atual > anterior ? "mais" : "menos"} que ${antes}`;
}

export default async function PaginaDesempenhoLoja({ searchParams }: Props) {
  const v = await minhaVitrineCompleta();
  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        <TopoConta titulo="Desempenho da loja" />
        <Vazio titulo="Você ainda não tem uma loja" texto="Abra sua loja para ver quantas pessoas visitam seus produtos.">
          <Botao href="/quero-vender/loja" larguraTotal>Abrir minha loja</Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  if (!(await vitrineNovaAtiva(v.microrregiao_id).catch(() => false))) notFound();
  const sp = await searchParams;
  const dias = (Array.isArray(sp.dias) ? sp.dias[0] : sp.dias) === "30" ? 30 : 7;
  const produtosParam = Array.isArray(sp.produtos) ? sp.produtos[0] : sp.produtos;
  const periodoProdutos: PeriodoProdutos = produtosParam === "7" ? 7 : produtosParam === "90" ? 90 : 30;
  const [d, dicas, comIA, produtos] = await Promise.all([
    meuDesempenhoLoja(v.id, dias),
    minhasDicasLoja(v.id),
    melhoriaIAAtiva(v.microrregiao_id).catch(() => false),
    meusNumerosProdutos(v.id, periodoProdutos),
  ]);

  return (
    <PaginaConta>
      <TopoConta
        titulo="Desempenho da loja"
        texto="Quantas pessoas viram sua loja e chamaram você. Suas próprias visitas não contam."
        voltar={LINK_MINHA_LOJA}
        textoVoltar="Minha loja"
      />

      <nav aria-label="Período" className="flex flex-wrap gap-2">
        <Chip href={`?dias=7&produtos=${periodoProdutos}`} ativo={dias === 7}>Últimos 7 dias</Chip>
        <Chip href={`?dias=30&produtos=${periodoProdutos}`} ativo={dias === 30}>Últimos 30 dias</Chip>
      </nav>

      <section aria-labelledby="titulo-numeros" className="flex flex-col gap-3">
        <h2 id="titulo-numeros" className="flex items-center gap-2 text-lg font-bold">
          <ChartNoAxesColumn className="size-5 text-laranja-escuro" aria-hidden />
          Números
        </h2>
        {d === null ? (
          <Aviso tipo="atencao">Não conseguimos carregar os números agora. Atualize a página.</Aviso>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CARTOES.map((c) => (
              <li key={c.chave} className="flex flex-col gap-1 rounded-card bg-cartao p-4 shadow-1">
                <span className="flex items-start gap-2 text-sm text-texto-suave">
                  <span className="mt-0.5 inline-flex [&>svg]:size-4" aria-hidden>{c.icone}</span>
                  {c.titulo}
                </span>
                <span className="text-2xl font-bold tabular-nums">{inteiro(d.atual[c.chave])}</span>
                <span className="text-sm text-texto-suave">{comparacao(d.atual[c.chave], d.anterior[c.chave], d.dias)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NumerosProdutos lista={produtos} periodo={periodoProdutos} diasDaLoja={dias} />

      {d !== null && (
        <section aria-labelledby="titulo-mais-vistos" className="flex flex-col gap-3">
          <h2 id="titulo-mais-vistos" className="flex items-center gap-2 text-lg font-bold">
            <Eye className="size-5 text-laranja-escuro" aria-hidden />
            Produtos mais vistos
          </h2>
          {d.mais_vistos.length === 0 ? (
            <p className="text-base text-texto-suave">Nenhum produto foi visto neste período. Divulgue o link da sua loja no Instagram e no WhatsApp.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-borda overflow-hidden rounded-card bg-cartao shadow-1">
              {d.mais_vistos.map((p) => (
                <li key={p.anuncio_id} className="flex items-center gap-3 p-3">
                  {p.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura do próprio anúncio
                    <img src={p.foto} alt="" width={56} height={56} className="size-14 shrink-0 rounded-campo object-cover" />
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-campo bg-fundo text-texto-suave" aria-hidden><ImageOff className="size-5" /></span>
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{p.titulo}</span>
                    <span className="text-sm text-texto-suave">
                      {p.visualizacoes === 1 ? "1 vista" : `${inteiro(p.visualizacoes)} vistas`} · {p.cliques === 1 ? "1 clique no WhatsApp" : `${inteiro(p.cliques)} cliques no WhatsApp`}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <section aria-labelledby="titulo-dicas" className="flex flex-col gap-3">
        <h2 id="titulo-dicas" className="flex items-center gap-2 text-lg font-bold">
          <Lightbulb className="size-5 text-laranja-escuro" aria-hidden />
          Dicas para vender mais
        </h2>
        {dicas === null ? (
          <Aviso tipo="atencao">Não conseguimos carregar as dicas agora. Atualize a página.</Aviso>
        ) : dicas.length === 0 ? (
          <Vazio titulo="Tudo certo por aqui" texto="Seus produtos têm foto, preço e boa descrição. Continue assim." icone={<Lightbulb />} />
        ) : (
          <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-card bg-cartao shadow-1">
            {dicas.map((t) => (
              <li key={t.anuncio_id} className="flex flex-col">
                <Link href={urlPasso(PASSO_DA_DICA[t.motivo], t.anuncio_id, true)} className="flex min-h-14 items-center gap-3 p-3 hover:bg-fundo">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{t.titulo}</span>
                    <span className="text-sm text-texto-suave">{t.texto}</span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-laranja-escuro">
                    Melhorar
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                </Link>
                {comIA && (
                  <Link href={linkMelhorarComIA(t.anuncio_id)} aria-label={`Melhorar ${t.titulo} com IA`}
                    className="-mt-2 flex min-h-10 items-center gap-1 px-3 pb-3 text-sm font-semibold text-laranja-escuro underline underline-offset-4">
                    <Sparkles className="size-4" aria-hidden />
                    Melhorar com IA
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PaginaConta>
  );
}
