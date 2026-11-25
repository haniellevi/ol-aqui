import Link from "next/link";
import { Aviso, Cartao, Numero, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { variacao, type Lancamento, type periodoLancamento } from "@/lib/admin/lancamento";
import { PreparacaoGa4 } from "./preparacao-ga4";
import { AvisoSerieMetrica } from "@/components/metricas/aviso-serie";

type Props = { atual: Lancamento | null; anterior: Lancamento | null; periodo: ReturnType<typeof periodoLancamento> };
const n = (v: number) => v.toLocaleString("pt-BR");
const data = (s: string) => new Date(s).toLocaleString("pt-BR", {timeZone:"America/Fortaleza"});
const links = [["/admin/hoje","Tarefas de ajuda"],["/admin/funil","CRM de lojistas"],["/admin?visao=historico","Histórico financeiro"]] as const;
function Tabela({titulo, colunas, linhas}: {titulo:string;colunas:string[];linhas:(string|number)[][]}) {
  return <Cartao><h2 className="mb-3 text-lg font-semibold text-beringela">{titulo}</h2>
    {linhas.length ? <Table rotulo={titulo}><TableHeader><TableRow>{colunas.map(c=><TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{linhas.map((r,i)=><TableRow key={i}>{r.map((c,j)=><TableCell key={j}>{typeof c === "number" ? n(c) : c}</TableCell>)}</TableRow>)}</TableBody></Table>
      : <p className="text-sm text-texto-suave">Sem observações exibíveis neste recorte. Consulte os critérios abaixo.</p>}
  </Cartao>;
}
export function PainelLancamento({atual:r,anterior,periodo:p}: Props) {
  const diaLocal = (s: string) => new Intl.DateTimeFormat("en-CA", {timeZone:"America/Fortaleza"}).format(new Date(s));
  const periodoFechado = !!r && p.ate < diaLocal(r.gerado_em);
  const comparacao = (campo: keyof Lancamento["negocio"]) => !periodoFechado ? "Período aberto: comparação indisponível" : anterior && r ? `${variacao(r.negocio[campo],anterior.negocio[campo])} ante período anterior` : "Comparação indisponível";
  // O dia do corte é misto. Só comparar duas janelas integralmente posteriores.
  const diaCorte = r?.corte && r.rollout_fim ? diaLocal(Date.parse(r.corte)>Date.parse(r.rollout_fim) ? r.corte : r.rollout_fim) : null;
  const limiteRetencao = r ? new Date(Date.parse(`${diaLocal(r.gerado_em)}T12:00:00Z`) - 180 * 86400000).toISOString().slice(0,10) : null;
  const comparaTrafego = !!(periodoFechado && anterior && diaCorte && limiteRetencao && p.anteriorDe>=limiteRetencao && p.anteriorDe>diaCorte && anterior.corte===r?.corte && anterior.rollout_fim===r?.rollout_fim);
  return <div className="space-y-6">
    <nav aria-label="Áreas de resultados" className="flex flex-wrap gap-2">{links.map(([href,label])=><Botao key={href} href={href} variante="secundario">{label}</Botao>)}</nav>
    <Cartao>
      <nav aria-label="Atalhos de período" className="mb-3 flex flex-wrap gap-2">{[7,30,90].map(d=><Botao key={d} href={`/admin?dias=${d}`} variante="secundario">{d} dias</Botao>)}</nav>
      <form key={`${p.de}/${p.ate}`} action="/admin" method="get" className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-beringela">De<input type="date" name="de" defaultValue={p.de} required className={estiloCampo}/></label>
        <label className="text-sm text-beringela">Até<input type="date" name="ate" defaultValue={p.ate} required className={estiloCampo}/></label>
        <Botao type="submit" className="self-end">Ver resultados</Botao>
      </form>
      <p className="mt-3 text-sm text-texto-suave">Todas as regiões · {p.de} a {p.ate} · Fortaleza. Comparação: {p.anteriorDe} a {p.anteriorAte}. Filtros de categoria, cidade e região ficam nas telas especializadas.</p>
      {p.aviso && <p className="mt-2 text-sm text-aviso">{p.aviso}</p>}
    </Cartao>
    {!r ? <Aviso tipo="erro">Resultados indisponíveis. Atualize a página ou tente um período menor. Nenhum zero foi atribuído à falha.</Aviso> : <>
      <section aria-labelledby="acoes-lancamento">
        <h2 id="acoes-lancamento" className="mb-3 text-lg font-semibold text-beringela">Onde agir agora</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Numero rotulo="Lojas sem anúncio no ar" valor={n(r.oferta.sem_anuncios)} detalhe={<Link className="inline-flex min-h-toque items-center text-laranja-escuro underline" href="/admin/hoje">Ver tarefas de ajuda</Link>} />
          <Numero rotulo="Pedidos maduros sem proposta ativa" valor={n(r.radar.sem_proposta)} detalhe={<Link className="inline-flex min-h-toque items-center text-laranja-escuro underline" href="/admin/moderacao#radar">Conferir Radar</Link>} />
          <Numero rotulo="Anúncios no ar" valor={n(r.oferta.anuncios)} detalhe="Fotografia atual, em vitrines ativas. Veja a oferta por categoria e cidade abaixo." />
        </div>
      </section>
      <section aria-labelledby="trafego-consentido">
        <h2 id="trafego-consentido" className="mb-2 text-lg font-semibold text-beringela">Tráfego consentido</h2>
        <p className="mb-3 text-sm text-texto-suave">Fonte interna · coorte consentida_v1. Navegadores não representam pessoas. Sessão observada: fluxo no sessionStorage, renovado após 30 min sem pageview despachado. Leitura e interação não renovam o relógio; o armazenamento pode ser copiado entre abas, sem isolamento garantido. Conta fluxos observados no período, inclusive iniciados antes dele. {r.medicao.sem_dados ? "Sem observações: isso não prova ausência de visitantes." : "Apenas navegações com estatística aceita."}</p>
        <div className="grid gap-3 sm:grid-cols-3">{([['pageviews','Páginas vistas'],['navegadores','Navegadores'],['sessoes','Sessões observadas']] as const).map(([k,label])=><Numero key={k} rotulo={label} valor={n(r.medicao[k])} detalhe={comparaTrafego && anterior ? variacao(r.medicao[k],anterior.medicao[k]) : "Comparação de tráfego indisponível: período aberto, fora da retenção, sem base ou implantação não confirmada."}/>)}</div>
        <p className="mt-2 text-sm text-texto-suave">As novas métricas opcionais têm limpeza diária dos dias com mais de 180 dias em Fortaleza. O dia de 180 dias ainda fica; a remoção ocorre na próxima execução bem-sucedida. Antes de {limiteRetencao}, as observações podem ter sido removidas. Eventos e números sem identificação da população aguardam implantação confirmada e preservam os dias mistos. Favoritos, fatos do negócio e acumulados antigos permanecem separados desta limpeza.</p>
        <p className="mt-2 text-sm text-texto-suave">Marco SQL: {r.corte ? data(r.corte) : "não disponível"}. {r.rollout_inicio && r.rollout_fim ? `Implantação da aplicação: ${data(r.rollout_inicio)} a ${data(r.rollout_fim)}.` : "Janela da implantação real não confirmada; não comparar como série homogênea."} O dia do corte e a transição podem ser mistos. Série legada separada em Visitas; não somar populações.</p>
      </section>
      <Tabela titulo="Origem das páginas vistas" colunas={["Origem de catálogo","Páginas vistas"]} linhas={r.origens.map(o=>[o.origem,o.pageviews])}/>
      <section aria-labelledby="fatos-lancamento">
        <h2 id="fatos-lancamento" className="mb-3 text-lg font-semibold text-beringela">Fatos do período</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Numero rotulo="Anúncios publicados" valor={n(r.negocio.publicados)} detalhe={comparacao('publicados')}/>
          <Numero rotulo="Cupons resgatados" valor={n(r.negocio.cupons)} detalhe={comparacao('cupons')}/>
          <Numero rotulo="Recebimentos confirmados" valor={(r.negocio.receita_centavos/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} detalhe={`Empresa, produção. ${comparacao('receita_centavos')}`}/>
          <Numero rotulo="Contatos observados" valor={n(r.negocio.contatos)} detalhe="Soma diária sobrevivente de cliques WhatsApp de anúncios, potencialmente entre regimes de coleta diferentes; não inclui lojas nem comprova venda. Sem comparação temporal."/>
          <Numero rotulo="Vendas declaradas" valor={n(r.negocio.vendas_declaradas)} detalhe="Vendedor informou venda pelo site no período; não é transação comprovada nem derivada de cliques."/>
          <Numero rotulo="Lojas ativas" valor={n(r.oferta.lojas)} detalhe="Fotografia atual; não comparar como aquisição do período."/>
        </div>
      </section>
      <AvisoSerieMetrica />
      <Cartao>
        <h2 className="text-lg font-semibold text-beringela">Lojas e Radar: coortes observáveis</h2>
        <p className="mt-3 text-base">{n(r.ativacao.com_oferta)} de {n(r.ativacao.maduras)} lojas criadas no período, ativas hoje e com pelo menos 48 horas, têm anúncio no ar agora.</p>
        <p className="mt-2 text-sm text-texto-suave">Oferta atual dessa coorte; não mede primeiro anúncio em 48h. Lojas suspensas/excluídas ficam fora. Sem histórico confiável de primeira publicação, a conversão em 48h está indisponível.</p>
        <p className="mt-3 text-base">{n(r.radar.com_proposta)} de {n(r.radar.maduros)} pedidos criados no período há pelo menos 24 horas têm proposta ativa hoje.</p>
        <p className="mt-2 text-sm text-texto-suave">Pedidos abertos, atendidos ou encerrados; análise e recusados ficam fora. Propostas retiradas não contam. Não equivale à taxa de resposta em 24h. Base zero significa sem coorte elegível, sem taxa. Tempo até primeira proposta e funil de sessão entre telas: indisponíveis.</p>
      </Cartao>
      <Tabela titulo="Procura sem resultado" colunas={["Categoria","Região","Consultas","Sem resultado"]} linhas={r.demanda.map(d=>[d.categoria,d.regiao,d.buscas,d.sem_resultado])}/>
      <p className="text-sm text-texto-suave">Consultas textuais consentidas da busca principal, com Referer público do mesmo site aceito pelo servidor, por categoria/região no período. Filtros sem texto, entrada direta sem Referer e chegada de outro site ficam fora por desenho conservador. Não representa toda a procura. Sem termos livres. Mostramos até 20 grupos com cinco ou mais buscas sem resultado e cinco ou mais com resultado (ou nenhuma). Grupos pequenos são suprimidos; vazio pode significar supressão ou ausência. Nenhuma taxa é calculada sobre a lista truncada.</p>
      <Tabela titulo="Oferta atual por categoria e cidade" colunas={["Categoria","Cidade","Anúncios no ar"]} linhas={r.catalogo.map(c=>[c.categoria,c.cidade,c.anuncios])}/>
      <p className="text-sm text-texto-suave">Até 20 combinações com menor oferta publicada, em vitrines ativas, sem depender do período. Categorias sem anúncio não aparecem nesta lista; consulte Produtos e Relatórios para ampliar o recorte.</p>
      <Cartao>
        <h2 className="text-lg font-semibold text-beringela">Qualidade e atualização</h2>
        <p className="mt-2 text-sm text-texto-suave">Consulta gerada em {data(r.gerado_em)}. Última visita consentida global: {r.ultima_visita ? data(r.ultima_visita) : "sem observações"}. Isso não é garantia de saúde da coleta. Latência, falhas de ingestão e custos de campanha: indisponíveis.</p>
        {!anterior && <p className="mt-2 text-sm text-aviso">Fonte do período anterior indisponível; os valores atuais continuam disponíveis.</p>}
        <p className="mt-2 text-sm text-texto-suave">Campanhas livres não são atribuídas. GA4/Meta não entram nos totais. Relatórios, CRM, Radar e pagamentos mantêm suas fontes e autorizações próprias. Histórico preservado, sem exportação pessoal nesta visão.</p>
      </Cartao>
    </>}
    <PreparacaoGa4 />
  </div>;
}
