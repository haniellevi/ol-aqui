import { formatarNome } from "@/lib/formatar-nome";
import { ChevronDown, ImageOff } from "lucide-react";
import { PERIODOS_PRODUTOS, type NumerosProduto, type PeriodoProdutos } from "@/lib/dados/metricas-produtos";
import { inteiro } from "@/lib/formato";
import { Chip } from "@/components/ui/chip";
import { Aviso } from "@/components/conta/aviso";

// Etapa P4: números de cada produto no período. Linguagem simples, sem termos técnicos.

const SITUACAO: Record<string, string> = {
  ativo: "No ar",
  vendido: "Vendido",
  pausado: "Pausado",
  expirado: "Vencido",
  excluido: "Na lixeira",
  em_analise: "Em análise",
  congelado: "Parado pela equipe",
};

const textoDias = (n: number) => (n === 1 ? "1 dia" : `${inteiro(n)} dias`);
const textoPosicao = (p: number) => `${p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}º`;

export function NumerosProdutos({
  lista,
  periodo,
  diasDaLoja,
}: {
  lista: NumerosProduto[] | null;
  periodo: PeriodoProdutos;
  /** Período da seção "Números" da loja (7 ou 30), mantido ao trocar o período dos produtos. */
  diasDaLoja: 7 | 30;
}) {
  return (
    <section aria-labelledby="titulo-numeros-produtos" className="flex flex-col gap-3">
      <h2 id="titulo-numeros-produtos" className="flex items-center gap-2 text-lg font-bold">
        Números por produto
      </h2>
      <p className="text-base text-texto-suave">Visualizações e cliques de cada produto. Suas próprias visitas não contam.</p>
      <nav aria-label="Período dos produtos" className="flex flex-wrap gap-2">
        {PERIODOS_PRODUTOS.map((p) => (
          <Chip key={p} href={`?dias=${diasDaLoja}&produtos=${p}`} ativo={periodo === p} aria-label={`Últimos ${p} dias`}>
            {p} dias
          </Chip>
        ))}
      </nav>

      {lista === null ? (
        <Aviso tipo="atencao">Não conseguimos carregar os números dos produtos agora. Atualize a página.</Aviso>
      ) : lista.length === 0 ? (
        <p className="rounded-card border border-borda bg-cartao p-3 text-base text-texto-suave">Nenhum produto no período. Os números aparecem aqui quando houver atividade.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-card bg-cartao shadow-1">
          {lista.map((p) => (
            <li key={p.anuncio_id} className="flex flex-col gap-3 p-3">
              <div className="flex items-center gap-3">
                {p.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura do próprio anúncio
                  <img src={p.foto} alt="" width={56} height={56} className="size-14 shrink-0 rounded-campo object-cover" />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-campo bg-fundo text-texto-suave" aria-hidden><ImageOff className="size-5" /></span>
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{formatarNome(p.titulo)}</span>
                  <span className="text-sm text-texto-suave">{SITUACAO[p.status] ?? "Fora do ar"}</span>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                <div><dt className="text-texto-suave">Apareceu nas listas</dt><dd className="text-lg font-bold tabular-nums">{inteiro(p.aparicoes)}</dd></div>
                <div><dt className="text-texto-suave">Visualizações</dt><dd className="text-lg font-bold tabular-nums">{inteiro(p.visualizacoes)}</dd></div>
                <div><dt className="text-texto-suave">Cliques no WhatsApp</dt><dd className="text-lg font-bold tabular-nums">{inteiro(p.cliques_whatsapp)}</dd></div>
                <div><dt className="text-texto-suave">Novos favoritos</dt><dd className="text-lg font-bold tabular-nums">{inteiro(p.favoritos)}</dd></div>
              </dl>
              <details className="group border-t border-borda">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-semibold text-beringela focus-visible:outline-3 focus-visible:outline-laranja-escuro [&::-webkit-details-marker]:hidden">
                  <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden /> Mais detalhes
                </summary>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pb-1 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-texto-suave">Lugar médio na lista</dt>
                  <dd className="font-semibold tabular-nums">{p.posicao_media === null ? "—" : textoPosicao(p.posicao_media)}</dd>
                </div>
                <div>
                  <dt className="text-texto-suave">Cliques a cada 100 visualizações</dt>
                  <dd className="font-semibold tabular-nums">{p.pct_chamou === null ? "—" : `${inteiro(p.pct_chamou)} de 100`}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-texto-suave">Palavras que trouxeram a pessoa</dt>
                  <dd className="font-semibold">
                    {p.termos.length === 0 ? "Ainda nenhuma" : p.termos.map((t) => `${t.termo} (${inteiro(t.vezes)})`).join(", ")}
                  </dd>
                </div>
                {p.tempo_ate_sair_dias !== null && (
                  <div className="col-span-2">
                    <dt className="text-texto-suave">Tempo no ar até sair</dt>
                    <dd className="font-semibold">{textoDias(p.tempo_ate_sair_dias)}</dd>
                  </div>
                )}
              </dl>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
