import Link from "next/link";
import { BarChart3, Download } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/auth";
import { inteiro, reais } from "@/lib/admin/formato";
import {
  NOME_TIPO_RECEITA,
  TIPOS_RECEITA,
  atalhosPeriodo,
  dataBr,
  filtrosNoEndereco,
  lerFiltrosRelatorio,
  lerRelatorios,
  nomeMes,
  receitaPorMes,
  somarPor,
} from "@/lib/admin/relatorios";
import { Aviso, Cartao, Numero, Titulo } from "@/components/admin/ui";
import { classesBotao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { LINK_ADMIN_RELATORIOS } from "@/lib/rotas";
import type { FiltrosRelatorio as Filtros, RelatorioId } from "@/lib/tipos-relatorios";
import { Barras } from "./barras";
import { FiltrosRelatorio } from "./filtros";

export const metadata = { title: "Relatórios" };

// Tela 15 · Relatórios: funil, anúncios por categoria e cidade, teste grátis → plano pago,
// receita por tipo e custo do Aki. Só números somados (funções relatorio_* do banco, que conferem
// e_admin), filtro por período (até 12 meses) e região, e CSV de cada bloco.

type Params = Promise<Record<string, string | string[] | undefined>>;

const pct = (parte: number, todo: number) => (todo > 0 ? `${((parte / todo) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");
/** Custo do Aki vem em centavos com fração: mostra em reais com 2 casas. */
const reaisFracao = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

function BaixarCsv({ id, filtros }: { id: RelatorioId; filtros: Filtros }) {
  return (
    <a href={`${LINK_ADMIN_RELATORIOS}/csv?${filtrosNoEndereco(filtros, { r: id })}`} download className={classesBotao("texto")}>
      <Download className="size-5" aria-hidden />
      Baixar CSV
    </a>
  );
}

function Bloco({ titulo, sub, id, filtros, children }: { titulo: string; sub?: string; id: RelatorioId; filtros: Filtros; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`rel-${id}`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id={`rel-${id}`} className="text-lg font-semibold text-beringela">
            {titulo}
          </h2>
          {sub && <p className="text-sm text-texto-suave">{sub}</p>}
        </div>
        <BaixarCsv id={id} filtros={filtros} />
      </div>
      {children}
    </section>
  );
}

/** Saída do "nada neste período": 12 meses; se já está nos 12 meses, todas as regiões; senão, o resumo. */
function SemDados({ saida }: { saida: { href: string; texto: string } }) {
  return (
    <Cartao>
      <p className="text-base text-texto-suave">Nada neste período.</p>
      <Link href={saida.href} className={`${classesBotao("texto")} -ml-3`}>
        {saida.texto}
      </Link>
    </Cartao>
  );
}

function Falhou() {
  return <Aviso tipo="erro">Não deu para ler este relatório agora. Recarregue a página.</Aviso>;
}

const th = "px-3 py-2 text-left text-sm font-semibold text-beringela";
const td = "px-3 py-2 text-base tabular-nums text-beringela";

export default async function RelatoriosPage({ searchParams }: { searchParams: Params }) {
  const { supabase } = await exigirAdmin();
  const { filtros, aviso } = lerFiltrosRelatorio(await searchParams);
  const [rel, regioesR] = await Promise.all([lerRelatorios(supabase, filtros), supabase.from("microrregioes").select("id, nome").order("nome")]);
  const regioes = (regioesR.data ?? []) as { id: string; nome: string }[];
  const atalhos = atalhosPeriodo();
  const linkAtalho = (de: string, ate: string) => `${LINK_ADMIN_RELATORIOS}?${filtrosNoEndereco({ ...filtros, de, ate })}`;
  const doze = atalhos.find((a) => a.id === "12m")!;
  const jaDoze = filtros.de <= doze.de && filtros.ate >= doze.ate;
  const saida = !jaDoze
    ? { href: linkAtalho(doze.de, doze.ate), texto: "Ver os últimos 12 meses" }
    : filtros.regiao
      ? { href: `${LINK_ADMIN_RELATORIOS}?${filtrosNoEndereco({ ...filtros, regiao: null })}`, texto: "Ver todas as regiões" }
      : { href: "/admin", texto: "Voltar ao resumo do painel" };
  const nomeRegiao = filtros.regiao ? regioes.find((r) => r.id === filtros.regiao)?.nome ?? "Região escolhida" : "Todas as regiões";

  const f = rel.funil;
  const porCategoria = rel.anuncios ? somarPor(rel.anuncios, (l) => l.categoria, (l) => [l.no_ar, l.publicados]) : [];
  const porCidade = rel.anuncios ? somarPor(rel.anuncios, (l) => l.cidade, (l) => [l.no_ar, l.publicados]) : [];
  const conv = rel.conversao ?? [];
  const convTotal = conv.reduce(
    (t, l) => ({ comecaram: t.comecaram + l.comecaram, pagaram: t.pagaram + l.pagaram, em_teste: t.em_teste + l.em_teste, nao: t.nao + l.nao_pagaram }),
    { comecaram: 0, pagaram: 0, em_teste: 0, nao: 0 },
  );
  const receita = rel.receita ? receitaPorMes(rel.receita) : [];
  const receitaTotal = receita.reduce((t, m) => t + m.total, 0);
  const receitaTipo = TIPOS_RECEITA.map((t) => ({ tipo: t, total: receita.reduce((s, m) => s + m.tipos[t], 0) }));
  const aki = rel.aki ?? [];
  const akiTotal = aki.reduce((t, m) => t + m.custo_centavos, 0);

  return (
    <>
      <Titulo sub="Números somados do OLAKI. Escolha o período (até 12 meses) e a região. Cada bloco pode ser baixado em planilha (CSV).">Relatórios</Titulo>

      <Cartao className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {atalhos.map((a) => (
            <Chip key={a.id} href={linkAtalho(a.de, a.ate)} ativo={a.de === filtros.de && a.ate === filtros.ate}>
              {a.nome}
            </Chip>
          ))}
        </div>
        <FiltrosRelatorio de={filtros.de} ate={filtros.ate} regiao={filtros.regiao} regioes={regioes} />
        <p className="text-[13px] text-texto-suave">
          Mostrando de {dataBr(filtros.de)} até {dataBr(filtros.ate)} · {nomeRegiao}. Datas no horário de Fortaleza.
        </p>
        {aviso && (
          <p role="status" className="rounded-card bg-aviso-fundo px-4 py-3 text-sm text-aviso">
            {aviso}
          </p>
        )}
      </Cartao>

      <div className="space-y-10">
        {/* 1. Funil */}
        <Bloco
          id="funil"
          filtros={filtros}
          titulo="Funil"
          sub="Quem viu um anúncio, quem chamou no WhatsApp e quem disse que vendeu pelo OLAKI. Buscas ainda não são contadas."
        >
          {!f ? (
            <Falhou />
          ) : f.visualizacoes + f.cliques_whatsapp + f.vendidos === 0 ? (
            <SemDados saida={saida} />
          ) : (
            <Cartao>
              <Barras
                rotulo="Funil do período"
                itens={[
                  { rotulo: "Visualizações de anúncio", valor: f.visualizacoes, texto: inteiro(f.visualizacoes) },
                  {
                    rotulo: "Cliques no WhatsApp",
                    valor: f.cliques_whatsapp,
                    texto: inteiro(f.cliques_whatsapp),
                    detalhe: `${pct(f.cliques_whatsapp, f.visualizacoes)} de quem viu chamou no WhatsApp`,
                  },
                  {
                    rotulo: "Anúncios marcados como vendidos",
                    valor: f.vendidos,
                    texto: inteiro(f.vendidos),
                    detalhe: `${inteiro(f.vendidos_fora)} venderam fora do OLAKI · ${inteiro(f.vendidos_sem_resposta)} não responderam`,
                  },
                  {
                    rotulo: "“Vendi pelo OLAKI”",
                    valor: f.vendidos_pelo_olaki,
                    texto: inteiro(f.vendidos_pelo_olaki),
                    detalhe: `${pct(f.vendidos_pelo_olaki, f.vendidos)} dos vendidos`,
                  },
                ]}
              />
              <p className="mt-4 text-sm text-texto-suave">Compartilhamentos de anúncio: {inteiro(f.compartilhamentos)}</p>
            </Cartao>
          )}
        </Bloco>

        {/* 2. Anúncios por categoria e cidade */}
        <Bloco id="anuncios" filtros={filtros} titulo="Anúncios por categoria e cidade" sub="No ar agora e publicados no período.">
          {!rel.anuncios ? (
            <Falhou />
          ) : rel.anuncios.length === 0 ? (
            <SemDados saida={saida} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Cartao>
                <h3 className="mb-3 text-base font-semibold text-beringela">Por categoria</h3>
                <Barras
                  rotulo="Anúncios no ar por categoria"
                  itens={porCategoria.map((c) => ({
                    rotulo: c.nome,
                    valor: c.valores[0],
                    texto: `${inteiro(c.valores[0])} no ar`,
                    detalhe: `${inteiro(c.valores[1])} publicados no período`,
                  }))}
                />
              </Cartao>
              <Cartao>
                <h3 className="mb-3 text-base font-semibold text-beringela">Por cidade</h3>
                <Barras
                  rotulo="Anúncios no ar por cidade"
                  cor="beringela"
                  itens={porCidade.map((c) => ({
                    rotulo: c.nome,
                    valor: c.valores[0],
                    texto: `${inteiro(c.valores[0])} no ar`,
                    detalhe: `${inteiro(c.valores[1])} publicados no período`,
                  }))}
                />
              </Cartao>
            </div>
          )}
        </Bloco>

        {/* 3. Teste grátis → plano pago */}
        <Bloco
          id="conversao"
          filtros={filtros}
          titulo="Teste grátis para plano pago"
          sub="Lojas que começaram o teste no período, pelo mês em que começaram."
        >
          {!rel.conversao ? (
            <Falhou />
          ) : conv.length === 0 ? (
            <SemDados saida={saida} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Numero rotulo="Começaram o teste" valor={inteiro(convTotal.comecaram)} />
                <Numero rotulo="Pagaram um plano" valor={inteiro(convTotal.pagaram)} detalhe={`${pct(convTotal.pagaram, convTotal.comecaram)} das lojas`} />
                <Numero rotulo="Ainda em teste" valor={inteiro(convTotal.em_teste)} />
                <Numero rotulo="Acabou sem pagar" valor={inteiro(convTotal.nao)} />
              </div>
              <Cartao className="overflow-x-auto p-0 focus-visible:outline-2 focus-visible:outline-laranja-escuro" role="region" aria-label="Conversão de teste em plano por mês" tabIndex={0}>
                <table className="w-full min-w-[520px]">
                  <caption className="sr-only">Teste grátis para plano pago, por mês</caption>
                  <thead className="border-b border-borda">
                    <tr>
                      <th scope="col" className={th}>Mês</th>
                      <th scope="col" className={th}>Começaram</th>
                      <th scope="col" className={th}>Pagaram</th>
                      <th scope="col" className={th}>Em teste</th>
                      <th scope="col" className={th}>Sem pagar</th>
                      <th scope="col" className={th}>Viraram pagantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conv.map((l) => (
                      <tr key={l.mes} className="border-b border-borda last:border-0">
                        <th scope="row" className={th}>{nomeMes(l.mes)}</th>
                        <td className={td}>{inteiro(l.comecaram)}</td>
                        <td className={td}>{inteiro(l.pagaram)}</td>
                        <td className={td}>{inteiro(l.em_teste)}</td>
                        <td className={td}>{inteiro(l.nao_pagaram)}</td>
                        <td className={td}>{pct(l.pagaram, l.comecaram)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Cartao>
            </>
          )}
        </Bloco>

        {/* 4. Receita */}
        <Bloco id="receita" filtros={filtros} titulo="Recebimentos da empresa por tipo" sub="Soma os pagamentos confirmados com origem em produção, pela data do pagamento. Estornos, testes e pagamentos sem origem identificada ficam fora da soma.">
          {!rel.receita ? (
            <Falhou />
          ) : receita.length === 0 ? (
            <SemDados saida={saida} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Numero rotulo="Total recebido" valor={reais(receitaTotal)} />
                {receitaTipo.map((r) => (
                  <Numero key={r.tipo} rotulo={NOME_TIPO_RECEITA[r.tipo]} valor={reais(r.total)} detalhe={pct(r.total, receitaTotal)} />
                ))}
              </div>
              <Cartao>
                <h3 className="mb-3 text-base font-semibold text-beringela">Total por mês</h3>
                <Barras
                  rotulo="Recebimentos por mês"
                  cor="verde"
                  itens={receita.map((m) => ({
                    rotulo: nomeMes(m.mes),
                    valor: m.total,
                    texto: reais(m.total),
                    detalhe: TIPOS_RECEITA.map((t) => `${NOME_TIPO_RECEITA[t]}: ${reais(m.tipos[t])}`).join(" · "),
                  }))}
                />
              </Cartao>
            </>
          )}
        </Bloco>

        {/* 5. Custo do Aki */}
        <Bloco id="aki" filtros={filtros} titulo="Custo do robô Aki" sub="Custo gravado em cada resposta do Aki (inclui os testes do painel).">
          {!rel.aki ? (
            <Falhou />
          ) : aki.length === 0 ? (
            <SemDados saida={saida} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Numero rotulo="Custo no período" valor={reaisFracao(akiTotal)} />
                <Numero rotulo="Respostas" valor={inteiro(aki.reduce((t, m) => t + m.respostas, 0))} />
                <Numero rotulo="Conversas" valor={inteiro(aki.reduce((t, m) => t + m.conversas, 0))} detalhe="somando os meses" />
                <Numero rotulo="Respostas com erro" valor={inteiro(aki.reduce((t, m) => t + m.erros, 0))} />
              </div>
              <Cartao>
                <h3 className="mb-3 text-base font-semibold text-beringela">Custo por mês</h3>
                <Barras
                  rotulo="Custo do Aki por mês"
                  cor="beringela"
                  itens={aki.map((m) => ({
                    rotulo: nomeMes(m.mes),
                    valor: m.custo_centavos,
                    texto: reaisFracao(m.custo_centavos),
                    detalhe: `${inteiro(m.respostas)} respostas · ${inteiro(m.conversas)} conversas · ${pct(m.custo_centavos, akiTotal)} do período`,
                  }))}
                />
              </Cartao>
            </>
          )}
        </Bloco>

        <p className="flex items-center gap-2 text-[13px] text-texto-suave">
          <BarChart3 className="size-4" aria-hidden />
          Os relatórios mostram só totais. Nenhum nome ou telefone aparece aqui.
        </p>
      </div>
    </>
  );
}
